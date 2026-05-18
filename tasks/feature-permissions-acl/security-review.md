# Security Review: Feature-Permissions + Board ACL

> Reviewer: security-reviewer agent
> Date: 2026-05-18
> Branch: claude/jack-readable-activity-feed
> Scope: Phase 1 additive — engine, cache, middleware, migration (new code, no existing endpoints modified yet)
> Threat model reference: tasks/feature-permissions-acl/plan.md §Security Threat Model

---

## Executive Summary

The permission engine algorithm is architecturally sound. The layered decision model (superadmin shortcut → feature gates → revoke → grant → role → global role → default deny) is correct and well-tested. The cache invalidation model is safe for single-node deployments. No hardcoded secrets or SQL injection vectors were found. However, several issues of HIGH and MEDIUM severity require attention before Phase 2 goes live — one of them (the anonymous cache read in `featureGate`) needs to be fixed in this PR.

---

## Findings

### CRITICAL — 0 findings

---

### HIGH

---

#### H1 — Anonymous cache read in `featureGate` can load and cache permission context for unauthenticated requests

**File:** `backend/src/shared/middleware/require-permission.ts` lines 108–133

**Description:**
When a request arrives without a valid JWT, `req.user` is `undefined`. The middleware falls back to:

```ts
const userId = req.user?.userId ?? 'anonymous';
```

It then calls `getPermissionContext('anonymous', workspaceId)`, which calls `loadPermissionContextFromDb('anonymous', ...)`. The DB call returns `emptyContext()` (because `findUnique` finds no user with id `'anonymous'`), and that empty context **is written into the in-memory cache** under the key `anonymous:null`. This is benign for anonymous users themselves, but it creates a confusing invariant: the cache is supposed to hold contexts for real authenticated users. If a future code path ever re-uses `'anonymous'` as a legitimate userId (unlikely but possible), it would hit a stale cached empty context. More practically, the `featureGate` logic then continues past the `systemFeatures` check even when no auth has been established, because `emptyContext().systemFeatures` is `{}` and the check `ctx.systemFeatures[featureCode] === false` evaluates to `false` (the feature appears enabled). This means a disabled system feature does NOT produce a 404 for unauthenticated requests — unauthenticated callers bypass feature gates.

**Reproduction path:**
1. Disable `FEEDBACK_WIDGET` in `system_features`.
2. Send `GET /api/feedback` without Authorization header.
3. `featureGate('FEEDBACK_WIDGET', 'system')` reads `ctx.systemFeatures['FEEDBACK_WIDGET']` which is `undefined` (not `false`).
4. `undefined === false` is `false`, so the gate does not fire, `next()` is called.
5. The request proceeds to the next middleware (authenticate), which will reject it — but the wrong error is produced (401 rather than 404), and if authenticate is ordered after featureGate, the 404 guarantee is broken by design.

**Root cause:** Two intertwined issues — (a) the `?? 'anonymous'` fallback should not be used for cache lookups, and (b) the `=== false` check fails to treat `undefined` (feature missing from DB/context) the same as `false`.

**Fix (this PR):**
In `featureGate`, replace:

```ts
const userId = req.user?.userId ?? 'anonymous';
const ctx = await getPermissionContext(userId, workspaceId);
if (ctx.systemFeatures[featureCode] === false) { ... }
```

with a hard-coded fast path for the system-feature check. `SystemFeature` data does not depend on the authenticated user — load it via a dedicated call or expose `getSystemFeatureContext()` that reads only `system_features` from cache. Short-term fix:

```ts
// featureGate does not need per-user context — only system/ws feature flags
const userId = req.user?.userId;
// if unauthenticated, let authenticate middleware reject; featureGate only needs the flags
const ctx = userId
  ? await getPermissionContext(userId, workspaceId)
  : await getSystemFeaturesOnly(workspaceId); // new thin helper

// treat undefined as "assume enabled" is documented, but treat absence of feature
// from the loaded set as "not explicitly disabled" — this is acceptable when the
// seed guarantees all known features exist. Document this assumption explicitly.
if (ctx.systemFeatures[featureCode] === false) { ... }
```

Alternatively — and more robustly — move `featureGate` to always sit AFTER `authenticate` in the middleware chain and remove the `?? 'anonymous'` fallback entirely.

