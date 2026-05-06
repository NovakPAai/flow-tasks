import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createDefaultWorkflow } from '../workflows/workflows.service.js';
import type { CreateWorkspaceDto, UpdateWorkspaceDto, AddMemberDto, UpdateMemberRoleDto, InviteByEmailDto } from './workspaces.dto.js';

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
  });
  if (!member) throw new AppError(403, 'Access denied');
  return member;
}

async function assertOwner(workspaceId: string, userId: string) {
  const member = await assertMember(workspaceId, userId);
  if (member.role !== 'OWNER') throw new AppError(403, 'Only workspace owners can perform this action');
  return member;
}

// ─── Workspace CRUD ──────────────────────────────────────────────────────────

export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
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
    }));
}

export async function createWorkspace(userId: string, dto: CreateWorkspaceDto) {
  const slugExists = await prisma.workspace.findUnique({ where: { slug: dto.slug } });
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

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: dto,
  });

  await logEvent(workspaceId, userId, 'workspace_updated', 'workspace', workspaceId, dto as Record<string, unknown>);

  return updated;
}

export async function deleteWorkspace(workspaceId: string, userId: string) {
  await assertOwner(workspaceId, userId);
  await prisma.workspace.delete({ where: { id: workspaceId } });
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

export async function addMember(workspaceId: string, requesterId: string, dto: AddMemberDto) {
  await assertOwner(workspaceId, requesterId);

  const targetUser = await prisma.user.findUnique({ where: { id: dto.userId } });
  if (!targetUser) throw new AppError(404, 'User not found');

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: dto.userId } },
  });
  if (existing) throw new AppError(409, 'User is already a member');

  return prisma.workspaceMember.create({
    data: { workspaceId, userId: dto.userId, role: dto.role },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
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

  return prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role: dto.role },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
}

export async function inviteByEmail(workspaceId: string, requesterId: string, dto: InviteByEmailDto) {
  await assertOwner(workspaceId, requesterId);

  const targetUser = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!targetUser) throw new AppError(404, 'User not found');

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
  });
  if (existing) throw new AppError(409, 'User is already a member');

  const member = await prisma.workspaceMember.create({
    data: { workspaceId, userId: targetUser.id, role: dto.role },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

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

// ─── Member Search ───────────────────────────────────────────────────────────

export async function searchMembers(workspaceId: string, query: string) {
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
