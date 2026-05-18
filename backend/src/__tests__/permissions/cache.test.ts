import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for permissions-cache.ts — see plan.md §Caching strategy.
 *
 * The cache stores a "permission context" object — the aggregate of system features,
 * workspace features, role permissions, grants, revokes, and metadata — keyed by
 * (userId, workspaceId, permissionsRev, systemRev). A new permissionsRev or systemRev
 * counts as a fresh key, so older entries naturally evict from the LRU.
 *
 * Tested behaviors:
 *   - hit: same (user, ws, rev) returns cached value, no DB call
 *   - miss after permissionsRev increment: re-queries
 *   - miss after systemRev increment: re-queries
 *   - bypass via fresh=true: always re-queries, no cache write
 *   - bulk workspace feature change invalidates all members
 *   - independent users do not share entries
 */

const fetchFromDb = vi.fn();

vi.mock('../../prisma/client.js', () => ({ prisma: {} }));

vi.mock('../../shared/utils/permissions-loader.js', () => ({
  loadPermissionContextFromDb: (...args: unknown[]) => fetchFromDb(...args),
  loadBoardAccessContextFromDb: vi.fn(),
}));

// Sentinel marker added to mock results so individual mockResolvedValueOnce
// calls can be distinguished. Not part of the production PermissionContext shape.
type MockContext = { permissionsRev: number; systemRev: number; marker: string };
const readMarker = (ctx: unknown): string => (ctx as MockContext).marker;

import {
  getPermissionContext,
  invalidateUser,
  invalidateWorkspace,
  invalidateSystem,
  __clearCacheForTests,
} from '../../shared/utils/permissions-cache.js';

beforeEach(() => {
  fetchFromDb.mockReset();
  __clearCacheForTests();
});

describe('permissions-cache — basic hit/miss', () => {
  it('returns cached value on second call with same key', async () => {
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'v1' });
    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u1', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(1);
  });

  it('different users do not share cache', async () => {
    fetchFromDb.mockResolvedValue({ permissionsRev: 1, systemRev: 1, marker: 'x' });
    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(2);
  });

  it('null workspaceId and a real workspaceId are separate cache keys', async () => {
    fetchFromDb.mockResolvedValue({ permissionsRev: 1, systemRev: 1, marker: 'x' });
    await getPermissionContext('u1', null);
    await getPermissionContext('u1', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(2);
  });
});

describe('permissions-cache — invalidation on permissionsRev increment', () => {
  it('after invalidateUser → next call re-fetches', async () => {
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'v1' });
    await getPermissionContext('u1', 'ws1');

    invalidateUser('u1');
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 2, systemRev: 1, marker: 'v2' });
    const result = await getPermissionContext('u1', 'ws1');

    expect(fetchFromDb).toHaveBeenCalledTimes(2);
    expect(readMarker(result)).toBe('v2');
  });

  it('invalidateUser does NOT affect other users', async () => {
    fetchFromDb.mockResolvedValue({ permissionsRev: 1, systemRev: 1, marker: 'x' });
    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(2);

    invalidateUser('u1');
    await getPermissionContext('u2', 'ws1'); // u2 still cached
    expect(fetchFromDb).toHaveBeenCalledTimes(2);

    await getPermissionContext('u1', 'ws1'); // u1 invalidated
    expect(fetchFromDb).toHaveBeenCalledTimes(3);
  });
});

describe('permissions-cache — invalidation on workspace feature change', () => {
  it('invalidateWorkspace flushes all members of that workspace', async () => {
    fetchFromDb.mockResolvedValue({ permissionsRev: 1, systemRev: 1, marker: 'x' });
    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', 'ws1');
    await getPermissionContext('u3', 'ws-other');
    expect(fetchFromDb).toHaveBeenCalledTimes(3);

    invalidateWorkspace('ws1');

    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(5); // both u1@ws1 and u2@ws1 re-queried

    await getPermissionContext('u3', 'ws-other');
    expect(fetchFromDb).toHaveBeenCalledTimes(5); // ws-other untouched
  });
});