**Where to fix:** This PR.

---

#### H2 — `requireBoardAction` makes a second uncached DB round-trip to resolve `workspaceId`

**File:** `backend/src/shared/middleware/require-permission.ts` lines 161–198, specifically `loadBoardWorkspaceId` (lines 190–198)

**Description:**
`requireBoardAction` calls `canAccessBoard` (which calls `loadBoardAccessContextFromDb`, itself doing 2–3 DB queries), then immediately calls `loadBoardWorkspaceId` which issues an additional `prisma.board.findUnique`. The board's `workspaceId` is already available in `BoardAccessContext` (the `board` record is fetched in `loadBoardAccessContextFromDb`), but it is not surfaced in the `BoardAccessResult` or `BoardAccessContext` public types.

This is primarily a performance issue but has a security implication: there is a window between `canAccessBoard` reading the board and `loadBoardWorkspaceId` reading it again. If the board is deleted between these two reads (soft-delete or hard-delete), `loadBoardWorkspaceId` throws a 404 while the access check passed, which is inconsistent. More critically, if the board's `workspaceId` changes (unlikely but possible via a schema migration or data fix), the `isAllowed` call uses a different workspace than the one `canAccessBoard` evaluated — effectively checking permissions in the wrong workspace context.

**Fix (this PR, low effort):**
Extend `BoardAccessContext` and `BoardAccessResult` to include `workspaceId: string | null`, populate it in `loadBoardAccessContextFromDb`, surface it in `decideBoardAccess`, and eliminate `loadBoardWorkspaceId`. This also eliminates the dynamic `import()` inside the middleware function body.

**Where to fix:** This PR (the types are not yet used by any Phase 2 code).

---

#### H3 — `WorkspaceMember → RolePreset` FK uses `ON DELETE SET NULL`, not `RESTRICT`; deleted preset leaves members with null rolePresetId silently

**File:** `backend/src/prisma/migrations/20260518143122_.../migration.sql` line 113; `backend/src/prisma/schema.prisma` line 165

**Description:**
The migration creates:

```sql
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_role_preset_id_fkey"
  FOREIGN KEY ("role_preset_id") REFERENCES "role_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

And identically for `BoardMember → RolePreset` (line 131). This means deleting a custom `RolePreset` silently sets `rolePresetId = NULL` for all members using it. A `WorkspaceMember` with `rolePresetId = NULL` and `role = MEMBER` (legacy) will fall back to the legacy role enum path during Phase 1; but once Phase 3 removes that fallback, all affected members lose access entirely — silently and without notification.

The plan (Step 1.6, R14) calls for `RESTRICT` + `409 ROLE_IN_USE`. But the *migration itself* does not implement `RESTRICT` — it implements `SET NULL`. This contradicts the documented threat model. The `RESTRICT` behaviour must be enforced in the deletion service endpoint, not at the FK level, which is a weaker guarantee. A direct `DELETE FROM role_presets` via a DB console, Prisma Studio, or a future raw query bypasses the service check entirely.

**Fix (separate migration or this PR if possible):**
Change the FK to `ON DELETE RESTRICT` in the schema:

```prisma
// WorkspaceMember
rolePreset RolePreset? @relation(fields: [rolePresetId], references: [id], onDelete: Restrict)

// BoardMember
rolePreset RolePreset? @relation(fields: [rolePresetId], references: [id], onDelete: Restrict)
```

A `Restrict` FK still needs the service-level `409 ROLE_IN_USE` (for a user-friendly error), but it also guarantees DB-level integrity as a backstop. Because the Prisma schema marks `rolePresetId` as optional and the relation as nullable, Prisma will accept `Restrict` semantics. Re-generate the migration to add `ALTER TABLE ... ALTER CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED` if needed for the backfill scenario.

**Where to fix:** This PR (new migration or alter the existing one before it is deployed).

---

### MEDIUM

---

#### M1 — Default-allow semantics for absent feature codes leak through to `featureGate` workspace check

**File:** `backend/src/shared/middleware/require-permission.ts` lines 115–127

**Description:**
Both `featureGate` and `requirePermission` use the pattern:

```ts
if (ctx.systemFeatures[featureCode] === false) { ... }
if (ctx.workspaceFeatures[featureCode] === false) { ... }
```

If a feature code is queried that was never inserted into `system_features` (e.g. a typo in the call site like `featureGate('FEEDBAK_WIDGET', 'system')`), the lookup returns `undefined`, the comparison `undefined === false` is `false`, and the gate is silently skipped — the feature appears enabled. This is the documented "default-allow" design (plan §Open Q, threat model row 10), but it offers no protection against typos in the feature code string at call sites, since `featureCode` is typed as `string` not as the enum.

**Fix (this PR):**
Add a TypeScript type for the known system feature codes and workspace feature codes:

```ts
type SystemFeatureCode = 'LOCAL_REGISTRATION' | 'SSO' | 'MFA' | 'EMAIL_NOTIFICATIONS'
  | 'FEEDBACK_WIDGET' | 'API_KEYS' | 'GLOBAL_SEARCH' | 'REGISTRATION_REQUESTS';

