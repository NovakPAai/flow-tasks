# Code Review: Feature-Permissions + Board ACL (Phase 1, Steps 1.1–1.5)

> Reviewer: code-reviewer (Claude Sonnet 4.6)
> Date: 2026-05-18
> Branch: claude/jack-readable-activity-feed
> Scope: backend/src/shared/utils/permissions{,.ts,-loader.ts,-cache.ts},
>        backend/src/shared/middleware/require-permission.ts,
>        backend/src/prisma/migrations/20260518143122_*/migration.sql,
>        backend/src/prisma/schema.prisma (new models/enums),
>        backend/src/__tests__/permissions/*.test.ts
> References: security-review.md (already filed), SDD §5 + §4, plan.md
>
> Note: The security-reviewer agent has already filed a separate review
> (tasks/feature-permissions-acl/security-review.md) covering H1–H3, M1–M5, L1–L8, I1–I4.
> This code-review covers code quality, TypeScript strictness, algorithm correctness,
> test quality, and migration correctness — complementing, not duplicating, the security review.
> Cross-references to security findings are noted where relevant.

---

## CRITICAL — 0 findings

---

## HIGH

---

### [HIGH-1] `presetPermissionsById` is never populated by the DB loader — `canActOnBoard` board-override role is silently bypassed

**File:** `backend/src/shared/utils/permissions-loader.ts` (no fetch for presetPermissionsById)
**File:** `backend/src/shared/utils/permissions.ts` lines 114–118
**File:** `backend/src/shared/utils/permissions-cache.ts` line 38

`PermissionContext.presetPermissionsById` is declared as `Record<string, Set<string>> | undefined` and marked "present only when canActOnBoard needs it." However, `loadPermissionContextFromDb` never fetches or populates this field. `decide()` uses it at Rule 5:

```ts
const roleSet = opts.withRole
  ? ctx.presetPermissionsById?.[opts.withRole]
  : ctx.workspaceRolePermissions;
if (roleSet?.has(permission)) return true;
```

When `opts.withRole` is set (the board-override path via `canActOnBoard`) and `presetPermissionsById` is `undefined`, `roleSet` is `undefined`, the check evaluates to `false`, and execution falls through to Rule 6 (global role). This means any board-scoped role restriction is silently ignored and the user's global role applies instead.

Concrete impact: a user with a `system:admin` global role added to a board with `system:viewer` override passes `ADMIN_*` permission checks on that board because Rule 5 is skipped and Rule 6 returns their global permissions.

**Algorithm correctness vs SDD §5:** The SDD says `withRole` replaces the workspace role in Rule 5. The current implementation cannot do this because the data is never loaded.

**Fix:** Either (a) load all referenced preset permissions inside `loadPermissionContextFromDb` (or in a board-context-specific loader), or (b) add a fail-closed guard:

```ts
// permissions.ts, decide(), after deriving roleSet:
if (opts.withRole !== undefined && roleSet === undefined) {
  // Preset data not loaded. Fail closed — do not fall through to global role.
  // Log a warning for diagnostics.
  console.warn(`[permissions] presetPermissionsById missing for withRole=${opts.withRole}`);
  return false;
}
if (roleSet?.has(permission)) return true;
// Only reach global role when withRole was NOT set:
if (!opts.withRole && ctx.globalRolePermissions.has(permission)) return true;
return false;
```

Option (b) is the minimal safe fix; option (a) is required for correctness once custom presets are used in Phase 2. Both should be applied.

**Tests:** The `withRole` tests in `is-allowed.test.ts` (lines 234–260) mock `presetPermissionsById` directly, so they test the algorithm with data that is never actually loaded. There is no test covering the "withRole set, presetPermissionsById undefined" path — which is the production case today. Add:

```ts
it('withRole set but presetPermissionsById not loaded → denies (fail-closed)', async () => {
  mockedGet.mockResolvedValue(
    makeCtx({
      globalRolePermissions: new Set(['TASK_DELETE']),
      // presetPermissionsById NOT set (undefined)
    }),
  );
  expect(
    await isAllowed('u1', 'ws1', 'TASK_DELETE', { withRole: 'some-preset' }),
  ).toBe(false);
});
```

Also cross-referenced in security-review.md §M2.

---

### [HIGH-2] Race condition: `invalidateUser` and `invalidateWorkspace` do not cancel in-flight DB promises — stale data can re-populate the cache after invalidation

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 159–178

The `inflight` Map is cleared only in `invalidateSystem` (line 182). The partial invalidation functions `invalidateUser` and `invalidateWorkspace` delete entries from `cache` and the secondary indexes but do **not** remove the corresponding entry from `inflight`.

Race scenario:
1. `getPermissionContext('u1', 'ws1')` is called — no cache hit, so a DB query starts and `inflight['u1:ws1'] = p` is stored.
2. Before the DB returns, `invalidateUser('u1')` is called — it runs `cache.delete('u1:ws1')` (nothing to delete yet) and calls `byUser.delete('u1')`. The `inflight` entry is not touched.
3. The DB query completes — `.then()` fires, writing `cache.set('u1:ws1', { value: staleData, expiresAt: ... })` and calling `indexInsert('u1', 'ws1', 'u1:ws1')`.
4. The next call to `getPermissionContext('u1', 'ws1')` returns the stale cache entry.

This is a correctness bug. Under normal load (permission changes are infrequent), the window is short and the stale data expires within TTL. However, for security-sensitive permission changes (e.g. revoking access), there is a window where the old context is served.

**Fix:** Track a "generation" counter per cache key. When invalidation fires, increment the generation; the in-flight promise checks its generation on resolution and discards the write if it has been superseded:

```ts
const generations = new Map<string, number>(); // key → current generation

// In getPermissionContext:
const gen = (generations.get(key) ?? 0);
const p = loadPermissionContextFromDb(userId, workspaceId)
  .then((value) => {
    if ((generations.get(key) ?? 0) === gen) { // generation still current
      cache.set(key, { value, expiresAt: Date.now() + DEFAULT_TTL_MS });
      indexInsert(userId, workspaceId, key);
    }
    return value;
  })
  .finally(() => { inflight.delete(key); });

// In invalidateUser/invalidateWorkspace, after cache.delete(key):
generations.set(key, (generations.get(key) ?? 0) + 1);
```

Alternatively (simpler): add the key to an `invalidated` Set, check it in the `.then()`, and clear it from the Set after the check.

**Tests:** The `cache.test.ts` concurrent-reads test (lines 158–175) confirms coalescing but does not test invalidation during in-flight. Add:

```ts
it('invalidateUser during in-flight does not re-cache stale result', async () => {
  let resolve!: (v: unknown) => void;
  fetchFromDb.mockImplementation(() => new Promise(r => { resolve = r; }));
  const p = getPermissionContext('u1', 'ws1');
  invalidateUser('u1');
  resolve({ permissionsRev: 1, systemRev: 1, marker: 'stale' });
  await p;
  // Next normal call must re-fetch, not return the stale value
  fetchFromDb.mockResolvedValueOnce({ permissionsRev: 2, systemRev: 1, marker: 'fresh' });
  const result = await getPermissionContext('u1', 'ws1');
  expect(readMarker(result)).toBe('fresh');
  expect(fetchFromDb).toHaveBeenCalledTimes(2);
});
```

---

## MEDIUM

---

### [MED-1] `requirePermission` calls `getPermissionContext` twice on the denial path — unnecessary double await

**File:** `backend/src/shared/middleware/require-permission.ts` lines 55–82

When a permission check fails, the middleware calls `isAllowed()` (which internally calls `getPermissionContext`) and then separately calls `getPermissionContext()` again to diagnose the reason. With the cache, the second call is a fast cache hit, but it is still an extra `await` and adds code complexity. The first call should be redesigned to return both the boolean and enough context for diagnosis, or the diagnosis context should be derived from the `isAllowed` internal call.

More practically: `isAllowed` calls `getPermissionContext` and calls `decide()`. The `decide()` function is pure and already has the context. The middleware could call `getPermissionContext` once and call a hypothetical `decideWithContext` directly, reusing the result:

```ts
const ctx = await getPermissionContext(req.user.userId, workspaceId);
const ok = decide(ctx, workspaceId, permission, {});
if (ok) return next();
// use ctx for diagnosis — no second fetch needed
const featureCode = deriveFeatureCode(permission);
...
```

This requires `decide` to be exported (see INFO-1 below, also noted as I2 in security-review.md).

---

### [MED-2] `featureGate` uses the authenticated user's context to check system features — system features are user-independent and this conflates two concerns

**File:** `backend/src/shared/middleware/require-permission.ts` lines 108–133

System feature flags (Level 1 in SDD §3) are global — they do not vary per user. `featureGate` loads the full per-user permission context (`getPermissionContext(userId, ...)`) just to read `ctx.systemFeatures[featureCode]`. This is unnecessary: `systemFeatures` is identical for all users (it comes from the `system_features` table which has no per-user filtering). Loading the full user context for a user-independent check pollutes the per-user cache and causes unnecessary DB queries for unauthenticated users (the `'anonymous'` fallback issue, covered in security-review.md §H1).

The cleanest fix is a separate `getSystemFeatures()` function that caches system features independently of the user:

```ts
// permissions-cache.ts
let systemFeaturesCache: { value: Record<string, boolean>; expiresAt: number } | null = null;

export async function getSystemFeatures(): Promise<Record<string, boolean>> {
  if (systemFeaturesCache && systemFeaturesCache.expiresAt > Date.now()) {
    return systemFeaturesCache.value;
  }
  const rows = await prisma.systemFeature.findMany({ select: { code: true, enabled: true } });
  const value = Object.fromEntries(rows.map(r => [r.code, r.enabled]));
  systemFeaturesCache = { value, expiresAt: Date.now() + DEFAULT_TTL_MS };
  return value;
}
```

`featureGate` with `scope='system'` would use this instead.

---

### [MED-3] `indexRemove` is O(all users × all workspaces) on every expired-entry eviction

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 91–98

`indexRemove(key)` is called on every cache miss when an expired entry is evicted (line 126). It iterates ALL entries in `byUser` and ALL entries in `byWorkspace` to find and remove the key. Under load with a large number of active users and workspaces, this becomes an O(U + W) operation on every TTL expiry — which happens naturally every 5 minutes per cached key.

```ts
function indexRemove(key: string): void {
  for (const [userId, set] of byUser) {       // O(U)
    if (set.delete(key) && set.size === 0) byUser.delete(userId);
  }
  for (const [wsId, set] of byWorkspace) {   // O(W)
    if (set.delete(key) && set.size === 0) byWorkspace.delete(wsId);
  }
}
```

**Fix:** Store `userId` and `workspaceId` in the `CacheEntry` to allow O(1) index removal:

```ts
interface CacheEntry {
  value: PermissionContext;
  expiresAt: number;
  userId: string;          // add
  workspaceId: string | null; // add
}

function indexRemove(key: string): void {
  const entry = cache.get(key); // peek before delete
  if (!entry) return;
  const { userId, workspaceId } = entry;
  const uSet = byUser.get(userId);
  if (uSet) { uSet.delete(key); if (uSet.size === 0) byUser.delete(userId); }
  if (workspaceId) {
    const wSet = byWorkspace.get(workspaceId);
    if (wSet) { wSet.delete(key); if (wSet.size === 0) byWorkspace.delete(workspaceId); }
  }
}
```

Also cross-referenced in security-review.md §L5.

---

### [MED-4] `loadBoardWorkspaceId` uses a dynamic `import()` inside a hot middleware path — breaks tree-shaking and adds latency

**File:** `backend/src/shared/middleware/require-permission.ts` lines 190–198

```ts
async function loadBoardWorkspaceId(boardId: string): Promise<string> {
  const { prisma } = await import('../../prisma/client.js');
  ...
}
```

Dynamic `import()` inside a request handler forces the module loader to resolve on every invocation. While Node.js caches module resolution after the first load, the `await import()` still adds a microtask boundary on every call. More importantly, this pattern indicates that `prisma` should be a static import at the top of the file. The reason it is dynamic is likely to avoid circular dependencies, but the cleaner fix is to extend `BoardAccessContext` with `workspaceId` and eliminate `loadBoardWorkspaceId` entirely (covered in security-review.md §H2).

The minimal fix for this PR: move `prisma` to a static top-level import. The proper fix: surface `workspaceId` in `BoardAccessResult` and remove the extra DB call.

---

## LOW

---

### [LOW-1] `PermissionCode` type alias is `string` — Prisma-generated enum is already available

**File:** `backend/src/shared/utils/permissions.ts` line 20

```ts
export type PermissionCode = string; // narrows once Prisma enum is generated
```

The Prisma schema already defines `enum PermissionCode`. The generated client exports `PermissionCode` as a string enum union. The comment says "narrows once Prisma enum is generated" but the generation has already happened. Until this is updated, callers can pass any string (e.g. `'ADMIN_USER'` instead of `'ADMIN_USERS'`) and get a silent `false` from the engine.

**Fix:**
```ts
import type { PermissionCode } from '@prisma/client';
export type { PermissionCode };
```

Also cross-referenced in security-review.md §L1.

---

### [LOW-2] `makeCtx` in `is-allowed.test.ts` uses `as never` to suppress type errors caused by missing required fields

**File:** `backend/src/__tests__/permissions/is-allowed.test.ts` lines 38–54, 241, 254

`PermissionContext` requires `permissionsRev: number` and `systemRev: number`, but `makeCtx` does not set them. The TypeScript error is suppressed with `as never` (lines 53, 241, 254). Using `as never` is stronger than `as any` in that it disables all type checking for the cast value — any property access on the result has type `never` in inference, which can mask real errors.

**Fix:** Add `permissionsRev: 0, systemRev: 0` to the base object in `makeCtx`:

```ts
function makeCtx(overrides: Partial<PermissionContext> = {}): PermissionContext {
  return {
    isSuperadmin: false,
    isGuest: false,
    workspaceRolePermissions: new Set<string>(),
    globalRolePermissions: new Set<string>(),
    grants: new Set<string>(),
    revokes: new Set<string>(),
    systemFeatures: { /* ... */ },
    workspaceFeatures: {},
    permissionsRev: 0,
    systemRev: 0,
    ...overrides,
  };
}
```

Remove all three `as never` casts. The type annotation can become `PermissionContext` directly.

---

### [LOW-3] `makeCtxDefaults()` is defined after the `describe` blocks that reference it — hoisting works but is confusing

**File:** `backend/src/__tests__/permissions/is-allowed.test.ts` lines 88, 99, 263

`makeCtxDefaults()` is declared at line 263 (after all `describe` blocks) but called at lines 88 and 99. In TypeScript compiled to ESM, function declarations are hoisted but function expressions assigned to `const` are not. `makeCtxDefaults` uses `function` declaration syntax (line 263) so hoisting applies and there is no runtime error. However, placing a helper used throughout the file below all its call sites is a readability anti-pattern. Move `makeCtxDefaults` to just below `makeCtx`.

---

### [LOW-4] `user_permissions` unique constraint on `(userId, workspaceId, permission)` does not enforce uniqueness when `workspaceId` is NULL — PostgreSQL treats each NULL as distinct

**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` line 101
**File:** `backend/src/prisma/schema.prisma` line 628