describe('permissions-cache — system-level invalidation', () => {
  it('invalidateSystem flushes everything', async () => {
    fetchFromDb.mockResolvedValue({ permissionsRev: 1, systemRev: 1, marker: 'x' });
    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', null);
    expect(fetchFromDb).toHaveBeenCalledTimes(2);

    invalidateSystem();

    await getPermissionContext('u1', 'ws1');
    await getPermissionContext('u2', null);
    expect(fetchFromDb).toHaveBeenCalledTimes(4);
  });
});

describe('permissions-cache — fresh=true bypass', () => {
  it('fresh=true skips the cache on read', async () => {
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'v1' });
    await getPermissionContext('u1', 'ws1');

    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'v2' });
    const result = await getPermissionContext('u1', 'ws1', { fresh: true });

    expect(fetchFromDb).toHaveBeenCalledTimes(2);
    expect(readMarker(result)).toBe('v2');
  });

  it('fresh=true does NOT poison cache for subsequent normal calls', async () => {
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'cached' });
    await getPermissionContext('u1', 'ws1');

    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'fresh-only' });
    await getPermissionContext('u1', 'ws1', { fresh: true });

    // Next normal call should still hit the original cached value
    const cached = await getPermissionContext('u1', 'ws1');
    expect(readMarker(cached)).toBe('cached');
    expect(fetchFromDb).toHaveBeenCalledTimes(2);
  });
});

describe('permissions-cache — invalidation cancels in-flight DB write (HIGH-2)', () => {
  it('invalidateUser between fetch start and DB resolve discards stale write', async () => {
    let resolveDb: (value: unknown) => void = () => {};
    fetchFromDb.mockImplementationOnce(
      () => new Promise((r) => { resolveDb = r; }),
    );

    // First fetch begins
    const inflightP = getPermissionContext('u1', 'ws1');

    // Invalidation arrives BEFORE the DB resolves
    invalidateUser('u1');

    // DB finally returns "stale" data
    resolveDb({ permissionsRev: 1, systemRev: 1, marker: 'stale' });
    await inflightP;

    // Next read must NOT see the stale write — should hit DB again
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 2, systemRev: 1, marker: 'fresh' });
    const next = await getPermissionContext('u1', 'ws1');

    expect(fetchFromDb).toHaveBeenCalledTimes(2);
    expect(readMarker(next)).toBe('fresh');
  });
});

describe('permissions-cache — concurrent reads coalesce', () => {
  it('two parallel reads for the same key result in a single DB query', async () => {
    let resolveDb: (value: unknown) => void = () => {};
    fetchFromDb.mockImplementation(
      () => new Promise((r) => { resolveDb = r; }),
    );

    const p1 = getPermissionContext('u1', 'ws1');
    const p2 = getPermissionContext('u1', 'ws1');

    resolveDb({ permissionsRev: 1, systemRev: 1, marker: 'one' });
    const [a, b] = await Promise.all([p1, p2]);

    expect(fetchFromDb).toHaveBeenCalledTimes(1);
    expect(readMarker(a)).toBe('one');
    expect(readMarker(b)).toBe('one');
  });
});

describe('permissions-cache — TTL/expiry', () => {
  it('entries older than TTL are not returned (5 min default)', async () => {
    vi.useFakeTimers();
    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'fresh' });
    await getPermissionContext('u1', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(1);

    // advance past TTL — implementation uses 5 min default
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);

    fetchFromDb.mockResolvedValueOnce({ permissionsRev: 1, systemRev: 1, marker: 'refetched' });
    const result = await getPermissionContext('u1', 'ws1');
    expect(fetchFromDb).toHaveBeenCalledTimes(2);
    expect(readMarker(result)).toBe('refetched');

    vi.useRealTimers();
  });
});
