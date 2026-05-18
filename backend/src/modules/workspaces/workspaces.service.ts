import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createDefaultWorkflow } from '../workflows/workflows.service.js';
import { emitMemberAddedNotification } from '../notifications/notifications.service.js';
import { auditLog } from '../../shared/utils/audit-logger.js';
import type { CreateWorkspaceDto, UpdateWorkspaceDto, AddMemberDto, UpdateMemberRoleDto, InviteByEmailDto } from './workspaces.dto.js';
import { CANDIDATE_LIMIT_MAX, CANDIDATE_MIN_QUERY } from './workspaces.dto.js';

// Match the deletion suffix: __deleted_<13-digit unix-millis>
// Anchored to exactly 13 digits to avoid corrupting legitimate slugs that may
// contain "__deleted_" followed by digits with a different length.
const DELETED_SLUG_SUFFIX = /__deleted_\d{13}$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function logEvent(
  workspaceId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  await prisma.workspaceEvent.create({
    data: {
      workspaceId,
      userId,
      action,
      entityType,
      entityId,
      meta: meta ? (meta as Parameters<typeof prisma.workspaceEvent.create>[0]['data']['meta']) : undefined,
    },
  });
}

async function assertMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.workspace.deletedAt !== null) throw new AppError(404, 'Workspace not found');
  return member;
}

async function assertOwner(workspaceId: string, userId: string) {
  const member = await assertMember(workspaceId, userId);
  if (member.role !== 'OWNER') throw new AppError(403, 'Only workspace owners can perform this action');
  return member;
}

/**
 * Like assertMember, but allows access to soft-deleted workspaces.
 * Used by trash operations (list/restore/purge) which need to see deleted workspaces.
 */
async function assertMemberIncludingDeleted(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });
  if (!member) throw new AppError(403, 'Access denied');
  return member;
}

// ─── Workspace CRUD ──────────────────────────────────────────────────────────

export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true, boards: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const workspaceIds = memberships.map((m) => m.workspaceId);
  let taskCountMap = new Map<string, number>();
  if (workspaceIds.length > 0) {
    const rows = await prisma.$queryRaw<{ workspaceId: string; task_count: bigint }[]>`
      SELECT b."workspaceId", COUNT(t.id) AS task_count
      FROM boards b
      LEFT JOIN tasks t ON t."boardId" = b.id
      WHERE b."workspaceId" = ANY(${workspaceIds})
      GROUP BY b."workspaceId"
    `;
    taskCountMap = new Map(rows.map((r) => [r.workspaceId, Number(r.task_count)]));
  }

  return memberships
    // VIEWERs cannot see private workspaces
    .filter((m) => !(m.workspace.isPrivate && m.role === 'VIEWER'))
    .map((m) => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
      boardCount: m.workspace._count.boards,
      taskCount: taskCountMap.get(m.workspaceId) ?? 0,
      mfaGraceUntil: m.mfaGraceUntil ?? null,
    }));
}

export async function createWorkspace(userId: string, dto: CreateWorkspaceDto) {
  // Active workspaces enforce slug uniqueness;
  // soft-deleted workspaces have suffixed slugs so don't conflict.
  const slugExists = await prisma.workspace.findFirst({
    where: { slug: dto.slug, deletedAt: null },
  });
  if (slugExists) throw new AppError(409, 'Slug already taken');

  const workspace = await prisma.workspace.create({
    data: {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      creatorId: userId,
      members: {
        create: { userId, role: 'OWNER' },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
    },
  });

  // Auto-create default workflow
  await createDefaultWorkflow(workspace.id);

  await logEvent(workspace.id, userId, 'workspace_created', 'workspace', workspace.id, { name: dto.name });

  return workspace;
}

export async function getWorkspace(workspaceId: string, userId: string) {
  const member = await assertMember(workspaceId, userId);
  // Private workspaces are not accessible to VIEWERs
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { isPrivate: true } });
  if (ws?.isPrivate && member.role === 'VIEWER') throw new AppError(403, 'This workspace is private');

  return prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      },
      workflows: {
        orderBy: { createdAt: 'asc' },
        include: { statuses: { orderBy: { position: 'asc' } } },
      },
      _count: { select: { members: true } },
    },
  });
}

