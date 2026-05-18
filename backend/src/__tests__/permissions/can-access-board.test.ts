import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for canAccessBoard() — algorithm spec: board-acl.md §4
 *
 * Rules (in order):
 *   0a. superadmin → { allowed: true, role: 'system:admin', source: 'superadmin' }
 *   0b. workspace.deletedAt !== null → { allowed: false }
 *   0c. user not WorkspaceMember → { allowed: false }
 *   1.  workspace owner (regardless of BoardMember) → allowed, source: 'workspace-owner'
 *   2.  BoardMember with rolePresetId=null → { allowed: false } (explicit DENY)
 *   3.  BoardMember with rolePresetId set → allowed, source: 'board-override', role: that preset
 *   4.  isGuest=true and no BoardMember → { allowed: false } (guest blocked from public defaults)
 *   5.  board.isPrivate=true and no BoardMember → { allowed: false }
 *   6.  public board, member → allowed, source: 'workspace', role: workspace role
 */

vi.mock('../../prisma/client.js', () => ({ prisma: {} }));
vi.mock('../../shared/utils/permissions-cache.js', () => ({
  getBoardAccessContext: vi.fn(),
}));

import { canAccessBoard } from '../../shared/utils/permissions.js';
import { getBoardAccessContext } from '../../shared/utils/permissions-cache.js';

const mockedGet = vi.mocked(getBoardAccessContext);

type Args = {
  isSuperadmin?: boolean;
  workspaceDeletedAt?: string | null;
  isWorkspaceMember?: boolean;
  isWorkspaceOwner?: boolean;
  workspaceRolePresetId?: string | null;
  isGuest?: boolean;
  boardIsPrivate?: boolean;
  boardMember?: { rolePresetId: string | null } | null;
};

function ctx(args: Args) {
  return {
    isSuperadmin: args.isSuperadmin ?? false,
    workspaceId: 'ws-test',
    workspaceDeletedAt: args.workspaceDeletedAt ?? null,
    isWorkspaceMember: args.isWorkspaceMember ?? true,
    isWorkspaceOwner: args.isWorkspaceOwner ?? false,
    workspaceRolePresetId: args.workspaceRolePresetId ?? 'system:member',
    isGuest: args.isGuest ?? false,
    boardIsPrivate: args.boardIsPrivate ?? false,
    boardMember: args.boardMember ?? null,
  };
}

beforeEach(() => mockedGet.mockReset());

describe('canAccessBoard — rule 0a: superadmin', () => {
  it('superadmin sees any board, even with denied BoardMember and deleted workspace', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        isSuperadmin: true,
        workspaceDeletedAt: '2026-01-01',
        isWorkspaceMember: false,
        boardMember: { rolePresetId: null },
      }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('superadmin');
  });
});

describe('canAccessBoard — rule 0b: soft-deleted workspace', () => {
  it('blocks access when workspace.deletedAt is set', async () => {
    mockedGet.mockResolvedValue(ctx({ workspaceDeletedAt: '2026-01-01' }));
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(false);
  });
});

describe('canAccessBoard — rule 0c: not a workspace member', () => {
  it('blocks when user is not in WorkspaceMember', async () => {
    mockedGet.mockResolvedValue(ctx({ isWorkspaceMember: false }));
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(false);
  });
});

describe('canAccessBoard — rule 1: workspace owner always wins', () => {
  it('owner has access even with BoardMember denied', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        isWorkspaceOwner: true,
        workspaceRolePresetId: 'system:owner',
        boardMember: { rolePresetId: null },
      }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('workspace-owner');
  });

  it('owner has access to private board without BoardMember entry', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        isWorkspaceOwner: true,
        workspaceRolePresetId: 'system:owner',
        boardIsPrivate: true,
        boardMember: null,
      }),
    );
    expect((await canAccessBoard('u1', 'b1')).allowed).toBe(true);
  });
});

describe('canAccessBoard — rule 2: explicit DENY', () => {
  it('BoardMember.rolePresetId=null blocks a non-owner member', async () => {
    mockedGet.mockResolvedValue(ctx({ boardMember: { rolePresetId: null } }));
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(false);
  });
});

describe('canAccessBoard — rule 3: per-board OVERRIDE', () => {
  it('viewer in workspace with board-override member gets member access on that board', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        workspaceRolePresetId: 'system:viewer',
        boardMember: { rolePresetId: 'system:member' },
      }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('board-override');
    expect(result.role).toBe('system:member');
  });

  it('member in workspace with board-override viewer gets viewer access on that board', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        workspaceRolePresetId: 'system:member',
        boardMember: { rolePresetId: 'system:viewer' },
      }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.role).toBe('system:viewer');
  });
});

describe('canAccessBoard — rule 4: guest without explicit BoardMember', () => {
  it('guest cannot see public board without BoardMember', async () => {
    mockedGet.mockResolvedValue(
      ctx({ isGuest: true, boardIsPrivate: false, boardMember: null }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(false);
  });

  it('guest with explicit BoardMember gets access via rule 3', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        isGuest: true,
        boardMember: { rolePresetId: 'system:member' },
      }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('board-override');
  });
});

describe('canAccessBoard — rule 5: private board without BoardMember', () => {
  it('non-owner member sees no access to private without BoardMember', async () => {
    mockedGet.mockResolvedValue(
      ctx({ boardIsPrivate: true, boardMember: null }),
    );
    expect((await canAccessBoard('u1', 'b1')).allowed).toBe(false);
  });
});

describe('canAccessBoard — rule 6: public board uses workspace role', () => {
  it('public board, no override → workspace role applies', async () => {
    mockedGet.mockResolvedValue(
      ctx({ workspaceRolePresetId: 'system:member', boardIsPrivate: false, boardMember: null }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('workspace');
    expect(result.role).toBe('system:member');
  });

  it('public board with viewer workspace role → access as viewer', async () => {
    mockedGet.mockResolvedValue(
      ctx({ workspaceRolePresetId: 'system:viewer', boardIsPrivate: false }),
    );
    const result = await canAccessBoard('u1', 'b1');
    expect(result.allowed).toBe(true);
    expect(result.role).toBe('system:viewer');
  });
});

describe('canAccessBoard — rule precedence', () => {
  it('rule 1 (owner) beats rule 2 (denied) — owner cannot be banned', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        isWorkspaceOwner: true,
        workspaceRolePresetId: 'system:owner',
        boardMember: { rolePresetId: null },
      }),
    );
    expect((await canAccessBoard('u1', 'b1')).source).toBe('workspace-owner');
  });

  it('rule 2 (denied) beats rule 4 (guest) — explicit DENY wins over guest fallback', async () => {
    mockedGet.mockResolvedValue(
      ctx({ isGuest: true, boardMember: { rolePresetId: null } }),
    );
    expect((await canAccessBoard('u1', 'b1')).allowed).toBe(false);
  });

  it('rule 3 (override) beats rule 5 (private) — override grants access to private', async () => {
    mockedGet.mockResolvedValue(
      ctx({
        boardIsPrivate: true,
        boardMember: { rolePresetId: 'system:member' },
      }),
    );
    expect((await canAccessBoard('u1', 'b1')).allowed).toBe(true);
  });
});