```sql
CREATE UNIQUE INDEX "user_permissions_userId_workspaceId_permission_key"
  ON "user_permissions"("userId", "workspaceId", "permission");
```

In standard PostgreSQL (including PG 16), a UNIQUE index on a nullable column does NOT treat two NULL values as equal — so two rows `(u1, NULL, COMMENT_CREATE, GRANT)` and `(u1, NULL, COMMENT_CREATE, REVOKE)` can coexist. The unique constraint is violated only when `workspaceId` is non-null and both rows have the same non-null value. This allows a user to have both a GLOBAL GRANT and a GLOBAL REVOKE for the same permission simultaneously.

The algorithm (REVOKE wins Rule 3) handles this correctly at read time, but the inconsistent data is silent and will confuse admin tooling and audit logs.

**Fix:** On PG 15+, add `NULLS NOT DISTINCT`:

```sql
-- new migration
DROP INDEX "user_permissions_userId_workspaceId_permission_key";
CREATE UNIQUE INDEX "user_permissions_userId_workspaceId_permission_key"
  ON "user_permissions"("userId", "workspaceId", "permission") NULLS NOT DISTINCT;
```

Since the project targets PG 16 (per CLAUDE.md), this is available. Also cross-referenced in security-review.md §M4.

---

### [LOW-5] `UserPermission.workspaceId` has no FK to `workspaces` — orphaned override rows accumulate when a workspace is deleted