export async function updateWorkspace(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
  await assertOwner(workspaceId, userId);

  const current = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true, isPrivate: true, requireMfa: true, mfaGraceDays: true },
  });

  const graceDays = dto.mfaGraceDays ?? current.mfaGraceDays;

  const updated = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });

    const enablingMfa = dto.requireMfa === true && current.requireMfa === false;
    if (enablingMfa) {
      const graceUntil = new Date(Date.now() + graceDays * 86_400_000);
      await tx.workspaceMember.updateMany({
        where: { workspaceId, mfaGraceUntil: null },
        data: { mfaGraceUntil: graceUntil },
      });
    }

    return ws;
  });

  const meta: Record<string, unknown> = {};
  if (dto.name !== undefined && dto.name !== current.name) { meta.nameFrom = current.name; meta.nameTo = dto.name; }
  if (dto.isPrivate !== undefined && dto.isPrivate !== current.isPrivate) meta.isPrivate = dto.isPrivate;
  if (dto.requireMfa !== undefined && dto.requireMfa !== current.requireMfa) meta.requireMfa = dto.requireMfa;
  await logEvent(workspaceId, userId, 'workspace_updated', 'workspace', workspaceId, meta);

  return updated;
}

// ─── Soft-delete (Trash) ──────────────────────────────────────────────────
// Retention: 10 business days (skip Sat/Sun). After purgeAt expires,
// the background scheduler hard-deletes the workspace via cascade.

const BUSINESS_DAYS_RETENTION = 10;

export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return d;
}

export async function deleteWorkspace(workspaceId: string, userId: string) {
  await assertOwner(workspaceId, userId);

  const purgeAt = addBusinessDays(new Date(), BUSINESS_DAYS_RETENTION);
  const current = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { slug: true },
  });

  // Free the slug by suffixing it; restore reverses this.
  // Original slug is preserved in a sibling field via the meta event log.
  const suffixedSlug = `${current.slug}__deleted_${Date.now()}`;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: new Date(), deletedBy: userId, purgeAt, slug: suffixedSlug },
  });

  await logEvent(workspaceId, userId, 'workspace_soft_deleted', 'workspace', workspaceId, {
    originalSlug: current.slug,
    purgeAt: purgeAt.toISOString(),
  });
}

export async function restoreWorkspace(workspaceId: string, userId: string) {
  const member = await assertMemberIncludingDeleted(workspaceId, userId);
  const ws = member.workspace;
  if (ws.deletedAt === null) throw new AppError(400, 'Workspace is not in trash');
  // Owner check first (clearer semantics); fall back to deletedBy when caller is not Owner.
  if (member.role !== 'OWNER' && ws.deletedBy !== userId) {
    throw new AppError(403, 'Only the workspace owner or the user who deleted it can restore');
  }

  // Strip the __deleted_<13-digit-ts> suffix to restore the original slug.
  const originalSlug = ws.slug.replace(DELETED_SLUG_SUFFIX, '');

  // Resolve slug atomically: try original, then retry with -restored-<ts> on P2002.
  // This closes the find/update race where another workspace claims the slug between
  // the conflict check and the update (TS H-3).
  const tryUpdate = async (candidateSlug: string) =>
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: null, deletedBy: null, purgeAt: null, slug: candidateSlug },
    });

  let restoredSlug = originalSlug;
  try {
    await tryUpdate(originalSlug);
  } catch (err: unknown) {
    // P2002 = unique constraint violation on slug
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'P2002') throw err;
    restoredSlug = `${originalSlug}-restored-${Date.now().toString(36)}`;
    await tryUpdate(restoredSlug);
  }

  await logEvent(workspaceId, userId, 'workspace_restored', 'workspace', workspaceId, {
    slug: restoredSlug,
  });
}

