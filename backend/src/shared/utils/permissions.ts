/**
 * Permission engine — pure algorithm functions.
 *
 * Spec: docs/design/feature-permissions.md §5 (isAllowed)
 *       docs/design/board-acl.md §4 (canAccessBoard)
 *
 * DB access happens via permissions-cache.ts. This module orchestrates the
 * decision logic in a side-effect-free way.
 */

import {
  getPermissionContext,
  getBoardAccessContext,
  type PermissionContext,
  type BoardAccessContext,
} from './permissions-cache.js';
import { loadPresetPermissions } from './permissions-loader.js';

// ─── Permission code domain ──────────────────────────────────────────────────

import type { PermissionCode as PrismaPermissionCode } from '@prisma/client';
export type PermissionCode = PrismaPermissionCode;

/**
 * Workspace-level feature codes that gate certain permissions.
 * See feature-permissions.md §3 (Level 2) and plan.md Step 1.3.
 */
const FEATURE_CODE_BY_PERMISSION: Record<string, string> = {
  // WS_COMMENTS
  COMMENT_READ: 'WS_COMMENTS',
  COMMENT_CREATE: 'WS_COMMENTS',
  COMMENT_UPDATE_OWN: 'WS_COMMENTS',
  COMMENT_DELETE_OWN: 'WS_COMMENTS',
  COMMENT_DELETE_ANY: 'WS_COMMENTS',

  // WS_CHECKLISTS
  CHECKLIST_READ: 'WS_CHECKLISTS',
  CHECKLIST_WRITE: 'WS_CHECKLISTS',

  // WS_LABELS
  LABEL_READ: 'WS_LABELS',
  LABEL_CREATE: 'WS_LABELS',
  LABEL_UPDATE: 'WS_LABELS',
  LABEL_DELETE: 'WS_LABELS',

  // WS_BULK_OPS
  TASK_BULK_EDIT: 'WS_BULK_OPS',

  // WS_EXPORT
  TASK_EXPORT: 'WS_EXPORT',

  // WS_HISTORY_UI — UI gate only; API remains open by design (plan §Open Q5)
  HISTORY_READ: 'WS_HISTORY_UI',
};

/**
 * Maps a PermissionCode to the FeatureCode that gates it, or null if the
 * permission is part of the core product (always available) or describes a
 * feature toggle itself.
 */
export function deriveFeatureCode(permission: PermissionCode): string | null {
  return FEATURE_CODE_BY_PERMISSION[permission] ?? null;
}

// ─── isAllowed ───────────────────────────────────────────────────────────────

export interface IsAllowedOptions {
  /**
   * Override the role permission set used in rule 5. When set, rule 5 uses
   * this set exclusively and rule 6 (global role fallback) is skipped — this
   * is the strict scoping required by per-board overrides. Callers obtain
   * the set from loadPresetPermissions().
   */
  withRolePermissions?: ReadonlySet<string>;
}

/**
 * Returns true iff the user is allowed to perform `permission` in the
 * given workspace context. workspaceId=null means a global / cross-workspace
 * check (e.g. admin endpoints).
 */
export async function isAllowed(
  userId: string,
  workspaceId: string | null,
  permission: PermissionCode,
  opts: IsAllowedOptions = {},
): Promise<boolean> {
  const ctx = await getPermissionContext(userId, workspaceId);
  return decide(ctx, workspaceId, permission, opts);
}

function decide(
  ctx: PermissionContext,
  workspaceId: string | null,
  permission: PermissionCode,
  opts: IsAllowedOptions,
): boolean {
  // Rule 0: superadmin shortcut — only for ADMIN_* permissions. Other
  //          permissions still go through the regular flow so RBAC-debug
  //          tooling can detect misconfigured admin roles.
  if (ctx.isSuperadmin && permission.startsWith('ADMIN_')) return true;

  const featureCode = deriveFeatureCode(permission);

  // Rule 1: system feature disabled
  if (featureCode && ctx.systemFeatures[featureCode] === false) return false;

  // Rule 2: workspace feature disabled
  if (workspaceId && featureCode && ctx.workspaceFeatures[featureCode] === false) {
    return false;
  }

  // Rule 3: explicit REVOKE wins over GRANT and roles
  if (workspaceId && ctx.revokes.has(`WS:${permission}`)) return false;
  if (ctx.revokes.has(`GLOBAL:${permission}`)) return false;

  // Rule 4: explicit GRANT
  if (workspaceId && ctx.grants.has(`WS:${permission}`)) return true;
  if (ctx.grants.has(`GLOBAL:${permission}`)) return true;

  // Rule 5: workspace role preset (or per-board override).
  // When withRolePermissions is set we are evaluating a per-board override —
  // rule 5 uses that set exclusively and rule 6 (global fallback) is skipped.
  // This is the strict scoping per board-acl SDD §4 (HIGH-1, code-review.md).
  if (opts.withRolePermissions !== undefined) {
    return opts.withRolePermissions.has(permission);
  }

  if (ctx.workspaceRolePermissions.has(permission)) return true;

  // Rule 6: global role preset fallback (only when no per-board override is in play)
  if (ctx.globalRolePermissions.has(permission)) return true;

  return false;
}

