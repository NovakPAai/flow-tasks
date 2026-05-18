import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for isAllowed() — algorithm spec: feature-permissions.md §5
 *
 * Algorithm rules (in order):
 *   0a. superadmin + permission starts with "ADMIN_" → true
 *   0b. superadmin + non-admin permission → continues normal flow (fallback only for ADMIN_*)
 *   1.  system feature disabled (per deriveFeatureCode) → false
 *   2.  workspace feature disabled (when workspaceId given) → false
 *   3.  explicit REVOKE on (user, workspace) → false
 *   3b. explicit REVOKE on (user, null=global) → false
 *   4.  explicit GRANT on (user, workspace) → true (and feature is enabled, see rules 1-2)
 *   4b. explicit GRANT on (user, null=global) → true
 *   5.  permission present in workspace member's RolePreset → true
 *   6.  permission present in user's globalRolePreset → true
 *   default: false
 *
 * Strategy: mock the underlying Prisma fetcher (getEffectivePermissions) so we test
 * the algorithm in isolation. The aggregate query lives in cache.ts and is tested separately.
 */

vi.mock('../../prisma/client.js', () => ({ prisma: {} }));
vi.mock('../../shared/utils/permissions-cache.js', () => ({
  getPermissionContext: vi.fn(),
  invalidateUser: vi.fn(),
  invalidateWorkspace: vi.fn(),
  invalidateSystem: vi.fn(),
}));

import { isAllowed } from '../../shared/utils/permissions.js';
import { getPermissionContext } from '../../shared/utils/permissions-cache.js';

const mockedGet = vi.mocked(getPermissionContext);

function makeCtx(overrides: Partial<NonNullable<Awaited<ReturnType<typeof getPermissionContext>>>> = {}) {
  return {
    isSuperadmin: false,
    isGuest: false,
    workspaceRolePermissions: new Set<string>(),
    globalRolePermissions: new Set<string>(),
    grants: new Set<string>(),    // "WS:perm" or "GLOBAL:perm"
    revokes: new Set<string>(),
    systemFeatures: {
      LOCAL_REGISTRATION: true, SSO: true, MFA: true, EMAIL_NOTIFICATIONS: true,
      FEEDBACK_WIDGET: true, API_KEYS: true, GLOBAL_SEARCH: true, REGISTRATION_REQUESTS: true,
      WS_COMMENTS: true, WS_CHECKLISTS: true, WS_LABELS: true, WS_MENTIONS: true,
      WS_BULK_OPS: true, WS_EXPORT: true, WS_TRASH: true, WS_HISTORY_UI: true,
      WS_ONBOARDING_TOUR: true,
    },
    workspaceFeatures: {},
    permissionsRev: 0,
    systemRev: 0,
    ...overrides,
  } satisfies Awaited<ReturnType<typeof getPermissionContext>>;
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe('isAllowed — rule 0: superadmin shortcut for ADMIN_*', () => {
  it('superadmin always passes ADMIN_USERS regardless of role', async () => {
    mockedGet.mockResolvedValue(makeCtx({ isSuperadmin: true }));
    expect(await isAllowed('u1', null, 'ADMIN_USERS')).toBe(true);
  });

  it('superadmin always passes ADMIN_ROLES even with no role preset', async () => {
    mockedGet.mockResolvedValue(makeCtx({ isSuperadmin: true }));
    expect(await isAllowed('u1', null, 'ADMIN_ROLES')).toBe(true);
  });

  it('superadmin without TASK_DELETE in any role → falls through and returns false', async () => {
    mockedGet.mockResolvedValue(makeCtx({ isSuperadmin: true }));
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(false);
  });

  it('superadmin with TASK_DELETE via global role → true', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({ isSuperadmin: true, globalRolePermissions: new Set(['TASK_DELETE']) }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(true);
  });
});

describe('isAllowed — rule 1: system feature off blocks gated permissions', () => {
  it('WS_COMMENTS system-off blocks COMMENT_CREATE everywhere', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        systemFeatures: { ...makeCtxDefaults().systemFeatures, WS_COMMENTS: false },
        workspaceRolePermissions: new Set(['COMMENT_CREATE']),
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'COMMENT_CREATE')).toBe(false);
  });

  it('core permission (TASK_READ) is not affected by system feature toggles', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        workspaceRolePermissions: new Set(['TASK_READ']),
        systemFeatures: { ...makeCtxDefaults().systemFeatures, FEEDBACK_WIDGET: false },
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_READ')).toBe(true);
  });
});

describe('isAllowed — rule 2: workspace feature off', () => {
  it('WS_COMMENTS off in workspace blocks COMMENT_CREATE there', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        workspaceRolePermissions: new Set(['COMMENT_CREATE']),
        workspaceFeatures: { WS_COMMENTS: false },
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'COMMENT_CREATE')).toBe(false);
  });

  it('WS_LABELS off blocks LABEL_CREATE even with explicit GRANT override', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        grants: new Set(['WS:LABEL_CREATE']),
        workspaceFeatures: { WS_LABELS: false },
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'LABEL_CREATE')).toBe(false);
  });

  it('workspace feature gate is skipped when workspaceId is null', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        globalRolePermissions: new Set(['COMMENT_READ']),
        workspaceFeatures: { WS_COMMENTS: false },
      }),
    );
    expect(await isAllowed('u1', null, 'COMMENT_READ')).toBe(true);
  });
});

