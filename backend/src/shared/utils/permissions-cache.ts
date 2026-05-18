/**
 * Permission cache layer.
 *
 * Spec: plan.md §Caching strategy.
 *
 * Provides cached access to the full permission context for (userId, workspaceId)
 * pairs, with explicit invalidation hooks called from mutation paths.
 *
 * Implementation notes:
 *   - In-memory Map keyed by `userId:workspaceId`. Two secondary indexes
 *     (by user, by workspace) allow O(1) bulk invalidation.
 *   - In-flight Promise coalescing: if two callers request the same key
 *     before the DB has answered, they share one query.
 *   - Default TTL: 5 minutes. Stale entries are evicted on read.
 *   - `fresh: true` callers always re-fetch and do NOT update the cache —
 *     critical for security-changing endpoints that need a guaranteed-current
 *     read without poisoning the entry that other readers may rely on.
 */

import { loadPermissionContextFromDb, loadBoardAccessContextFromDb } from './permissions-loader.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

// ─── Public types ────────────────────────────────────────────────────────────

export interface PermissionContext {
  isSuperadmin: boolean;
  isGuest: boolean;
  workspaceRolePermissions: Set<string>;
  globalRolePermissions: Set<string>;
  /** Override keys formatted as "WS:<perm>" or "GLOBAL:<perm>". */
  grants: Set<string>;
  /** Same encoding as grants. REVOKE always wins over GRANT. */
  revokes: Set<string>;
  systemFeatures: Record<string, boolean>;
  workspaceFeatures: Record<string, boolean>;
  permissionsRev: number;
  systemRev: number;
}

export interface BoardAccessContext {
  isSuperadmin: boolean;
  workspaceId: string;
  workspaceDeletedAt: string | null;
  isWorkspaceMember: boolean;
  isWorkspaceOwner: boolean;
  workspaceRolePresetId: string | null;
  isGuest: boolean;
  boardIsPrivate: boolean;
  boardMember: { rolePresetId: string | null } | null;
}

// ─── Cache state ─────────────────────────────────────────────────────────────

interface CacheEntry {
  value: PermissionContext;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PermissionContext>>();

/**
 * Generation counter per key. Incremented by any invalidation. An in-flight DB
 * promise captures the generation at start time and refuses to write back if
 * the generation has moved — this is the fix for HIGH-2 (race condition where
 * a stale fetch repopulates the cache after invalidation).
 */
const generations = new Map<string, number>();

/** userId → set of cache keys (for invalidateUser). */
const byUser = new Map<string, Set<string>>();
/** workspaceId → set of cache keys (for invalidateWorkspace). */
const byWorkspace = new Map<string, Set<string>>();

function keyFor(userId: string, workspaceId: string | null): string {
  return `${userId}:${workspaceId ?? 'null'}`;
}

function indexInsert(userId: string, workspaceId: string | null, key: string): void {
  let userSet = byUser.get(userId);
  if (!userSet) {
    userSet = new Set();
    byUser.set(userId, userSet);
  }
  userSet.add(key);

  if (workspaceId) {
    let wsSet = byWorkspace.get(workspaceId);
    if (!wsSet) {
      wsSet = new Set();
      byWorkspace.set(workspaceId, wsSet);
    }
    wsSet.add(key);
  }
}

function indexRemove(key: string): void {
  for (const [userId, set] of byUser) {
    if (set.delete(key) && set.size === 0) byUser.delete(userId);
  }
  for (const [wsId, set] of byWorkspace) {
    if (set.delete(key) && set.size === 0) byWorkspace.delete(wsId);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface GetPermissionContextOptions {
  /** Bypass cache: always read from DB, do not update cache. */
  fresh?: boolean;
}

export async function getPermissionContext(
  userId: string,
  workspaceId: string | null,
  opts: GetPermissionContextOptions = {},
): Promise<PermissionContext> {
  if (opts.fresh) {
    return loadPermissionContextFromDb(userId, workspaceId);
  }

  const key = keyFor(userId, workspaceId);
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.value;
  }
  if (entry) {
    // expired
    cache.delete(key);
    indexRemove(key);
  }

  // Coalesce concurrent reads
  const pending = inflight.get(key);
  if (pending) return pending;

  const generationAtStart = generations.get(key) ?? 0;

  const p = loadPermissionContextFromDb(userId, workspaceId)
    .then((value) => {
      // HIGH-2 fix: if an invalidation bumped the generation while we were
      // fetching, refuse to write stale data back to the cache. Returning
      // the value is fine — the caller asked for a fresh read anyway.
      if ((generations.get(key) ?? 0) === generationAtStart) {
        cache.set(key, { value, expiresAt: Date.now() + DEFAULT_TTL_MS });
        indexInsert(userId, workspaceId, key);
      }
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

function bumpGeneration(key: string): void {
  generations.set(key, (generations.get(key) ?? 0) + 1);
}

export async function getBoardAccessContext(
  userId: string,
  boardId: string,
): Promise<BoardAccessContext> {
  // Board access context is small and changes per board — for now skip caching.
  // Optimization: integrate with the main cache once permissionsRev covers
  // BoardMember mutations (Phase 1.4 follow-up).
  return loadBoardAccessContextFromDb(userId, boardId);
}

// ─── Invalidation hooks ──────────────────────────────────────────────────────

/**
 * Returns all in-flight cache keys that belong to a given user. Used to bump
 * generations on invalidation even before the original fetch has settled
 * (HIGH-2 race: invalidation arrives during the DB fetch window).
 */
function inflightKeysForUser(userId: string): string[] {
  const prefix = `${userId}:`;
  return [...inflight.keys()].filter((k) => k.startsWith(prefix));
}

function inflightKeysForWorkspace(workspaceId: string): string[] {
  const suffix = `:${workspaceId}`;
  return [...inflight.keys()].filter((k) => k.endsWith(suffix));
}

export function invalidateUser(userId: string): void {
  // Bump generations for all keys (cached + in-flight) so any pending fetch
  // refuses to write back stale data.
  for (const key of inflightKeysForUser(userId)) bumpGeneration(key);

  const keys = byUser.get(userId);
  if (keys) {
    for (const key of keys) {
      cache.delete(key);
      bumpGeneration(key);
      for (const set of byWorkspace.values()) set.delete(key);
    }
    byUser.delete(userId);
  }
}

export function invalidateWorkspace(workspaceId: string): void {
  for (const key of inflightKeysForWorkspace(workspaceId)) bumpGeneration(key);

  const keys = byWorkspace.get(workspaceId);
  if (keys) {
    for (const key of keys) {
      cache.delete(key);
      bumpGeneration(key);
      for (const set of byUser.values()) set.delete(key);
    }
    byWorkspace.delete(workspaceId);
  }
}

export function invalidateSystem(): void {
  // Bump generations for all in-flight keys so any pending fetch refuses to
  // write back stale data.
  for (const key of inflight.keys()) bumpGeneration(key);
  for (const key of cache.keys()) bumpGeneration(key);
  cache.clear();
  inflight.clear();
  byUser.clear();
  byWorkspace.clear();
}

/** Test-only helper: wipes everything including in-flight promises. */
export function __clearCacheForTests(): void {
  cache.clear();
  inflight.clear();
  byUser.clear();
  byWorkspace.clear();
  generations.clear();
}