**File:** `backend/src/prisma/schema.prisma` (UserPermission model, no workspace relation)
**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql`

`WorkspaceMember` rows are cascade-deleted when their workspace is deleted (via `Workspace → WorkspaceMember` cascade). However, `UserPermission` rows with `workspaceId` referencing the same workspace are NOT deleted — there is no FK from `UserPermission.workspaceId` to `workspaces.id`. These rows become orphans: they reference a deleted workspace and can never be loaded (the `loadPermissionContextFromDb` query filters by `workspaceId`, so they would be included in future workspace-less queries only if `workspaceId=NULL` is queried — but they have a non-null value, so they would only appear in the context of the long-deleted workspace).

Under normal operation these rows are harmless (they are filtered by workspaceId and the workspace is gone), but they accumulate as garbage and can mislead audit tools.

**Fix:** Add the FK:

```prisma
// schema.prisma — UserPermission model
workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
```

This requires adding `userPermissions UserPermission[]` to the `Workspace` model and a migration to add the constraint.

---

### [LOW-6] `WorkspaceMember → RolePreset` and `BoardMember → RolePreset` FKs use `ON DELETE SET NULL` — deleting a custom preset silently locks out all affected members

**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` lines 113, 131

When a non-system `RolePreset` is deleted:
- `WorkspaceMember.role_preset_id` is set to NULL for all affected rows.
- `BoardMember.role_preset_id` is set to NULL for all affected rows.