type WorkspaceFeatureCode = 'WS_COMMENTS' | 'WS_CHECKLISTS' | 'WS_LABELS' | 'WS_BULK_OPS'
  | 'WS_EXPORT' | 'WS_HISTORY_UI' | ...;
```

Change `featureGate(featureCode: string, ...)` to accept the typed union. This catches typos at compile time and makes the default-allow assumption explicit.

**Where to fix:** This PR.

---

#### M2 — `presetPermissionsById` is optional and not populated by `loadPermissionContextFromDb`; `canActOnBoard` with board-override role silently falls back to workspace role

**File:** `backend/src/shared/utils/permissions-cache.ts` line 38; `backend/src/shared/utils/permissions.ts` lines 114–118

**Description:**
`PermissionContext.presetPermissionsById` is typed as `Record<string, Set<string>> | undefined`. It is an "optional lookup" comment: "present only when `canActOnBoard` needs it." However, `loadPermissionContextFromDb` does NOT populate it — no query fetches role preset permissions keyed by preset ID. The `decide()` function uses it at Rule 5:

```ts
const roleSet = opts.withRole
  ? ctx.presetPermissionsById?.[opts.withRole]
  : ctx.workspaceRolePermissions;
if (roleSet?.has(permission)) return true;
```

When `opts.withRole` is set (the board-override case) and `presetPermissionsById` is `undefined`, `roleSet` is `undefined`, `roleSet?.has(permission)` is `undefined` (falsy), and Rule 5 is silently skipped. Execution falls through to Rule 6 (global role). This means a board member with a board-override role preset that has fewer permissions than their global role will actually get more permissions than intended — the board override is silently ignored and the global role fallback kicks in.

**Example:** A user has a global `system:admin` role (with `ADMIN_*` permissions) and is added to a private board with `system:viewer` override. `canActOnBoard` calls `isAllowed(..., { withRole: 'system:viewer-uuid' })`. `presetPermissionsById` is `undefined` → Rule 5 skipped → Rule 6 checks `globalRolePermissions` which contains `ADMIN_*`. The viewer restriction is bypassed.

**Fix (this PR):**
Either (a) populate `presetPermissionsById` in `loadPermissionContextFromDb` by fetching all `RolePermission` rows for the presets that are referenced in `opts.withRole`, or (b) explicitly fail-closed when `presetPermissionsById` is undefined but `withRole` is set:

```ts
const roleSet = opts.withRole
  ? ctx.presetPermissionsById?.[opts.withRole] // if undefined → no permissions from this preset
  : ctx.workspaceRolePermissions;

// CRITICAL: if withRole is set but preset not loaded, do NOT fall through to global role.
// The board-override role is the authoritative role for this board context.
if (opts.withRole && roleSet === undefined) {
  // preset data not loaded — deny to fail-closed, log a warning
  return false;
}
if (roleSet?.has(permission)) return true;