export async function purgeWorkspace(workspaceId: string, userId: string) {
  const member = await assertMemberIncludingDeleted(workspaceId, userId);
  const ws = member.workspace;
  if (ws.deletedAt === null) throw new AppError(400, 'Workspace must be in trash before permanent delete');
  if (member.role !== 'OWNER') throw new AppError(403, 'Only the workspace owner can permanently delete');

  // Write platform-level audit BEFORE cascade delete — WorkspaceEvent rows are erased
  // when the workspace is purged, so internal event log won't survive.
  void auditLog({
    actorId: userId,
    action: 'workspace.purge',
    targetId: workspaceId,
    result: 'SUCCESS',
    meta: { name: ws.name, deletedAt: ws.deletedAt?.toISOString() ?? null },
  });

  // Cascade onDelete will remove boards, tasks, members, workflows, labels, events.
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listTrash(userId: string) {
  // Push the Owner-or-deleter filter into the DB query (avoids fetching irrelevant rows).
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      workspace: { deletedAt: { not: null } },
      OR: [
        { role: 'OWNER' },
        { workspace: { deletedBy: userId } },
      ],
    },
    include: {
      workspace: {
        include: {
          deletedByUser: { select: { id: true, name: true, avatar: true } },
          _count: { select: { boards: true } },
        },
      },
    },
    orderBy: { workspace: { deletedAt: 'desc' } },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug.replace(DELETED_SLUG_SUFFIX, ''),
    description: m.workspace.description,
    deletedAt: m.workspace.deletedAt,
    deletedBy: m.workspace.deletedByUser,
    purgeAt: m.workspace.purgeAt,
    role: m.role,
    boardCount: m.workspace._count.boards,
  }));
}

export async function countTrash(userId: string): Promise<number> {
  // Used by Profile dropdown badge. Filter in DB to avoid full membership fetch.
  return prisma.workspaceMember.count({
    where: {
      userId,
      workspace: { deletedAt: { not: null } },
      OR: [
        { role: 'OWNER' },
        { workspace: { deletedBy: userId } },
      ],
    },
  });
}

/**
 * Background purge: hard-delete workspaces whose purgeAt has passed.
 *
 * Uses deleteMany for atomicity — safe under multi-instance deployments where
 * two scheduler ticks could otherwise race on the same rows (see issue #157 review C-2).
 */
export async function purgeExpired(): Promise<{ purged: number; ids: string[] }> {
  // Fetch IDs first for forensic logging, then deleteMany with the same filter.
  // deleteMany itself is idempotent: a second call simply matches 0 rows.
  const expired = await prisma.workspace.findMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: new Date() } },
    select: { id: true },
  });
  if (expired.length === 0) return { purged: 0, ids: [] };

  const result = await prisma.workspace.deleteMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: new Date() } },
  });
  return { purged: result.count, ids: expired.map(w => w.id) };
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(workspaceId: string, userId: string) {
  await assertMember(workspaceId, userId);

  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function getMfaGraceUntil(workspaceId: string): Promise<Date | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { requireMfa: true, mfaGraceDays: true },
  });
  if (!ws?.requireMfa) return null;
  return new Date(Date.now() + ws.mfaGraceDays * 86_400_000);
}

export async function addMember(workspaceId: string, requesterId: string, dto: AddMemberDto) {
  await assertOwner(workspaceId, requesterId);

  const targetUser = await prisma.user.findUnique({ where: { id: dto.userId } });
  if (!targetUser) throw new AppError(404, 'User not found');

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: dto.userId } },
  });
  if (existing) throw new AppError(409, 'User is already a member');

  const mfaGraceUntil = await getMfaGraceUntil(workspaceId);

  const member = await prisma.workspaceMember.create({
    data: { workspaceId, userId: dto.userId, role: dto.role, mfaGraceUntil },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  emitMemberAddedNotification(workspaceId, dto.userId, requesterId).catch(() => {});
  await logEvent(workspaceId, requesterId, 'member_added', 'member', dto.userId, {
    name: targetUser.name,
    email: targetUser.email,
    role: dto.role,
  });
  return member;
}

export async function updateMemberRole(
  workspaceId: string,
  requesterId: string,
  targetUserId: string,
  dto: UpdateMemberRoleDto,
) {
  await assertOwner(workspaceId, requesterId);

  if (targetUserId === requesterId && dto.role !== 'OWNER') {
    throw new AppError(400, 'Cannot demote yourself. Transfer ownership first.');
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  if (!member) throw new AppError(404, 'Member not found');

  const oldRole = member.role;

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role: dto.role },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  await logEvent(workspaceId, requesterId, 'member_role_changed', 'WorkspaceMember', targetUserId, {
    oldRole,
    newRole: dto.role,
    targetUserId,
  });

  return updated;
}

export async function inviteByEmail(workspaceId: string, requesterId: string, dto: InviteByEmailDto) {
  await assertOwner(workspaceId, requesterId);

  const targetUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!targetUser) throw new AppError(404, 'User not found');

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
  });
  if (existing) throw new AppError(409, 'User is already a member');

  const mfaGraceUntil = await getMfaGraceUntil(workspaceId);

  const member = await prisma.workspaceMember.create({
    data: { workspaceId, userId: targetUser.id, role: dto.role, mfaGraceUntil },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  emitMemberAddedNotification(workspaceId, targetUser.id, requesterId).catch(() => {});

  await logEvent(workspaceId, requesterId, 'member_added', 'member', targetUser.id, {
    name: targetUser.name,
    email: targetUser.email,
    role: dto.role,
  });

  return member;
}

export async function removeMember(workspaceId: string, requesterId: string, targetUserId: string) {
  await assertOwner(workspaceId, requesterId);

  if (targetUserId === requesterId) {
    throw new AppError(400, 'Cannot remove yourself from workspace');
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  if (!member) throw new AppError(404, 'Member not found');

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });

  await logEvent(workspaceId, requesterId, 'member_removed', 'member', targetUserId, {
    name: targetUser?.name,
    email: targetUser?.email,
  });
}