For `BoardMember`, `NULL` means explicit DENY (by design — see `decideBoardAccess` rule 2). So deleting a custom preset used on a board silently **bans every board member** who held that preset, with no notification and no error.

The plan (Step 1.6, R14) documents that the deletion service should return `409 ROLE_IN_USE`, but the FK-level `ON DELETE SET NULL` means this protection is bypassed by direct DB writes (Prisma Studio, admin SQL, future migrations).

**Fix:** Change both FKs to `ON DELETE RESTRICT` in the schema, with a migration:

```prisma
// BoardMember
rolePreset RolePreset? @relation(fields: [rolePresetId], references: [id], onDelete: Restrict)
// WorkspaceMember
rolePreset RolePreset? @relation(fields: [rolePresetId], references: [id], onDelete: Restrict)
```

The service-level `409` remains needed for user-friendly messaging, but `RESTRICT` provides the DB-level safety net. Also cross-referenced in security-review.md §H3.

---

### [LOW-7] `featureGate` with an unauthenticated caller uses `'anonymous'` as userId and writes a stale empty context to the cache

**File:** `backend/src/shared/middleware/require-permission.ts` line 110

```ts
const userId = req.user?.userId ?? 'anonymous';
```

When an unauthenticated request hits `featureGate`, `getPermissionContext('anonymous', workspaceId)` is called. The DB returns no user (id `'anonymous'` does not exist), so `emptyContext()` is returned. The in-flight coalescing then **caches this empty context** under the key `'anonymous:<wsId>'`. This wastes cache entries and creates a confusing invariant.