// Only fall through to global role if withRole was NOT set
if (!opts.withRole && ctx.globalRolePermissions.has(permission)) return true;
```

Option (b) is the minimal safe fix for this PR. Option (a) is needed for correctness in Phase 2 when board overrides carry real custom presets.

**Where to fix:** This PR (the fallback path is wrong by design and will manifest in Phase 2).

---

#### M3 — Cache invalidation does not cover `BoardMember` mutations; board-level access results stay stale for up to 5 minutes

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 147–155

**Description:**
`getBoardAccessContext` explicitly bypasses the cache ("for now skip caching"). This means every `canAccessBoard` call always hits the DB — which is correct for correctness. However, the `PermissionContext` cache (used by `isAllowed`) is keyed on `(userId, workspaceId)` and is invalidated via `permissionsRev`. The plan states that `BoardMember` mutations should increment `permissionsRev` (plan R8-ACL: "Cache not invalidates on BoardMember change"). But in Phase 1 the board-members endpoints are not yet wired, so no `permissionsRev` increment will happen after `BoardMember` changes.

When Phase 2 wires `requireBoardAction`, the path is: `canAccessBoard` (always-fresh, correct) → `isAllowed(..., withRole)` (uses cached context). If the user's workspace role or overrides changed since the cache was last populated, `isAllowed` will use stale data even though `canAccessBoard` returned fresh access. The net effect: correct access gating on the board level, but potentially wrong permission level for the action.

**Fix (Phase 2, document now):**
The Phase 2 board-members service must increment `permissionsRev` for the affected user any time a `BoardMember` is inserted, updated, or deleted — exactly as documented in the plan for workspace-level mutations. Document this as a hard requirement in the board-members service implementation note.

**Where to fix:** Document the requirement in this PR; implement in the board-members service (Step 1.8).

---

#### M4 — `UserPermission` unique constraint does not include `workspaceId=NULL` as distinct from `workspaceId=<value>`; GLOBAL and WS overrides for the same permission are conflated at DB level

**File:** `backend/src/prisma/schema.prisma` line 628; `backend/src/prisma/migrations/.../migration.sql` line 101

**Description:**
The unique constraint is:

```sql
CREATE UNIQUE INDEX "user_permissions_userId_workspaceId_permission_key"
  ON "user_permissions"("userId", "workspaceId", "permission");
```

In PostgreSQL, `NULL != NULL` in unique indexes — two rows with `(userId, NULL, COMMENT_CREATE)` and `(userId, 'ws1', COMMENT_CREATE)` are both allowed, and a second row with `(userId, NULL, COMMENT_CREATE)` would violate the constraint. This is the desired behaviour (one GLOBAL override, one WS-specific override per user per permission). However, the unique constraint includes `workspaceId` which is nullable. PostgreSQL treats multiple NULLs as distinct by default in unique indexes (prior to PG 15 `NULLS NOT DISTINCT`). This means a user could theoretically have two GLOBAL overrides for the same permission code (e.g. one GRANT and one REVOKE), since two rows with `workspaceId=NULL` do NOT violate the uniqueness in PostgreSQL's standard behaviour.

On PostgreSQL 15+, you can use `NULLS NOT DISTINCT` to close this. On older versions, you need a partial index or a functional index. If the application currently runs on PG 16 (per CLAUDE.md), this is available.

**Impact:** If a user has both `(userId, NULL, COMMENT_CREATE, GRANT)` and `(userId, NULL, COMMENT_CREATE, REVOKE)`, the `loadPermissionContextFromDb` query retrieves both and adds the same key to both `grants` and `revokes`. Since revoke wins over grant in the algorithm (Rule 3 before Rule 4), the user is correctly denied — but the data inconsistency is silent and can confuse audit tooling.

**Fix (this PR or a follow-up migration):**
Add `NULLS NOT DISTINCT` to the unique index on PG 16:

```sql
CREATE UNIQUE INDEX "user_permissions_userId_workspaceId_permission_key"
  ON "user_permissions"("userId", "workspaceId", "permission") NULLS NOT DISTINCT;
