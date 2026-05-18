/**
 * DB layer for permission context. Isolated from the cache so unit tests can
 * mock this single module.
 *
 * The single SQL aggregate query is intentionally untyped at the
 * Prisma level — we fan out parallel `findMany` calls because Prisma's typed
 * API gives readable code and the cache layer means the cost is paid at most
 * once per (user, workspace, rev) window.
 *
 * See plan.md §Caching strategy.
 */

import { prisma } from '../../prisma/client.js';
import type { PermissionContext, BoardAccessContext } from './permissions-cache.js';

/**
 * Load the permission set for a single role preset.
 *
 * Used by canActOnBoard to scope rule 5 to a per-board override. Tiny query
 * (one preset, ~40 rows max) so we leave caching to a higher layer for now.
 */
export async function loadPresetPermissions(presetId: string): Promise<ReadonlySet<string>> {
  const rows = await prisma.rolePermission.findMany({
    where: { presetId },
    select: { permission: true },
  });
  return new Set(rows.map((r) => r.permission as string));
}

const SYSTEM_OWNER = 'system:owner';

/**
 * Loads everything the permission engine needs in a single round-trip-ish
 * fetch. Currently uses 4–7 Prisma queries in parallel; can be replaced with
 * a single `prisma.$queryRaw` once Phase 2 deployment confirms p95 budget.
 */
export async function loadPermissionContextFromDb(
  userId: string,
  workspaceId: string | null,
): Promise<PermissionContext> {
  const userP = prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperadmin: true,
      permissionsRev: true,
      globalRolePresetId: true,
      globalRolePreset: { select: { permissions: { select: { permission: true } } } },
    },
  });
  const wsMemberP = workspaceId
    ? prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: {
          isGuest: true,
          rolePresetId: true,
          rolePreset: { select: { name: true, permissions: { select: { permission: true } } } },
        },
      })
    : Promise.resolve(null);
  const systemFeaturesP = prisma.systemFeature.findMany({
    select: { code: true, enabled: true },
  });
  const workspaceFeaturesP = workspaceId
    ? prisma.workspaceFeature.findMany({
        where: { workspaceId },
        select: { code: true, enabled: true },
      })
    : Promise.resolve([]);
  const overridesP = prisma.userPermission.findMany({
    where: {
      userId,
      OR: [{ workspaceId: null }, ...(workspaceId ? [{ workspaceId }] : [])],
    },
    select: { permission: true, type: true, workspaceId: true },
  });
  const systemRevP = prisma.systemFeature.aggregate({ _max: { updatedAt: true } });

  const [user, wsMember, systemFeatures, workspaceFeatures, overrides, systemRevAgg] =
    await Promise.all([userP, wsMemberP, systemFeaturesP, workspaceFeaturesP, overridesP, systemRevP]);

  if (!user) {
    return emptyContext();
  }

  const grants = new Set<string>();
  const revokes = new Set<string>();
  for (const o of overrides) {
    const scope = o.workspaceId ? 'WS' : 'GLOBAL';
    const key = `${scope}:${o.permission}`;
    (o.type === 'GRANT' ? grants : revokes).add(key);
  }

  return {
    isSuperadmin: user.isSuperadmin,
    isGuest: wsMember?.isGuest ?? false,
    workspaceRolePermissions: new Set(
      wsMember?.rolePreset?.permissions.map((p) => p.permission as string) ?? [],
    ),
    globalRolePermissions: new Set(
      user.globalRolePreset?.permissions.map((p) => p.permission as string) ?? [],
    ),
    grants,
    revokes,
    systemFeatures: Object.fromEntries(systemFeatures.map((f) => [f.code, f.enabled])),
    workspaceFeatures: Object.fromEntries(workspaceFeatures.map((f) => [f.code, f.enabled])),
    permissionsRev: user.permissionsRev,
    systemRev: systemRevAgg._max.updatedAt?.getTime() ?? 0,
  };
}

export async function loadBoardAccessContextFromDb(
  userId: string,
  boardId: string,
): Promise<BoardAccessContext> {
  const [user, board] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isSuperadmin: true } }),
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        isPrivate: true,
        workspaceId: true,
        workspace: { select: { deletedAt: true } },
      },
    }),
  ]);

  if (!board || !user) {
    return {
      isSuperadmin: user?.isSuperadmin ?? false,
      // Board not found: conservative default — treat as private and unknown ws.
      // canAccessBoard will deny based on rule 0c (not workspace member).
      workspaceId: board?.workspaceId ?? '',
      workspaceDeletedAt: null,
      isWorkspaceMember: false,
      isWorkspaceOwner: false,
      workspaceRolePresetId: null,
      isGuest: false,
      boardIsPrivate: true,
      boardMember: null,
    };
  }

  const [wsMember, boardMember] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
      select: {
        isGuest: true,
        rolePresetId: true,
        rolePreset: { select: { name: true } },
      },
    }),
    prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { rolePresetId: true },
    }),
  ]);

  return {
    isSuperadmin: user.isSuperadmin,
    workspaceId: board.workspaceId,
    workspaceDeletedAt: board.workspace.deletedAt
      ? board.workspace.deletedAt.toISOString()
      : null,
    isWorkspaceMember: wsMember !== null,
    isWorkspaceOwner: wsMember?.rolePreset?.name === SYSTEM_OWNER,
    workspaceRolePresetId: wsMember?.rolePresetId ?? null,
    isGuest: wsMember?.isGuest ?? false,
    boardIsPrivate: board.isPrivate,
    boardMember,
  };
}

function emptyContext(): PermissionContext {
  return {
    isSuperadmin: false,
    isGuest: false,
    workspaceRolePermissions: new Set(),
    globalRolePermissions: new Set(),
    grants: new Set(),
    revokes: new Set(),
    systemFeatures: {},
    workspaceFeatures: {},
    permissionsRev: 0,
    systemRev: 0,
  };
}