Additionally, `emptyContext().systemFeatures` is `{}`. The check `ctx.systemFeatures[featureCode] === false` evaluates to `undefined === false` which is `false` — so the gate silently passes for unauthenticated users even when the system feature is disabled.

**Minimal fix:** Do not use `'anonymous'` as a real cache key. Add an early auth check at the top of `featureGate`:

```ts
if (!req.user?.userId) {
  // System features do not depend on the user — load them directly
  // or, simpler: let authenticate() downstream reject the request.
  // featureGate should not attempt per-user context for unauthenticated callers.
  return next(new AppError(401, 'Не авторизован'));
}
```

Or use the dedicated system-features cache proposed in MED-2. Also cross-referenced in security-review.md §H1.

---

### [LOW-8] Migration step 9 sanity check references wrong column case — `"isPrivate"` vs actual column name

**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` lines 234–235

```sql
-- 9. Sanity: ensure no board has NULL is_private
UPDATE "boards" SET "isPrivate" = false WHERE "isPrivate" IS NULL;
```

The column on the `boards` table was created by migration `20260422120301_add_is_private_to_workspace_and_board` as `"isPrivate" BOOLEAN NOT NULL DEFAULT false`. The column is stored in PostgreSQL with the quoted camelCase name `"isPrivate"` (not snake_case `is_private`), and the `ALTER TABLE ... ADD COLUMN "isPrivate"` confirms this. So the SQL in step 9 uses the correct quoted name and is valid.

However, the comment says `is_private` (snake_case) while the statement uses `"isPrivate"` (camelCase). This is a minor documentation inconsistency. More importantly, since the column was defined `NOT NULL DEFAULT false`, it can never be NULL in practice — making step 9 a no-op with misleading intent. If the goal was to guard against pre-migration NULL rows, the guard belongs in the migration that originally added the column.

**Fix:** Remove the no-op step 9 or replace the comment with `-- No-op guard: "isPrivate" is NOT NULL DEFAULT false; retained for defensive safety`.

---

### [LOW-9] `PermissionContext.presetPermissionsById` field is optional — should be required (always populated) or removed and loaded on demand

**File:** `backend/src/shared/utils/permissions-cache.ts` line 38

```ts
presetPermissionsById?: Record<string, Set<string>>;
```

Optional fields in types that are required for correct operation create silent failures (the HIGH-1 finding is a consequence of this design). If `presetPermissionsById` should always be present in the `PermissionContext`, remove the `?`. If it is intentionally absent from the current implementation and will be added in Phase 2, document this with a `// TODO(Phase 2)` comment and pair it with the fail-closed fix from HIGH-1 to ensure the absence is safe.