```

Or add a service-level check that rejects creating a second override of any type for the same `(userId, workspaceId, permission)` when `workspaceId` is null.

**Where to fix:** Separate migration (not blocking Phase 2, but should be done before the override management UI ships).

---

#### M5 — `featureGate` for `scope='system'` does not verify `workspaceId` origin; workspace-scoped check uses an untrusted route param

**File:** `backend/src/shared/middleware/require-permission.ts` lines 108–133

**Description:**
For `scope='workspace'`, the middleware reads `workspaceId` from `req.params[workspaceParam]`. There is no check that the authenticated user is a member of that workspace before calling `getPermissionContext`. The cache lookup for an arbitrary workspaceId provided by the attacker will call `loadPermissionContextFromDb(userId, attackerWorkspaceId)`. The DB call itself is safe (Prisma parameterized queries), and the returned context will have `workspaceFeatures: {}` for a workspace the user doesn't belong to (the user would have no `WorkspaceMember` row). This means features appear enabled by default for foreign workspaces.

This is lower-risk in isolation because the real business endpoints should independently check workspace membership. But as a principle, `featureGate` should not be callable with attacker-controlled workspaceIds that yield trust in the default-allow path.

**Fix (this PR, low effort):**
In `featureGate`, when `scope='workspace'` and the user is authenticated, load the context and additionally check that `ctx.isGuest !== undefined` or better verify workspace membership by checking `wsMember !== null` from the loaded context. Alternatively, only call `getPermissionContext` if the userId is set, and fail-closed if it's not.

**Where to fix:** This PR.

---

### LOW

---

#### L1 — `PermissionCode` is typed as `string` in engine and middleware, not as the Prisma-generated enum

**File:** `backend/src/shared/utils/permissions.ts` line 20

```ts
export type PermissionCode = string; // narrows once Prisma enum is generated
```

This comment suggests the type will be updated once Prisma generates the enum, but the Prisma schema already defines `enum PermissionCode`. Prisma generates the corresponding TypeScript union. The engine should now import and use `Prisma.PermissionCode` or the Prisma-generated type. Keeping it as `string` means call sites can pass any arbitrary string (e.g. `isAllowed(userId, wsId, 'ADMIN_USER')` — note the typo — compiles fine) and fails silently with `false` at runtime. Given the security sensitivity of this engine, this compile-time safety is not optional.

**Fix (this PR):**
Replace:
```ts
export type PermissionCode = string;
```
with:
```ts
import type { PermissionCode } from '@prisma/client';
export type { PermissionCode };
```

**Where to fix:** This PR.

---

#### L2 — `addedBy` field in `BoardMember` is not validated at the engine level; it is a free-text `String`, not an FK to `users`

**File:** `backend/src/prisma/schema.prisma` lines 638–639; `backend/src/prisma/migrations/.../migration.sql` lines 80–86

`BoardMember.addedBy` is `String @map("added_by")` with no FK constraint. The migration creates the table with `added_by TEXT NOT NULL` but no `REFERENCES users(id)`. If the service layer is ever bypassed (direct DB write, future migration bug), `addedBy` can hold any arbitrary value — an orphaned string that has no audit trail. This also means that if a user is deleted (`onDelete: Cascade` on `BoardMember.userId`), the `addedBy` field is left with the deleted user's ID (as a dangling reference, not a DB error) — the audit record loses its actor.

**Fix (separate issue):**
Add a FK: `addedByUser User? @relation("BoardMemberAddedBy", fields: [addedBy], references: [id], onDelete: SetNull)`. Mark `addedBy` as `String?` (nullable). If the business requirement is that `addedBy` must always be known, use `onDelete: Restrict` and handle deletion of users who have added board members first.

**Where to fix:** Separate issue / follow-up migration before Phase 2 ships the board-members endpoints.

---

#### L3 — Audit log entries for permission operations reference `actorId` but not the affected `userId`; makes user-centric audit queries impossible

**File:** `backend/src/shared/utils/audit-logger.ts` (existing); referenced in plan Step 1.11

The `AuditLog` schema has `actorId` (who did it) and `targetId?` (what was affected). For permission mutations like `permissions.user_override.granted`, the convention should be `targetId = affectedUserId`. However, the schema does not distinguish between entity types (`targetId` is untyped `String?`). If `targetId` is used for both `userId` and `rolePresetId` in different events, querying "all permission changes for user X" requires filtering by both `action` and `targetId`, which is fragile.

**Fix (low effort, this PR or Step 1.11):**
Ensure the audit log calls in Step 1.11 always include `{ affectedUserId, rolePresetId }` in the `meta: Json` field. Document this convention in the `AuditLog` model's comment.

**Where to fix:** Step 1.11 implementation.

---

#### L4 — `featureGate` with `scope='system'` returns 404 to authenticated and unauthenticated callers alike; information disclosure through distinguishable error codes

**File:** `backend/src/shared/middleware/require-permission.ts` lines 115–117

```ts
if (ctx.systemFeatures[featureCode] === false) {
  return next(new AppError(404, 'Не найдено'));
}
```

Returning 404 for a disabled system feature is intentional (endpoint "doesn't exist"). However, this 404 is returned before authentication in the planned middleware order for module-level gates (plan §Permission middleware design: `featureGate('FEEDBACK_WIDGET', 'system') → authenticate → ...`). An unauthenticated caller receives 404 when the feature is disabled and would receive 401 when it is enabled — this distinguishes whether a feature is enabled or not without authentication, leaking system configuration to external observers.

**Severity context:** For internal enterprise deployments this is LOW; for SaaS where users should not know which modules are active this is MEDIUM. Flagged as LOW here because the current deployment context (FlowTask standalone) is internal.

**Fix (this PR or Phase 2):**
Move `featureGate` to always come after `authenticate`, or return 401 for unauthenticated requests before checking the feature flag. The 404 behaviour is preserved for authenticated users (matching the spec intent).

**Where to fix:** Phase 2 (when featureGate is applied to existing endpoints). Document the ordering requirement.

---

#### L5 — `invalidateUser` and `invalidateWorkspace` iterate all secondary index entries to clean cross-references; O(N) iteration over all users or workspaces in cache

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 159–178

```ts
export function invalidateUser(userId: string): void {
  const keys = byUser.get(userId);
  if (!keys) return;
  for (const key of keys) {
    cache.delete(key);
    for (const set of byWorkspace.values()) set.delete(key); // O(W) per key
  }
  byUser.delete(userId);
}
```

`invalidateUser` iterates every workspace's index set to remove the deleted key. If there are W active workspaces cached and U keys per user, this is O(U × W). Under load (10k cached entries, 500 active workspaces), an invalidation storm (e.g. a bulk role change for many users) could cause a spike. This is not a security vulnerability per se, but it creates a potential DoS vector if an attacker triggers many role changes in rapid succession.

**Fix (low effort, this PR or follow-up):**
Maintain a `keyToUserWorkspace` reverse index: `Map<cacheKey, { userId, workspaceId }>`. `indexRemove` then becomes O(1). Alternatively, store the userId and workspaceId in the `CacheEntry` itself.

**Where to fix:** This PR or a dedicated performance follow-up before load testing.

---

#### L6 — `system:member` seed in migration includes `TASK_BULK_EDIT` and `TASK_EXPORT` but the plan Step 1.2 commentary says TASK_EXPORT is excluded from member

**File:** `backend/src/prisma/migrations/.../migration.sql` lines 168–181; `tasks/feature-permissions-acl/plan.md` Step 1.2

The plan commentary for `system:member` explicitly says "without TASK_EXPORT — plan §Open Q1". However the migration seed for `system:member` does NOT include `TASK_EXPORT` — this is actually correct. But `TASK_BULK_EDIT` is included in `system:member`, which the plan also lists. Cross-checking with `system:owner`: the seed includes `TASK_EXPORT` only in the owner preset (line 192). This is consistent with the plan. No actual discrepancy for the DB data.

However: the plan Step 1.2 commentary at line 136 says `system:member` gets `TASK_BULK_EDIT`, which is in the seed. But Open Q1 is about TASK_EXPORT — the plan table says it is excluded from member. The seed is correct. This is a documentation ambiguity — the open question commentary is about TASK_EXPORT, and the seed correctly excludes it from member. **No code change needed**, but add a comment to the seed to make the exclusion explicit.

**Where to fix:** Documentation / inline comment in migration seed (this PR).

---

#### L7 — `loadBoardAccessContextFromDb` returns a permissive context when the board exists but the user is not found, rather than treating it as fully denied

**File:** `backend/src/shared/utils/permissions-loader.ts` lines 113–124

```ts
if (!board || !user) {
  return {
    isSuperadmin: user?.isSuperadmin ?? false,
    workspaceDeletedAt: null,
    isWorkspaceMember: false,
    isWorkspaceOwner: false,
    workspaceRolePresetId: null,
    isGuest: false,
    boardIsPrivate: false,   // ← defaults private to false
    boardMember: null,
  };
}
```

When `!user` is true (user not found or deleted), `boardIsPrivate: false` is returned. In `decideBoardAccess`, if `isSuperadmin=false`, `isWorkspaceMember=false`, this hits rule 0c and returns `{ allowed: false }` — correct. So the current code is safe via rule 0c. But the `boardIsPrivate: false` value is misleading — the actual privacy state of the board is unknown. If rule ordering ever changes in a future refactor, this false default could cause a private board to appear public to a non-existent user.

**Fix (this PR, minimal):**
When `!user || !board`, return `boardIsPrivate: true` as the conservative default (or better, only return the actual board's `isPrivate` when the board was found):

```ts
if (!board || !user) {
  return {
    ...
    boardIsPrivate: board?.isPrivate ?? true, // conservative default: unknown = private
    ...
  };
}
```

**Where to fix:** This PR.

---

#### L8 — No rate limiting on the new permission-read path; `requirePermission` can be triggered multiple times per request if mounted on multiple middleware layers

**File:** `backend/src/shared/middleware/require-permission.ts`

In Phase 2, some route chains may have both `requireBoardAccess` and `requireBoardAction` mounted. Each calls `canAccessBoard`. If `req.boardAccess` is already set (line 168: `const access = req.boardAccess ?? ...`), the second call is short-circuited. However, if `requirePermission` (workspace check) and `requireBoardAction` (board check) are both mounted on the same route, `isAllowed` will be called twice for the same user, causing two cache lookups (two hits or two misses). This is not a security issue but a correctness / performance pattern that needs documentation.

**Fix (documentation):** Add JSDoc to `requirePermission` and `requireBoardAction` stating they should not both be mounted on the same route and clarifying their composition contract.

**Where to fix:** This PR (JSDoc only).

---

### INFO / NIT

---

#### I1 — `__clearCacheForTests` is exported from production cache module

**File:** `backend/src/shared/utils/permissions-cache.ts` lines 187–190

The `__clearCacheForTests` function is prefixed with `__` by convention but is exported from the production module without any environment guard. If an internal module ever calls it by mistake, the permission cache is silently wiped. Consider moving it to a separate `permissions-cache.test-helpers.ts` file that is conditionally imported only in test environments, or guard it with `if (process.env.NODE_ENV !== 'production') throw new Error(...)`.

**Where to fix:** This PR (low-risk but should be cleaned up).

---

#### I2 — `decide()` in `permissions.ts` is not exported; makes targeted unit testing of the pure algorithm without async overhead impossible

**File:** `backend/src/shared/utils/permissions.ts` lines 85–124

The `decide()` function is the pure synchronous heart of the permission algorithm. It is currently private (not exported). Tests in `is-allowed.test.ts` test it indirectly through `isAllowed()`, which adds async overhead and mocking complexity. Exporting `decide` (perhaps as `_decideForTest` or via a test-only export barrel) would allow the algorithm to be tested with zero mocking.

**Where to fix:** This PR (minor refactor, test quality improvement).

---

#### I3 — `system:member` seed at migration step 4 duplicates all 8 viewer codes verbatim; future viewer permission additions won't automatically propagate to member

**File:** `backend/src/prisma/migrations/.../migration.sql` lines 168–181

The member preset seed copies the viewer permission list literally. If a future migration adds a new READ permission to `system:viewer`, it must also be manually added to `system:member` and `system:owner` seeds in a new migration. A comment to this effect is absent. This is a maintainability concern, not a security issue, but omitting a READ permission from member while it exists in viewer would create a confusing permission inversion.

**Where to fix:** Document the pattern in a comment within the migration seed (this PR).

---

#### I4 — No validation that `opts.withRole` is a valid preset ID; arbitrary strings accepted

**File:** `backend/src/shared/utils/permissions.ts` lines 114–118

`isAllowed` accepts `opts.withRole` as a free string. If the caller passes an invalid preset ID, `ctx.presetPermissionsById?.[opts.withRole]` returns `undefined`, and with the current code the logic silently falls through. With the proposed fix in M2 (fail-closed when `withRole` is set but lookup fails), this becomes a deny — correct. But a log warning would help diagnose misconfiguration.

**Where to fix:** Implement as part of M2 fix (this PR).

---

## Summary Table

| ID | Severity | Title | Where to Fix |
|----|----------|-------|--------------|
| H1 | HIGH | Anonymous cache read in `featureGate`; disabled system features don't block unauthenticated requests | This PR |
| H2 | HIGH | Second uncached DB round-trip for `workspaceId` in `requireBoardAction`; TOCTOU window | This PR |
| H3 | HIGH | `WorkspaceMember/BoardMember → RolePreset` FK is `SET NULL`, not `RESTRICT`; DB-level integrity gap | This PR (new migration) |
| M1 | MEDIUM | `featureCode` typed as `string`; typos bypass feature gates silently | This PR |
| M2 | MEDIUM | `presetPermissionsById` not populated; board-override role silently skipped, global role used instead | This PR |
| M3 | MEDIUM | BoardMember mutations don't increment `permissionsRev`; `isAllowed` uses stale context post-Phase 2 | Document now; fix in Step 1.8 |
| M4 | MEDIUM | `user_permissions` unique index allows duplicate GLOBAL overrides on PG < 15 | Separate migration before override UI ships |
| M5 | MEDIUM | `featureGate` workspace scope uses attacker-controlled `workspaceId` without membership check | This PR |
| L1 | LOW | `PermissionCode` typed as `string` instead of Prisma-generated enum | This PR |
| L2 | LOW | `BoardMember.addedBy` is untyped free-text, not an FK to `users` | Separate issue / pre-Phase 2 migration |
| L3 | LOW | Audit log `targetId` is untyped; user-centric audit queries are fragile | Step 1.11 implementation |
| L4 | LOW | `featureGate` 404 before auth leaks system feature state to unauthenticated callers | Phase 2 (ordering fix) |
| L5 | LOW | `invalidateUser`/`invalidateWorkspace` are O(N×M); DoS vector under bulk role changes | This PR or perf follow-up |
| L6 | LOW | Migration seed exclusion of TASK_EXPORT from member lacks inline comment (no code error) | This PR (comment only) |
| L7 | LOW | `loadBoardAccessContextFromDb` defaults `boardIsPrivate: false` when user not found | This PR (conservative default) |
| L8 | LOW | No documentation on `requirePermission` + `requireBoardAction` composition contract | This PR (JSDoc) |
| I1 | INFO | `__clearCacheForTests` exported from production module without env guard | This PR |
| I2 | INFO | `decide()` not exported; pure algorithm harder to unit-test directly | This PR |
| I3 | INFO | Viewer→Member→Owner permission inheritance not documented in migration seed | This PR (comment) |
| I4 | INFO | No warning logged when `withRole` resolves to undefined preset | Part of M2 fix |

---

## No Issues Found In

- **SQL injection**: All seeds use `FROM (VALUES (...)) AS t(p)` with `p::"PermissionCode"` cast — values are literals from the migration, not user input. No injection surface.
- **Hardcoded secrets**: No API keys, passwords, or tokens in any reviewed file.
- **`permissionsRev` cache poisoning**: The field is not accepted from any API surface — it is server-side only, incremented via Prisma. The threat model item is correctly mitigated.
- **`isSuperadmin` scope (Rule 0)**: The shortcut applies only to `permission.startsWith('ADMIN_')`. Non-admin permissions fall through the full algorithm. A superadmin without an explicit workspace role or override cannot perform workspace operations via the ADMIN_* shortcut alone. Correct.
- **REVOKE wins over GRANT**: Rules 3 and 4 enforce this correctly. Rule 3 (revoke check) executes before Rule 4 (grant check). Both workspace and global scopes are checked in the correct order. The test `'REVOKE beats GRANT on same scope'` covers this.
- **Guest scenarios (Rule 4)**: `boardMember: null` and `boardMember: undefined` are both falsy; the code checks `ctx.boardMember` at lines 176–186. Prisma returns `null` (not `undefined`) for missing relations when selected with `findUnique`. The guard `if (ctx.boardMember && ...)` correctly handles both the null case and the `{ rolePresetId: null }` (explicit deny) case without conflation.
- **Migration idempotency**: `ON CONFLICT DO NOTHING` on all seed inserts. Backfill UPDATEs include `WHERE role_preset_id IS NULL` guard. Re-running is safe.
- **FK cascade on `Board → BoardMember`**: `ON DELETE CASCADE` — correct; deleting a board removes its ACL entries.
- **FK cascade on `User → UserPermission`**: `ON DELETE CASCADE` — correct; deleting a user removes their overrides.
- **FK cascade on `Workspace → WorkspaceFeature`**: `ON DELETE CASCADE` — correct.