describe('isAllowed — rules 3 & 3b: explicit REVOKE wins', () => {
  it('workspace REVOKE blocks even if role grants permission', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        workspaceRolePermissions: new Set(['TASK_DELETE']),
        revokes: new Set(['WS:TASK_DELETE']),
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(false);
  });

  it('global REVOKE blocks across all workspaces', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        globalRolePermissions: new Set(['TASK_DELETE']),
        revokes: new Set(['GLOBAL:TASK_DELETE']),
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(false);
  });

  it('REVOKE beats GRANT on same scope', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        grants: new Set(['WS:TASK_DELETE']),
        revokes: new Set(['WS:TASK_DELETE']),
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(false);
  });

  it('workspace REVOKE does NOT affect another workspace', async () => {
    mockedGet.mockResolvedValueOnce(
      makeCtx({
        workspaceRolePermissions: new Set(['TASK_DELETE']),
        revokes: new Set([]),
      }),
    );
    expect(await isAllowed('u1', 'ws-other', 'TASK_DELETE')).toBe(true);
  });
});

describe('isAllowed — rules 4 & 4b: explicit GRANT', () => {
  it('workspace GRANT enables permission not in role', async () => {
    mockedGet.mockResolvedValue(makeCtx({ grants: new Set(['WS:TASK_DELETE']) }));
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(true);
  });

  it('global GRANT enables permission across workspaces', async () => {
    mockedGet.mockResolvedValue(makeCtx({ grants: new Set(['GLOBAL:TASK_DELETE']) }));
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(true);
    expect(await isAllowed('u1', 'ws2', 'TASK_DELETE')).toBe(true);
  });
});

describe('isAllowed — rule 5: workspace role preset', () => {
  it('permission in workspace role → true', async () => {
    mockedGet.mockResolvedValue(makeCtx({ workspaceRolePermissions: new Set(['TASK_CREATE']) }));
    expect(await isAllowed('u1', 'ws1', 'TASK_CREATE')).toBe(true);
  });

  it('permission missing from workspace role → falls through', async () => {
    mockedGet.mockResolvedValue(makeCtx({ workspaceRolePermissions: new Set(['TASK_READ']) }));
    expect(await isAllowed('u1', 'ws1', 'TASK_DELETE')).toBe(false);
  });
});

describe('isAllowed — rule 6: global role preset fallback', () => {
  it('permission in global role applies when workspace role does not have it', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        workspaceRolePermissions: new Set([]),
        globalRolePermissions: new Set(['TASK_READ']),
      }),
    );
    expect(await isAllowed('u1', 'ws1', 'TASK_READ')).toBe(true);
  });

  it('global role works when workspaceId is null', async () => {
    mockedGet.mockResolvedValue(makeCtx({ globalRolePermissions: new Set(['ADMIN_AUDIT']) }));
    expect(await isAllowed('u1', null, 'ADMIN_AUDIT')).toBe(true);
  });
});

describe('isAllowed — default deny', () => {
  it('no role, no override, no superadmin → false', async () => {
    mockedGet.mockResolvedValue(makeCtx());
    expect(await isAllowed('u1', 'ws1', 'TASK_READ')).toBe(false);
  });

  it('user has only unrelated permissions → false for requested', async () => {
    mockedGet.mockResolvedValue(makeCtx({ workspaceRolePermissions: new Set(['LABEL_READ']) }));
    expect(await isAllowed('u1', 'ws1', 'BOARD_DELETE')).toBe(false);
  });
});

describe('isAllowed — opts.withRolePermissions (board override scope)', () => {
  it('withRolePermissions replaces the workspace role permissions used in rule 5', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({ workspaceRolePermissions: new Set(['TASK_READ']) }),
    );
    expect(
      await isAllowed('u1', 'ws1', 'TASK_CREATE', {
        withRolePermissions: new Set(['TASK_READ', 'TASK_CREATE', 'TASK_UPDATE']),
      }),
    ).toBe(true);
  });

  it('withRolePermissions does NOT fall through to global role (HIGH-1 fail-closed)', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({
        workspaceRolePermissions: new Set(['TASK_DELETE']),
        globalRolePermissions: new Set(['ADMIN_AUDIT']),
      }),
    );
    // Board-override scopes the role strictly — global ADMIN_AUDIT does not apply on this board.
    expect(
      await isAllowed('u1', 'ws1', 'ADMIN_AUDIT', {
        withRolePermissions: new Set(['TASK_READ']),
      }),
    ).toBe(false);
  });

  it('Empty withRolePermissions denies everything except superadmin and explicit grants', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({ globalRolePermissions: new Set(['TASK_READ']) }),
    );
    expect(
      await isAllowed('u1', 'ws1', 'TASK_READ', {
        withRolePermissions: new Set(),
      }),
    ).toBe(false);
  });

  it('Rule 4 GRANT still wins over withRolePermissions — explicit grant survives board scope', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({ grants: new Set(['WS:TASK_DELETE']) }),
    );
    expect(
      await isAllowed('u1', 'ws1', 'TASK_DELETE', {
        withRolePermissions: new Set(['TASK_READ']),
      }),
    ).toBe(true);
  });

  it('Rule 3 REVOKE still wins over withRolePermissions', async () => {
    mockedGet.mockResolvedValue(
      makeCtx({ revokes: new Set(['WS:TASK_DELETE']) }),
    );
    expect(
      await isAllowed('u1', 'ws1', 'TASK_DELETE', {
        withRolePermissions: new Set(['TASK_DELETE']),
      }),
    ).toBe(false);
  });
});

// helper used inside the describe blocks (defined here, hoisted)
function makeCtxDefaults() {
  return makeCtx();
}