**Fix:** Either:
- Make it required: `presetPermissionsById: Record<string, Set<string>>` and initialize to `{}` in `emptyContext()` and `loadPermissionContextFromDb`.
- Keep it optional and add the fail-closed guard from HIGH-1 immediately, with a clear TODO comment.

---

## INFO / NIT

---

### [INFO-1] `decide()` is private — the pure synchronous algorithm cannot be unit-tested directly

**File:** `backend/src/shared/utils/permissions.ts` lines 85–124

The `decide()` function is the pure core of the permission engine. All current tests go through `isAllowed()` (async, requires mocking `getPermissionContext`). Exporting `decide` would allow synchronous tests with zero mocking overhead. This was noted as I2 in the security review and is reinforced here from a test-quality perspective.

**Fix:** Export `decide` (optionally prefixed as `_decideSync` for test-only usage, or via a test barrel file).

---

### [INFO-2] `__clearCacheForTests` is exported from the production module without any environment guard

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 187–190

The `__` naming convention signals test-only intent, but the function is exported from the production module. A future refactor that imports all exports from the module (e.g. via `import * as cache from './permissions-cache'`) could accidentally call it in non-test code.

**Fix:** Add a guard:
```ts
export function __clearCacheForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('__clearCacheForTests must not be called in production');
  }
  invalidateSystem();
}
```
Or move to a separate `permissions-cache.test-helpers.ts` file. Also cross-referenced in security-review.md §I1.

---

### [INFO-3] Seed step comments are inconsistent — TASK_EXPORT exclusion from `system:member` is undocumented