// Export decide() so unit tests can hit the algorithm directly without async
// mocking ceremony. Not used by production callers.
export const __decideForTests = decide;

// ─── canAccessBoard ──────────────────────────────────────────────────────────

export type BoardAccessSource =
  | 'superadmin'
  | 'workspace-owner'
  | 'workspace'
  | 'board-override'
  | 'denied';

export interface BoardAccessResult {
  allowed: boolean;
  /** The effective role preset id under which this access is granted. */
  role: string | null;
  source: BoardAccessSource;
  /** The workspaceId of the board — surfaced so callers avoid a second board fetch (H2). */
  workspaceId: string | null;
}

export async function canAccessBoard(
  userId: string,
  boardId: string,
): Promise<BoardAccessResult> {
  const ctx = await getBoardAccessContext(userId, boardId);
  return decideBoardAccess(ctx);
}

function decideBoardAccess(ctx: BoardAccessContext): BoardAccessResult {
  const wsId = ctx.workspaceId;

  // 0a: superadmin
  if (ctx.isSuperadmin) {
    return { allowed: true, role: 'system:admin', source: 'superadmin', workspaceId: wsId };
  }

  // 0b: soft-deleted workspace
  if (ctx.workspaceDeletedAt !== null) {
    return { allowed: false, role: null, source: 'denied', workspaceId: wsId };
  }

  // 0c: user must be a workspace member
  if (!ctx.isWorkspaceMember) {
    return { allowed: false, role: null, source: 'denied', workspaceId: wsId };
  }

  // 1: workspace owner is never blocked (cannot be denied or guestified)
  if (ctx.isWorkspaceOwner) {
    return {
      allowed: true,
      role: ctx.workspaceRolePresetId,
      source: 'workspace-owner',
      workspaceId: wsId,
    };
  }

  // 2: explicit per-board DENY
  if (ctx.boardMember && ctx.boardMember.rolePresetId === null) {
    return { allowed: false, role: null, source: 'denied', workspaceId: wsId };
  }

  // 3: explicit per-board OVERRIDE
  if (ctx.boardMember && ctx.boardMember.rolePresetId !== null) {
    return {
      allowed: true,
      role: ctx.boardMember.rolePresetId,
      source: 'board-override',
      workspaceId: wsId,
    };
  }

  // 4: guest without an explicit BoardMember entry — even public boards stay hidden
  if (ctx.isGuest) {
    return { allowed: false, role: null, source: 'denied', workspaceId: wsId };
  }

  // 5: private board without an explicit BoardMember entry
  if (ctx.boardIsPrivate) {
    return { allowed: false, role: null, source: 'denied', workspaceId: wsId };
  }

  // 6: public board, fall back to workspace role
  return {
    allowed: true,
    role: ctx.workspaceRolePresetId,
    source: 'workspace',
    workspaceId: wsId,
  };
}

// ─── canActOnBoard ───────────────────────────────────────────────────────────

export async function canActOnBoard(
  userId: string,
  boardId: string,
  permission: PermissionCode,
  workspaceId: string,
): Promise<boolean> {
  const access = await canAccessBoard(userId, boardId);
  if (!access.allowed) return false;

  // Only the explicit per-board override changes scope. Workspace-owner and
  // workspace (default) keep the regular role-fallback semantics, while
  // superadmin reaches Rule 0a inside isAllowed for ADMIN_* permissions.
  if (access.source === 'board-override' && access.role) {
    const overridePermissions = await loadPresetPermissions(access.role);
    return isAllowed(userId, workspaceId, permission, {
      withRolePermissions: overridePermissions,
    });
  }
  return isAllowed(userId, workspaceId, permission);
}