// ─── Member Candidates Search (all users, Owner-only) ────────────────────────

export interface MemberCandidate {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  alreadyMember: boolean;
}

/**
 * Search across ALL active users by name/email substring. Owner-only.
 *
 * Privacy:
 *   - Returns only public-safe fields (id/name/email/avatar/alreadyMember).
 *   - Never exposes isSuperadmin, lastLoginAt, authProvider, isActive, etc.
 *   - Audit log records queryLength and resultCount but NOT the raw query
 *     (the query may contain PII like email fragments or workspace names).
 *   - Rate limit is enforced at the router level (RATE_LIMITS.memberSearch).
 */
export async function searchMemberCandidates(
  workspaceId: string,
  requesterId: string,
  rawQuery: string,
  rawLimit: number,
): Promise<MemberCandidate[]> {
  await assertOwner(workspaceId, requesterId);

  const q = rawQuery.trim();
  if (q.length < CANDIDATE_MIN_QUERY) {
    throw new AppError(400, `Query must be at least ${CANDIDATE_MIN_QUERY} characters`);
  }
  const limit = Math.min(Math.max(1, rawLimit), CANDIDATE_LIMIT_MAX);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, avatar: true },
    take: limit,
    orderBy: [{ name: 'asc' }],
  });

  let memberSet = new Set<string>();
  if (users.length > 0) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: users.map((u) => u.id) } },
      select: { userId: true },
    });
    memberSet = new Set(memberships.map((m) => m.userId));
  }

  // Audit log: observability path.
  // DO NOT add raw `q`, partial query, email or any user-supplied text into
  // meta — it may contain PII (workspace names, partial emails). Only safe
  // numeric metadata is allowed here. See docs/design/workspace-member-picker.md §5.
  // Awaiting ensures deterministic test ordering; the auditLog implementation
  // catches its own errors so this can never break the response.
  await auditLog({
    actorId: requesterId,
    action: 'member.candidates.search',
    targetId: workspaceId,
    result: 'SUCCESS',
    meta: { queryLength: q.length, resultCount: users.length },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    alreadyMember: memberSet.has(u.id),
  }));
}

// ─── Member Search (legacy, within workspace) ────────────────────────────────

/**
 * Search WITHIN existing workspace members. Membership-gated — only callers
 * who are members of the workspace can use this.
 *
 * Security review (G7) flagged that this used to be open to any authenticated
 * user with a valid workspace ID. assertMember now closes that gap.
 */
export async function searchMembers(workspaceId: string, requesterId: string, query: string) {
  await assertMember(workspaceId, requesterId);

  const q = query.trim();
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      ...(q && {
        user: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      }),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
  return members.map(m => m.user);
}

// ─── Workspace History ────────────────────────────────────────────────────────

export async function getWorkspaceHistory(
  workspaceId: string,
  userId: string,
  limit = 50,
  offset = 0,
) {
  await assertOwner(workspaceId, userId);

  const where = { workspaceId };
  const [events, total] = await prisma.$transaction([
    prisma.workspaceEvent.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.workspaceEvent.count({ where }),
  ]);
  return { events, total };
}