**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` lines 167–181

The migration seed step 4 for `system:member` does not include `TASK_EXPORT`. The plan §Open Q1 documents the intentional exclusion, but there is no inline SQL comment. Future developers comparing the member and owner seeds will not immediately understand why `TASK_EXPORT` appears only in the owner set.

**Fix:** Add a comment:
```sql
-- 4. Seed RolePermission for system:member
-- Note: TASK_EXPORT is intentionally excluded from Member (plan §Open Q1 — export is an owner privilege).
```

Also cross-referenced in security-review.md §I3.

---

### [INFO-4] `loadBoardAccessContextFromDb` defaults `boardIsPrivate: false` when the user record is not found — conservative default should be `true`

**File:** `backend/src/shared/utils/permissions-loader.ts` lines 113–124

When `!user`, the function returns `boardIsPrivate: false`. Rule 0c in `decideBoardAccess` (`isWorkspaceMember: false`) catches this and returns `denied` before reaching rule 5 (private board check), so the current code is safe. However the conservative default for an unknown board privacy should be `true` (private), not `false` (public). If rule ordering ever changes in a future refactor, a false `boardIsPrivate: false` could cause a private board to appear accessible.

**Fix:**
```ts
boardIsPrivate: board?.isPrivate ?? true, // conservative: unknown = treat as private
```

Also cross-referenced in security-review.md §L7.

---

### [INFO-5] `WS_MENTIONS`, `WS_TRASH`, and `WS_ONBOARDING_TOUR` are in SDD Level 2 but absent from `FEATURE_CODE_BY_PERMISSION`

**File:** `backend/src/shared/utils/permissions.ts` lines 26–52

The SDD §3 lists `WS_MENTIONS`, `WS_TRASH`, and `WS_ONBOARDING_TOUR` as workspace toggle codes. None of them appear in `FEATURE_CODE_BY_PERMISSION` because there are no corresponding `PermissionCode` enum values for these features (they gate UI behaviour only, not permission codes). This is correct by design. However, the absence is not documented — a reader of `FEATURE_CODE_BY_PERMISSION` might wonder if the mapping is incomplete.

**Fix:** Add a comment at the top of `FEATURE_CODE_BY_PERMISSION`:
```ts
// Note: WS_MENTIONS, WS_TRASH, WS_ONBOARDING_TOUR are workspace feature codes
// that control UI behaviour only — they do not gate any PermissionCode.
// They are enforced via featureGate() middleware, not via FEATURE_CODE_BY_PERMISSION.
const FEATURE_CODE_BY_PERMISSION: Record<string, string> = {
```

---

### [INFO-6] `TASK_READ_ALL` mentioned in SDD §3 is absent from the `PermissionCode` enum in schema and migration

**File:** `backend/src/prisma/schema.prisma` (PermissionCode enum)
**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` (CreateEnum PermissionCode)

The SDD §3 includes `TASK_READ_ALL` in its permission code listing ("including private boards (override workspace-level)"). This code does not appear in the `PermissionCode` enum in either the schema or the migration. If this is deferred to a later phase, add a comment in the SDD or the enum definition. If it was omitted accidentally, it needs to be added.

**Fix:** Verify with the SDD author whether `TASK_READ_ALL` is in scope for Phase 1 or deferred. Add a TODO comment if deferred.

---

## Summary Table

| ID | Severity | Area | File | Finding |
|----|----------|------|------|---------|
| HIGH-1 | HIGH | Algorithm correctness | permissions.ts, permissions-loader.ts | `presetPermissionsById` never populated — board-override role silently bypassed, global role used instead |
| HIGH-2 | HIGH | Cache correctness | permissions-cache.ts | In-flight promises not cancelled on invalidation — stale data re-populates cache after `invalidateUser/Workspace` |
| MED-1 | MEDIUM | Code quality | require-permission.ts | `requirePermission` calls `getPermissionContext` twice on denial path |
| MED-2 | MEDIUM | Architecture | require-permission.ts | `featureGate` loads per-user context for a user-independent system feature check |
| MED-3 | MEDIUM | Performance | permissions-cache.ts | `indexRemove` is O(U+W) on every TTL eviction; should be O(1) via reverse index |
| MED-4 | MEDIUM | Code quality | require-permission.ts | Dynamic `import()` inside hot middleware path |
| LOW-1 | LOW | TypeScript strictness | permissions.ts | `PermissionCode` typed as `string` instead of Prisma-generated enum |
| LOW-2 | LOW | Test quality | is-allowed.test.ts | `as never` casts due to missing `permissionsRev`/`systemRev` in `makeCtx` |
| LOW-3 | LOW | Test quality | is-allowed.test.ts | `makeCtxDefaults` defined after call sites (hoisting dependency) |
| LOW-4 | LOW | DB correctness | migration.sql, schema.prisma | UNIQUE index on `(userId, NULL, permission)` allows duplicate GLOBAL overrides on PG 15 without NULLS NOT DISTINCT |
| LOW-5 | LOW | DB integrity | schema.prisma | `UserPermission.workspaceId` has no FK to `workspaces` — orphaned rows on workspace deletion |
| LOW-6 | LOW | DB integrity | migration.sql, schema.prisma | `WorkspaceMember/BoardMember → RolePreset` FKs are SET NULL, not RESTRICT — silent mass ban on preset deletion |
| LOW-7 | LOW | Security/cache | require-permission.ts | `featureGate` with unauthenticated user caches empty context under `'anonymous'` key and silently passes disabled features |
| LOW-8 | LOW | Migration | migration.sql | Step 9 comment says `is_private` (snake_case) but SQL uses `"isPrivate"` (camelCase); step is a no-op on NOT NULL DEFAULT false column |
| LOW-9 | LOW | TypeScript design | permissions-cache.ts | `presetPermissionsById` optional field is the root cause of HIGH-1; should be required or explicitly documented as deferred |
| INFO-1 | INFO | Test quality | permissions.ts | `decide()` not exported — pure algorithm cannot be unit-tested without async mocking |
| INFO-2 | INFO | Code hygiene | permissions-cache.ts | `__clearCacheForTests` exported from production module without env guard |
| INFO-3 | INFO | Migration docs | migration.sql | Missing inline comment explaining `TASK_EXPORT` exclusion from `system:member` seed |
| INFO-4 | INFO | Defensiveness | permissions-loader.ts | `boardIsPrivate` defaults to `false` when user not found — should default to `true` |
| INFO-5 | INFO | Documentation | permissions.ts | `WS_MENTIONS/TRASH/ONBOARDING_TOUR` absence from `FEATURE_CODE_BY_PERMISSION` undocumented |
| INFO-6 | INFO | Spec alignment | schema.prisma | `TASK_READ_ALL` in SDD §3 but absent from `PermissionCode` enum — deferred or oversight? |

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 2 | warn |
| MEDIUM | 4 | warn |
| LOW | 9 | info |
| INFO/NIT | 6 | note |

**Verdict: BLOCK on HIGH-1.** The `presetPermissionsById` field is never populated, meaning `canActOnBoard` board-override role restrictions are silently bypassed and the user's global role is used instead. This is an algorithm correctness failure against SDD §5 and a security regression once Phase 2 endpoints go live. HIGH-2 (in-flight race condition) should also be fixed before the cache is used in production.

**All HIGHs must be resolved before merge.** MEDs should be resolved in this PR (MED-1 to MED-4). LOWs and INFOs are individually small but collectively represent measurable tech debt; each should either be fixed or explicitly deferred with a ticket reference in the commit message or PR description per the project's All-Severity Fix Rule.

### Items covered by the existing security-review.md that are NOT duplicated here

The following findings from security-review.md are relevant but not duplicated in this review, as they were already comprehensively covered by the security-reviewer agent: H1 (anonymous featureGate cache write / feature bypass), H2 (second uncached DB round-trip / TOCTOU in requireBoardAction), H3 (SET NULL vs RESTRICT FK integrity), M1 (featureCode string type / typo bypass), M2 (presetPermissionsById / board override bypass — fully overlaps HIGH-1 here), M3 (BoardMember mutation missing permissionsRev increment), M4 (NULLS NOT DISTINCT — overlaps LOW-4 here), M5 (attacker-controlled workspaceId in featureGate), L2 (addedBy no FK), L3 (audit log targetId untyped), L4 (featureGate 404 before auth), L6 (TASK_EXPORT seed comment), L8 (requirePermission + requireBoardAction composition contract), I1 (clearCacheForTests env guard), I2 (decide not exported), I3 (seed inheritance comment), I4 (withRole warning on undefined preset).
