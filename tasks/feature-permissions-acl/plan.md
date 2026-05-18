# Implementation Plan: Feature-Permissions + Per-Board ACL

> Owner: jackrescuer-gif
> Дата: 2026-05-18
> SDD: `docs/design/feature-permissions.md` (G2-1 approved), `docs/design/board-acl.md` (G2-2 approved)
> BDD: `specs/feature-permissions.feature` (~25 сценариев), `specs/board-acl.feature` (~30 сценариев)
> Размер: **XL** (~150 идеальных часов на все три фазы)

## Overview

Двухслойное изменение модели прав:

1. Заменить плоскую `WorkspaceRole = OWNER|MEMBER|VIEWER` на двухуровневую систему «feature-toggles (system+workspace) + RolePreset + PermissionCode + UserPermission overrides».
2. Поверх неё — per-board ACL через `BoardMember` (override / DENY) + `WorkspaceMember.isGuest` для гостей одной доски.

После фичи: `if (member.role !== 'OWNER')` ⟶ `await isAllowed(userId, wsId, 'WS_EDIT_SETTINGS')`. `boards.service.listByWorkspace` ⟶ фильтр через `canAccessBoard`. Появляется admin UI «Системные фичи / Роли», workspace UI «Фичи / Расширенные роли», board UI «Доступ к доске».

## Что входит в этот conversation

**Только Phase 1** (additive миграция + admin/owner CRUD endpoints + базовый UI «можно настроить»). Reasoning:

- Phase 2 (замена `assertOwner` → `requirePermission` в ~10 модулях) — большой риск регресса; требует своих G2 / G4 / G7 циклов после стабилизации Phase 1.
- Phase 3 — отдельный PR через 2–3 релиза.

Между Phase 1 и Phase 2 — релиз с feature-flag `PERMISSIONS_V2=false`. Когда `PERMISSIONS_V2=true`, новые проверки активируются — даёт быстрый rollback.

## Requirements

- Сохранить backward compat на API: `WorkspaceMember.role` остаётся в response пока Phase 3.
- Все existing тесты (`backend/src/__tests__/*.test.ts`, 18 файлов) должны проходить без изменений на Phase 1.
- Backfill `rolePresetId` для всех существующих WorkspaceMember в той же миграции.
- Системные роли защищены: `isSystem=true`, удалять/переименовывать нельзя.
- Каскад: `User` → CASCADE `UserPermission`, `BoardMember`; `Workspace` → CASCADE `WorkspaceFeature`; `RolePreset` (custom) → RESTRICT если используется в `WorkspaceMember` или `BoardMember`.

---

## Architecture Changes

### Prisma schema (`backend/src/prisma/schema.prisma`)

| Изменение | Тип |
|-----------|-----|
| `enum PermissionCode` (~46 кодов) | NEW |
| `enum PermissionType { GRANT, REVOKE }` | NEW |
| `enum FeatureScope { SYSTEM, WORKSPACE }` | NEW |
| `model SystemFeature` | NEW |
| `model WorkspaceFeature` | NEW |
| `model RolePreset` | NEW |
| `model RolePermission` | NEW |
| `model UserPermission` | NEW |
| `model BoardMember` (board-acl) | NEW |
| `User.globalRolePresetId` (nullable FK) | ADD |
| `User.permissionsRev Int @default(0)` (для cache-invalidation) | ADD |
| `WorkspaceMember.rolePresetId` (nullable FK) | ADD |
| `WorkspaceMember.isGuest Boolean @default(false)` | ADD |
| `WorkspaceMember.role: WorkspaceRole` | KEEP (deprecated до Phase 3) |
| `Board.members BoardMember[]` (back-relation) | ADD |
| `enum WorkspaceRole` | KEEP (deprecated до Phase 3) |

### Backend модули

| Файл | Изменение |
|------|-----------|
| `backend/src/shared/utils/permissions.ts` | NEW: `isAllowed`, `canAccessBoard`, `canActOnBoard`, `deriveFeatureCode`, `getEffectivePermissions`, `bulkCanAccessBoards` |
| `backend/src/shared/middleware/require-permission.ts` | NEW: `requirePermission(code)`, `requireBoardAccess()`, `requireBoardAction(perm)`, `featureGate(code, scope)` |
| `backend/src/shared/utils/permissions-cache.ts` | NEW: in-memory LRU + Redis invalidation на `permissionsRev` |
| `backend/src/modules/permissions/` | NEW МОДУЛЬ: `permissions.router.ts`, `permissions.service.ts`, `permissions.dto.ts` — admin endpoints из SDD §6.1 |
| `backend/src/modules/workspaces/workspace-features.router.ts` | NEW |
| `backend/src/modules/workspaces/workspace-features.service.ts` | NEW |
| `backend/src/modules/boards/board-members.router.ts` | NEW |
| `backend/src/modules/boards/board-members.service.ts` | NEW |
| `backend/src/modules/boards/boards.dto.ts` | EXTEND: `addBoardMemberDto`, `updateBoardMemberDto`, isPrivate в `createBoardDto` |
| `backend/src/modules/boards/boards.service.ts` | EXTEND (Phase 2): `listBoards`, `getBoard`, `getRoadmapTasks` через `canAccessBoard` |
| `backend/src/modules/admin/admin.router.ts` | EXTEND: mount `/system-features`, `/role-presets`, `/users/:id/permissions` |
| `backend/src/modules/admin/admin.dto.ts` | EXTEND |
| `backend/src/index.ts` | EXTEND: `featureGate(FEEDBACK_WIDGET)`, etc. + module-level skip |
| `backend/src/shared/openapi/routes/permissions.ts` | NEW |
| `backend/src/shared/openapi/routes/board-members.ts` | NEW |
| `backend/src/prisma/seed.ts` | EXTEND: seed 4 системных RolePreset + 8 SystemFeature; backfill для demo workspace |

### Frontend

| Файл | Изменение |
|------|-----------|
| `frontend/src/api/permissions.ts` | NEW |
| `frontend/src/api/admin.ts` | EXTEND: listSystemFeatures, toggleSystemFeature, role-presets, user-overrides |
| `frontend/src/api/boards.ts` | EXTEND: list/add/update/remove BoardMember |
| `frontend/src/api/workspaces.ts` | EXTEND: list/toggleWorkspaceFeature |
| `frontend/src/store/permissions.store.ts` | NEW: Zustand store эффективных пермиссий + permissionsRev poll |
| `frontend/src/hooks/usePermission.ts` | NEW |
| `frontend/src/hooks/useFeatureEnabled.ts` | NEW |
| `frontend/src/components/PermissionGate.tsx` | NEW |
| `frontend/src/components/BoardAccessModal.tsx` | NEW |
| `frontend/src/pages/AdminUsersPage.tsx` | EXTEND: вкладки «Системные фичи», «Роли», блок Overrides в user-detail |
| `frontend/src/pages/WorkspaceSettingsPage.tsx` | EXTEND: вкладка «Фичи», секция «Гости», расширенный role-dropdown |
| `frontend/src/pages/BoardPage.tsx` | EXTEND: кнопка «Доступ» (Phase 2) |
| `frontend/src/types/index.ts` | EXTEND: PermissionCode union, RolePresetDto, BoardMemberDto |

---

## Implementation Steps

### Phase 1 — Additive (in scope, ~96 ideal hours)

#### Step 1.1: Prisma schema + migration ★ critical-path

- **File**: `backend/src/prisma/schema.prisma`
- **Action**: добавить 3 enum, 6 моделей, расширить `User`, `WorkspaceMember`, `Board`.
- **Migration name**: `add_feature_permissions_and_board_acl`
- **Backfill в `migration.sql`** (ручное дополнение к auto-generated DDL):
  - INSERT 8 `SystemFeature` records (default enabled=true).
  - INSERT 4 `RolePreset` records с `isSystem=true`.
  - INSERT `RolePermission` для каждой системной роли.
  - `UPDATE workspace_members SET role_preset_id = system:owner.id WHERE role = 'OWNER'` (аналогично MEMBER/VIEWER).
  - `UPDATE users SET global_role_preset_id = system:admin.id WHERE is_superadmin = true`.
- **Risk**: High — Backfill в одной транзакции с DDL. Mitigation: миграция идемпотентна (`ON CONFLICT DO NOTHING`); тест-сценарий «миграция дважды подряд = no-op».
- **Verification**: `prisma migrate diff` показывает только additive; integration test: 0 строк `workspace_members WHERE role_preset_id IS NULL`; 4 строки `role_presets WHERE is_system=true`.

#### Step 1.2: PermissionCode enum + seed pack

- **File**: `backend/src/prisma/seed.ts`
- **Action**: вынести seed системных ролей в `seedSystemRolesAndFeatures()` (используется из migration backfill и dev seed).

**Permission seeds (закрытый список)**:

`system:viewer` (WORKSPACE scope) — **8 кодов**, только *_READ:
```
TASK_READ, BOARD_READ, WORKFLOW_READ, LABEL_READ,
COMMENT_READ, CHECKLIST_READ, HISTORY_READ, WORKSPACE_READ
```

`system:member` (WORKSPACE scope) — viewer + writes без destructive:
```
+ TASK_CREATE, TASK_UPDATE, TASK_REASSIGN, TASK_BULK_EDIT, TASK_EXPORT
+ BOARD_CREATE, BOARD_UPDATE
+ LABEL_CREATE, LABEL_UPDATE
+ COMMENT_CREATE, COMMENT_UPDATE_OWN, COMMENT_DELETE_OWN
+ CHECKLIST_WRITE
```
Без: TASK_DELETE, BOARD_DELETE, BOARD_MANAGE_COLUMNS, BOARD_MANAGE_ACL, COMMENT_DELETE_ANY, WS_*.

`system:owner` (WORKSPACE scope) — все WORKSPACE-permissions:
```
всё из member +
TASK_DELETE, BOARD_DELETE, BOARD_MANAGE_COLUMNS, BOARD_MANAGE_ACL,
LABEL_DELETE, COMMENT_DELETE_ANY,
WORKFLOW_CREATE, WORKFLOW_UPDATE, WORKFLOW_DELETE,
WS_INVITE_MEMBER, WS_REMOVE_MEMBER, WS_CHANGE_MEMBER_ROLE,
WS_EDIT_SETTINGS, WS_EDIT_SECURITY, WS_TOGGLE_FEATURES,
WS_DELETE, WS_RESTORE_FROM_TRASH
```

`system:admin` (SYSTEM scope):
```
ADMIN_USERS, ADMIN_ROLES, ADMIN_PERMISSIONS,
ADMIN_AUDIT, ADMIN_FEATURE_FLAGS, ADMIN_SYSTEM_CONFIG
```

- **Risk**: Medium — несоответствие enum и seed → FK violation. Mitigation: tsc-проверка `Object.values(PermissionCode)` ⊆ seed; runtime check на startup.
- **Test**: unit-test «`system:viewer` НЕ содержит ни одного write-кода».

#### Step 1.3: Permission engine

- **File**: `backend/src/shared/utils/permissions.ts`
- **Action**: алгоритм из feature-permissions §5 + board-acl §4.
  - `isAllowed(userId, workspaceId?, permission, opts?: { withRole?: presetId })`
  - `canAccessBoard(userId, boardId)` → `{ allowed, role, source: 'workspace'|'board-override'|'workspace-owner'|'superadmin'|'denied' }`
  - `canActOnBoard(userId, boardId, permission)` → boolean
  - `deriveFeatureCode(permission)` — map `COMMENT_CREATE` → `WS_COMMENTS`, `TASK_EXPORT` → `WS_EXPORT`, и т.д. Глобальные коды (`TASK_READ`) → `null`.
  - `bulkCanAccessBoards(userId, boardIds[])` — для list-эндпоинтов (R1-ACL).
- **Risk**: High — лажа в алгоритме → security regression. Mitigation: 100% unit-coverage на таблицу истинности из board-acl §4.1 + feature-permissions §5.
- **Verification**: 30+ unit-тестов по табличной матрице из SDD.

#### Step 1.4: Permission cache layer

- **File**: `backend/src/shared/utils/permissions-cache.ts`
- **Action**: in-memory LRU (`lru-cache` npm), ключ `{userId}:{workspaceId}:rev{permissionsRev}`, TTL 5 мин, capacity 10000.
  - `getEffectivePermissions(userId, workspaceId)` — кэш-aware враппер с aggregate-SQL (см. **Caching strategy** ниже).
  - Инвалидация: любая мутация (role/override/feature toggle/BoardMember) → `prisma.user.update({ permissionsRev: { increment: 1 } })`.
  - `WorkspaceFeature` мутация → инкремент `permissionsRev` для всех members workspace одним UPDATE.
  - `SystemFeature` → отдельный glob counter `systemRev`.
  - Redis pub/sub channel `permissions:changed:{userId}` для frontend refetch.
- **Risk**: Medium — несвоевременная инвалидация = user видит «старые права». Mitigation: bypass cache на security-changing endpoints (`fresh: true`).
- **Verification**: integration-test «owner меняет роль → следующий запрос видит новую роль».

#### Step 1.5: requirePermission middleware

- **File**: `backend/src/shared/middleware/require-permission.ts`
- **Action**: фабрика:
  ```
  requirePermission(code, opts?: { workspaceParam?: 'id'|'workspaceId' })
  requireBoardAccess()                       // 403 BOARD_ACCESS_DENIED
  requireBoardAction(perm)                   // 403 INSUFFICIENT_PERMISSION
  featureGate(featureCode, scope)            // 404 для system off, 403 FEATURE_DISABLED для ws off
  ```
- В Phase 1 — только на новых endpoints (admin, workspace-features, board-members). В Phase 2 — заменяет `assertOwner` в существующих сервисах.

#### Step 1.6: Admin permissions endpoints (SDD §6.1)

- **Files**: `backend/src/modules/permissions/permissions.router.ts`, `.service.ts`, `.dto.ts`
- **Routes**:
  - `GET /api/admin/system-features`, `PATCH /api/admin/system-features/:code`
  - `GET /api/admin/role-presets?scope=`, `POST`, `PATCH /:id`, `DELETE /:id`
  - `GET /api/admin/users/:id/permissions`, `PATCH /api/admin/users/:id/role`
  - `POST /api/admin/users/:id/permissions`, `DELETE /api/admin/users/:id/permissions/:permId`
- **Guard**: `authenticate → requireSuperadmin` (Phase 1). Phase 2 → `requirePermission('ADMIN_ROLES')`.
- **Validation**:
  - `RolePreset.scope=WORKSPACE` → Zod refinement отвергает все `ADMIN_*` коды.
  - `isSystem=true` → `PATCH` allowed только для `displayName`; `DELETE` → 409 `SYSTEM_ROLE_PROTECTED`.
  - DELETE custom role с активными users/members → 409 `ROLE_IN_USE` с count (R14).
- **OpenAPI**: `backend/src/shared/openapi/routes/permissions.ts`.

#### Step 1.7: Workspace features endpoints (SDD §6.2)

- **Files**: `backend/src/modules/workspaces/workspace-features.router.ts` + service.
- **Routes**:
  - `GET /api/workspaces/:id/features` → 9 WS-кодов с `enabled` + computed `systemEnabled`.
  - `PATCH /api/workspaces/:id/features/:code` { enabled }
  - `GET /api/workspaces/:id/members/:userId/permissions`
  - `PATCH /api/workspaces/:id/members/:userId` { rolePresetId? } — расширяет existing endpoint.
  - `POST /api/workspaces/:id/members/:userId/permissions` { permission, type } — WORKSPACE-scoped overrides.
- **Guard**: Phase 1 — `assertOwner`; Phase 2 → `requirePermission('WS_TOGGLE_FEATURES')`, etc.
- **R8 backward compat**: `WorkspaceMemberDto` содержит и `role` (legacy, computed из `rolePreset.name`: `system:owner` → `OWNER`), и `rolePresetId`, `rolePreset`. CHANGELOG отмечает `role` deprecated.

#### Step 1.8: Board members endpoints (board-acl SDD §5)

- **Files**: `backend/src/modules/boards/board-members.router.ts` + service.
- **Routes**:
  - `GET /api/boards/:boardId/members` → `BoardAccessRowDto[]` (батч через `bulkCanAccessBoards`).
  - `POST /api/boards/:boardId/members` { userId | email, rolePresetId | null }
  - `PATCH /api/boards/:boardId/members/:userId` { rolePresetId | null }
  - `DELETE /api/boards/:boardId/members/:userId`
- **Guard**: `requirePermission('BOARD_MANAGE_ACL')`. Phase 1 — fallback на assertOwner (новые endpoints — без регрессий).
- **Guest auto-create**: `POST` с `email`: user не существует → invite flow; не в WorkspaceMember → `WorkspaceMember(isGuest=true)` + BoardMember в одной `prisma.$transaction({ isolationLevel: Serializable })`.
- **Edge errors**: `CANNOT_DENY_OWNER`, `CANNOT_GUESTIFY_OWNER`, `INVALID_ROLE_SCOPE`, `PRIVATE_BOARD_NEEDS_MEMBER`.
- **DELETE cascade guest** (R-GUEST-3): isGuest=true + count BoardMember = 0 после DELETE → CASCADE WorkspaceMember. Одна транзакция.

#### Step 1.9: `Board.isPrivate` toggle + create-board расширение

- **File**: `backend/src/modules/boards/boards.service.ts`
- **Action**: в `updateBoard` при `isPrivate=true` → проверить `boardMember.count >= 1` иначе 409 `PRIVATE_BOARD_NEEDS_MEMBER`.
- **createBoard**: опциональный `isPrivate` в DTO. Если `true` → в транзакции вставить `BoardMember(creatorId, rolePresetId=system:owner.id)` + `Board`.

#### Step 1.10: Защита от самоблокировки + auto-clear isGuest

- **File**: `backend/src/modules/workspaces/workspace-features.service.ts`
- **Last-owner protection**: если targetUserId == requesterId, target.role = `system:owner`, new.role != `system:owner` → count owners > 1 ? allow : 409 `LAST_OWNER_PROTECTED`.
- **R-GUEST**: при role=`system:owner` → `isGuest=false` автоматически. Триггер в service.

#### Step 1.11: Audit logging

- **File**: `backend/src/shared/utils/audit-logger.ts` (existing)
- **Actions**:
  - `permissions.system_feature.toggled`, `permissions.role_preset.{created,updated,deleted}`
  - `permissions.user_override.{granted,revoked}`
  - `permissions.workspace_feature.toggled`
  - `acl.board_member.{added,updated,removed}`
  - `acl.board.isPrivate.toggled`
  - Skipped notifications (R-GUEST-2): `acl.notification.skipped { reason: 'BOARD_ACCESS_DENIED' }`.

#### Step 1.12: Frontend — admin UI

- **File**: `frontend/src/pages/AdminUsersPage.tsx`
- 2 новые вкладки: «Системные фичи», «Роли». User detail extension: блок «Permissions» с dropdown + overrides.
- Новые компоненты:
  - `frontend/src/components/admin/SystemFeaturesTable.tsx`
  - `frontend/src/components/admin/RolePresetsTable.tsx`
  - `frontend/src/components/admin/RolePresetEditor.tsx` (permission grid)
  - `frontend/src/components/admin/UserOverridesPanel.tsx`
- **A11y**: toggle `role="switch"` + `aria-checked` + `aria-describedby`, confirmation `role="alertdialog"`, Tab/Space/Esc, visible focus.

#### Step 1.13: Frontend — workspace UI

- **File**: `frontend/src/pages/WorkspaceSettingsPage.tsx`
- Новая вкладка «Фичи». Расширить «Участники»:
  - dropdown с RolePresets (system + custom).
  - кнопка «Настроить пермиссии».
  - секция «Гости (N)» — collapsed (на Phase 1 пустая если board-members ещё не используется).
- Новые компоненты:
  - `frontend/src/components/workspace/FeatureTogglesPanel.tsx`
  - `frontend/src/components/workspace/MemberPermissionsModal.tsx`
  - `frontend/src/components/workspace/GuestsSection.tsx`

#### Step 1.14: Frontend — permissions store + hooks

- **File**: `frontend/src/store/permissions.store.ts`
- Zustand store:
  ```
  effectivePermissions: Record<workspaceId, Set<PermissionCode>>
  systemFeatures: Record<string, boolean>
  workspaceFeatures: Record<workspaceId, Record<string, boolean>>
  rev: number
  refresh(workspaceId?)
  isAllowed(workspaceId, code) → boolean
  ```
- Hooks: `usePermission('TASK_DELETE')`, `useFeatureEnabled('WS_COMMENTS', wsId)`.
- Component: `<PermissionGate code="TASK_DELETE" workspaceId={...}>{...}</PermissionGate>`.

#### Step 1.15: Tests (см. Test Strategy)

#### Step 1.16: OpenAPI sync

- **Files**: `backend/src/shared/openapi/routes/permissions.ts`, `board-members.ts`.
- Зарегистрировать новые DTO и path. `npm run openapi:generate` без ошибок.

---

### Phase 2 — Switch checks to isAllowed (separate PR, ~45 hours)

**Принцип**: один модуль = один PR. Между PR — деплой на staging, smoke, и только тогда следующий.

Порядок (от низкого риска к высокому):

| # | Модуль | Файл | Изменение | Риск |
|---|--------|------|-----------|------|
| P2-1 | labels | `labels.service.ts` | role checks → `requirePermission('LABEL_*')` | Low |
| P2-2 | checklists | `checklists.service.ts` | role checks → `requirePermission('CHECKLIST_WRITE')` | Low |
| P2-3 | comments | `comments.service.ts` | role checks → `requirePermission('COMMENT_*')` + canActOnBoard | Medium |
| P2-4 | workflows | `workflows.service.ts` | role checks → `requirePermission('WORKFLOW_*')` | Medium |
| P2-5 | tasks | `tasks.service.ts` (~25 мест) | Все role checks → `canActOnBoard` (учитывает board-override) | **High** |
| P2-6 | boards | `boards.service.ts` | `listBoards`/`getBoard`/`getRoadmapTasks` → `canAccessBoard`/`bulkCanAccessBoards` | **High** |
| P2-7 | search | `search.service.ts` | `viewerWorkspaceIds` фильтр → JOIN с `board_members` + canAccessBoard | High |
| P2-8 | notifications | `notifications.service.ts` | `emitMentionNotifications` — фильтр по `canAccessBoard` (R-GUEST-2) | Medium |
| P2-9 | workspaces | `workspaces.service.ts` | `assertOwner` → `requirePermission('WS_*')`; member list возвращает rolePreset | Medium |
| P2-10 | admin | `admin.router.ts` | `requireSuperadmin` → `requirePermission('ADMIN_*')` (с fallback на `isSuperadmin=true` в `isAllowed` rule 0) | Low |

После P2-6, P2-7: обязательный E2E pass для гостевого flow (board-acl Feature 3).

### Phase 3 — Drop legacy (~10 hours)

- Удалить `WorkspaceMember.role`, `enum WorkspaceRole`.
- Удалить fallback `User.isSuperadmin` в `isAllowed`.
- Удалить `WorkspaceMemberDto.role` (legacy).
- CHANGELOG: breaking change для внешних API consumers.

---

## Permission middleware design

`requirePermission(code, opts?)` (pseudocode):

```
function requirePermission(code, opts) {
  return async (req, res, next) => {
    const wsId = opts?.workspaceParam ? req.params[opts.workspaceParam] : null;
    const ok = await isAllowed(req.user.userId, wsId, code);
    if (!ok) {
      const cause = await diagnoseDenial(req.user.userId, wsId, code);
      // cause: 'feature_disabled_system' | 'feature_disabled_ws' | 'no_permission'
      return next(new AppError(403, msg, { code: 'INSUFFICIENT_PERMISSION' | 'FEATURE_DISABLED' }));
    }
    next();
  };
}
```

Lifecycle для board endpoints:
```
authenticate → req.user
requireBoardAccess  → req.boardAccess = { allowed, role } или 403 BOARD_ACCESS_DENIED
requireBoardAction(perm) → 403 INSUFFICIENT_PERMISSION или FEATURE_DISABLED
controller
```

Lifecycle для module-gate (feedback):
```
featureGate('FEEDBACK_WIDGET', 'system')   → 404 если выключено
authenticate → ...
```

---

## Caching strategy

**Проблема**: `isAllowed` потенциально делает 4–5 DB lookup. На bulk-операциях N×5 запросов.

**Решение**:

1. **Aggregate SQL** одним запросом: возвращает system_features, ws_features, ws_role_perms, global_role_perms, overrides, is_superadmin, permissions_rev, is_guest — всё за 1 round-trip.

2. **In-memory LRU** (`lru-cache`): ключ `{userId}:{workspaceId}:rev{permissionsRev}`, TTL 5 мин, capacity 10000 (~1.5GB max). Hit-rate ожидается 90%+.

3. **Invalidation**:
   - Любая мутация → `prisma.user.update({ where: { id }, data: { permissionsRev: { increment: 1 } } })`. Старые ключи в LRU естественно вытолкнутся.
   - `WorkspaceFeature` мутация → инкремент `permissionsRev` для всех members workspace одним UPDATE.
   - `SystemFeature` → отдельный glob `systemRev`.

4. **Frontend invalidation**: Redis pub/sub `permissions:changed:{userId}` → SSE/WS на frontend → `permissions.store.refresh()`.

5. **Bulk variant**: `bulkCanAccessBoards(userId, [boardIds])` — один SQL JOIN, возвращает Map<boardId, accessRow>. Использует `listBoards`.

---

## Test Strategy

### Unit tests (Vitest, `backend/src/__tests__/`)

| File | Coverage |
|------|----------|
| `permissions/is-allowed.test.ts` | NEW — 30+ кейсов из feature-permissions §5 (superadmin, system-off, ws-off, REVOKE, GRANT, role-fallback, global-fallback). @mocks Prisma. |
| `permissions/can-access-board.test.ts` | NEW — 9 особых случаев board-acl §4.1 + рекурсивные комбинации (private + guest + override). @mocks Prisma. |
| `permissions/derive-feature-code.test.ts` | NEW — mapping 40+ кодов. |
| `permissions/cache.test.ts` | NEW — инвалидация по permissionsRev, LRU eviction, concurrent reads. |

### Integration tests (Vitest + real DB)

| File | Coverage |
|------|----------|
| `__tests__/admin-permissions.test.ts` | NEW — BDD FP Feature 1, 2, 3: happy, empty, error, edge (duplicate, system protected). |
| `__tests__/workspace-features.test.ts` | NEW — BDD FP Feature 4: happy, system cascade, owner self-block. |
| `__tests__/workspace-members-roles.test.ts` | NEW — BDD FP Feature 5: change role, last-owner-protected. |
| `__tests__/board-acl.test.ts` | NEW — BDD ACL Feature 1, 2, 5: modal, private toggle, эффективные роли. |
| `__tests__/board-acl-guest.test.ts` | NEW — BDD ACL Feature 3, 4: guest lifecycle, promote, cascading delete (R-GUEST-3), mention suppression (R-GUEST-2). |
| `__tests__/permissions-cache-invalidation.test.ts` | NEW — mutation → permissionsRev increment → fresh state. |

### Migration tests

| File | Coverage |
|------|----------|
| `__tests__/migration-backfill.test.ts` | NEW — после миграции: 0 rows `role_preset_id IS NULL`; 4 system roles; OWNER→system:owner mapping. |

### Regression tests (existing 18 files)

На Phase 1 все должны проходить **без изменений** (legacy `WorkspaceMember.role` остаётся). Если ломаются — баг в backfill или DTO. R13: audit все тесты после Step 1.1 — некоторые могут проверять shape WorkspaceMemberDto.

### E2E (Playwright, отдельная suite, Phase 2+)

| File | Coverage |
|------|----------|
| `e2e/admin-permissions.spec.ts` | NEW |
| `e2e/workspace-features.spec.ts` | NEW |
| `e2e/board-acl.spec.ts` | NEW (Phase 2+) |
| `e2e/guest-flow.spec.ts` | NEW (Phase 2+) |

### Coverage target

≥80% lines/branches на новых файлах. На existing после Phase 2 — не падать.

---

## Detailed Migration Steps

**Migration name**: `backend/src/prisma/migrations/2026MMDDHHMMSS_add_feature_permissions_and_board_acl/migration.sql`

```sql
-- 1. Enums
CREATE TYPE "PermissionCode" AS ENUM (...); -- 46 values
CREATE TYPE "PermissionType" AS ENUM ('GRANT', 'REVOKE');
CREATE TYPE "FeatureScope" AS ENUM ('SYSTEM', 'WORKSPACE');

-- 2. Tables (auto-generated)
CREATE TABLE "system_features" (...);
CREATE TABLE "workspace_features" (...);
CREATE TABLE "role_presets" (...);
CREATE TABLE "role_permissions" (...);
CREATE TABLE "user_permissions" (...);
CREATE TABLE "board_members" (...);

-- 3. Indices
CREATE UNIQUE INDEX ON workspace_features(workspaceId, code);
CREATE UNIQUE INDEX ON role_permissions(presetId, permission);
CREATE UNIQUE INDEX ON user_permissions(userId, workspaceId, permission);
CREATE INDEX ON user_permissions(userId, workspaceId);
CREATE UNIQUE INDEX ON board_members(boardId, userId);
CREATE INDEX ON board_members(userId);

-- 4. Alter existing
ALTER TABLE users ADD COLUMN global_role_preset_id TEXT REFERENCES role_presets(id);
ALTER TABLE users ADD COLUMN permissions_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_members ADD COLUMN role_preset_id TEXT REFERENCES role_presets(id);
ALTER TABLE workspace_members ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false;

-- 5. Seed RolePresets с фиксированными UUID
INSERT INTO role_presets (id, name, display_name, scope, is_system, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system:owner',  'Owner',  'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'system:member', 'Member', 'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'system:viewer', 'Viewer', 'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'system:admin',  'Admin',  'SYSTEM',    true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 6. Seed RolePermission (~70 rows). Явный INSERT для каждой связи preset×permission.

-- 7. Seed SystemFeature — 8 records
INSERT INTO system_features (code, enabled, updated_at) VALUES
  ('LOCAL_REGISTRATION', true, NOW()), ('SSO', true, NOW()), ('MFA', true, NOW()),
  ('EMAIL_NOTIFICATIONS', true, NOW()), ('FEEDBACK_WIDGET', true, NOW()),
  ('API_KEYS', true, NOW()), ('GLOBAL_SEARCH', true, NOW()), ('REGISTRATION_REQUESTS', true, NOW())
ON CONFLICT (code) DO NOTHING;

-- 8. BACKFILL workspace_members.role_preset_id
UPDATE workspace_members SET role_preset_id = '00000000-0000-0000-0000-000000000001' WHERE role = 'OWNER';
UPDATE workspace_members SET role_preset_id = '00000000-0000-0000-0000-000000000002' WHERE role = 'MEMBER';
UPDATE workspace_members SET role_preset_id = '00000000-0000-0000-0000-000000000003' WHERE role = 'VIEWER';

-- 9. BACKFILL users.global_role_preset_id
UPDATE users SET global_role_preset_id = '00000000-0000-0000-0000-000000000004' WHERE is_superadmin = true;

-- 10. Sanity: ensure boards.is_private no NULL
UPDATE boards SET is_private = false WHERE is_private IS NULL;
```

### Rollback strategy

Prisma не делает auto-rollback на проде. Manual:
```sql
ALTER TABLE workspace_members DROP COLUMN role_preset_id, DROP COLUMN is_guest;
ALTER TABLE users DROP COLUMN global_role_preset_id, DROP COLUMN permissions_rev;
DROP TABLE board_members, user_permissions, role_permissions, role_presets, workspace_features, system_features;
DROP TYPE "PermissionCode", "PermissionType", "FeatureScope";
```

Поскольку legacy `WorkspaceMember.role` сохранён — приложение работает после rollback без code changes.

---

## Risks & Mitigations (синтез из обеих SDD + новые)

| # | Риск | Probability | Severity | Mitigation | Plan-step |
|---|------|-------------|----------|------------|-----------|
| R1 (FP) | Backfill оставляет members без роли | Low | High | Идемпотентная миграция; test 0 NULL после миграции | Step 1.1, 1.2 |
| R2 (FP) | Регрессия в существующих сервисах при Phase 2 | High | Critical | Phase 2 = отдельный PR per модуль; staging deploy между PR; обязательный E2E | Phase 2 |
| R3 (FP) | Cache stale → user видит чужие права | Medium | High | `permissionsRev` + bypass на security-changing; integration test | Step 1.4 |
| R4 (FP) | Owner self-lock (последняя owner-роль) | Medium | High | API-level `LAST_OWNER_PROTECTED`; UI-warning | Step 1.10 |
| R5 (FP) | Superadmin выключает LOCAL_REGISTRATION пока не залогинен | Low | Medium | UI confirmation; runbook для SQL восстановления | Step 1.6 |
| R6 (FP) | Inflation user_permissions | Low | Low | Index (userId, workspaceId); UI pagination | Step 1.1 |
| R7 (FP) | Workspace-owner создаёт role с ADMIN_* | Medium | High | Zod refinement: scope=WORKSPACE запрещает ADMIN_*; integration test | Step 1.6 |
| R8 (FP) | Backward compat сломает API consumers | High | High | DTO сохраняет `role` (computed из rolePreset.name); CHANGELOG; deprecation 6 мес | Step 1.7 |
| R1 (ACL) | N+1 на listBoards | High | High | `bulkCanAccessBoards` через JOIN; benchmark 100+ досок | Step 1.3, Phase 2 P2-6 |
| R2 (ACL) | Owner создаёт private без себя | Low | Low | Algorithm rule 1 + UI validation | Step 1.9 |
| R3 (ACL) | Per-board роль содержит WS_* permissions | Medium | Medium | API filter ADMIN_*; warn если WS_*; canActOnBoard игнорирует WS-permissions для board scope | Step 1.6, 1.3 |
| R4 (ACL) | Cascade BoardMember при удалении Board | Low | Low | `onDelete: Cascade` в schema | Step 1.1 |
| R5 (ACL) | Notification spam для denied users | Medium | Medium | `emitMentionNotifications` фильтр через canAccessBoard | Phase 2 P2-8 |
| R6 (ACL) | Existing E2E падают (user не видит доску) | High | Medium | Seed: все boards isPrivate=false; canAccessBoard rule 6 возвращает true | Step 1.2, Phase 2 |
| R7 (ACL) | Server filter не учитывает per-board override | Medium | High | Test обязателен; реализация через canAccessBoard | Phase 2 P2-7 |
| R8 (ACL) | Cache не invalidates на BoardMember change | Medium | Medium | `permissionsRev` increment + Redis pub/sub | Step 1.4 |
| R9 (ACL) | isPrivate toggle без members → invisible | Low | Low | 409 `PRIVATE_BOARD_NEEDS_MEMBER` | Step 1.9 |
| R-GUEST-1 (ACL) | Guest повышен в owner, isGuest=true остаётся | Medium | Medium | Triggered: role=system:owner → isGuest=false автоматически | Step 1.10 |
| R-GUEST-2 (ACL) | Guest получает уведомление о mention в другой доске | High | Medium | Notification фильтр через canAccessBoard; audit-log "skipped" | Phase 2 P2-8 |
| R-GUEST-3 (ACL) | DELETE последнего BoardMember у guest оставит висячий WS member | Medium | Medium | Транзакция: count=0 + isGuest=true → CASCADE WorkspaceMember | Step 1.8 |
| **NEW R10** | Двойная транзакция в POST /boards/:id/members может частично провалиться | Medium | High | `prisma.$transaction({ isolationLevel: Serializable })`; integration test «middle step throws» | Step 1.8 |
| **NEW R11** | Performance: `isAllowed` без кэша — DB I/O рост 5–10× | High | High | Step 1.4 cache layer ОБЯЗАТЕЛЕН до P2 deploy; benchmark p95 < 50ms | Step 1.4 |
| **NEW R12** | Frontend conditional rendering flaps при rev poll | Medium | Low | Кэшировать в store; обновлять только при WS push/explicit refresh | Step 1.14 |
| **NEW R13** | Existing tests падают из-за нового shape DTO | Medium | Medium | Audit всех тестов после Step 1.1; backward compat DTO с `role` | Step 1.15 |
| **NEW R14** | RolePreset deletion с активными users → orphan | High | High | Prisma `onDelete: Restrict`; 409 `ROLE_IN_USE` с count | Step 1.6 |
| **NEW R15** | Migration race на проде (rolling deploy) | Medium | High | Migration additive-only; Phase 1 код не использует новые поля для проверок | Step 1.1 |

---

## Pre-G7 Risk Closure

**Skills которые ОБЯЗАНЫ быть подгружены до implementation, не до G7:**

- [x] `vercel-web-design-guidelines` — для всех UI компонент (admin / workspace / board access modal).
- [x] `ux-designer` — для accessibility (toggle role="switch", alertdialog, focus management, screen reader announcements).
- [x] `vercel-react-best-practices` + `vercel-composition-patterns` — для permission gates, custom hooks, store design.
- [x] **Security threat model** записан в plan.md (см. секцию ниже) **ДО** первой строки backend кода.

**Plan risks closure**: каждый риск (25 items) получает одно из полей перед G7:
- `addressed_in: <file:lines + test_name>` — конкретный фикс
- `deferred_to: <PR/issue>` — для Phase 2/3 рисков
- `accepted_because: <reason>` — для R5, R6, R9 (low-impact edge cases)

**Smoke**: skill `feature-smoke` после Step 1.16. Проверки:
- curl POST /api/admin/role-presets happy + 400 (invalid scope) + 401 (no auth) + 409 (duplicate name)
- curl PATCH /api/admin/system-features/LOCAL_REGISTRATION {enabled:false} → check POST /api/auth/register returns 404 next
- UI handoff на `e2e-runner`: открыть /admin, проверить рендеринг вкладок.
- Verdict в `tasks/feature-permissions-acl/smoke-report.md` = `green`.

---

## Security Threat Model (mandatory before implementation)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| **Privilege escalation via custom role** | Owner создаёт role с ADMIN_USERS → видит чужие workspaces | Zod refinement on scope=WORKSPACE rejects all ADMIN_* codes; integration test |
| **IDOR на role-preset CRUD** | `PATCH /api/admin/role-presets/:id` без проверки → подмена системной | `requireSuperadmin` (Phase 1) / `requirePermission('ADMIN_ROLES')` (Phase 2); isSystem=true → 409 PATCH/DELETE |
| **IDOR на BoardMember** | Member вызывает POST /api/boards/&lt;not-his&gt;/members → добавляет себя | `requirePermission('BOARD_MANAGE_ACL')` + canAccessBoard pre-check |
| **TOCTOU**: canAccessBoard → board становится private → mutation проходит | Между check и mutation проходит время | Single `prisma.$transaction` для всей цепочки check+write |
| **Cache poisoning** | Attacker инжектит permissionsRev через PATCH | `permissionsRev` НЕ принимается из API; только server-side increment |
| **Mass override insertion** | DDoS через POST /users/:id/permissions 10000× | Rate limit на /api/admin/* (existing) + ADMIN_PERMISSIONS |
| **Guest information disclosure** | Guest видит других users в mention picker | Mention picker фильтруется через BoardMember для guest (board-acl §6.8) |
| **Notification side-channel** | Mention в недоступной доске → guest узнаёт что задача существует | `emitMentionNotifications` фильтр (Phase 2 P2-8); skipped audit log |
| **Audit log gap** | После toggle SystemFeature → нет следа кто это сделал | Каждая мутация → `auditLog({ actorId, action, meta })` (Step 1.11) |
| **Default-allow bypass** | SystemFeature.MFA отсутствует в БД → код считает enabled=true → MFA off | Migration seed заливает все 8 records; integration test «empty system_features = defaults work» |

---

## Acceptance Criteria for G6 (implementation review)

Перед запуском three-agent review:

**Backend**:
- [ ] `prisma migrate dev` проходит. Backfill корректен (0 null role_preset_id).
- [ ] `npm run build` зелёный, tsc strict.
- [ ] Все existing tests проходят без изменений (Phase 1 — additive only).
- [ ] `is-allowed.test.ts` и `can-access-board.test.ts` покрывают 100% алгоритмических веток.
- [ ] Integration-тесты admin / workspace-features / board-members — зелёные.
- [ ] `npm run check:rbac` (existing) 0 нарушений на новых endpoints.
- [ ] OpenAPI generated без ошибок, все новые routes описаны.
- [ ] Coverage новых файлов ≥ 80%.

**Frontend**:
- [ ] `tsc --noEmit` зелёный, `npm run lint` зелёный.
- [ ] AdminUsersPage отображает 3 вкладки (Users / Системные фичи / Роли).
- [ ] WorkspaceSettingsPage отображает вкладку «Фичи» и расширенный members-dropdown.
- [ ] `usePermission`, `useFeatureEnabled`, `<PermissionGate>` smoke-проверены.
- [ ] A11y axe-core: 0 violations на новых страницах.

**Smoke** (`tasks/feature-permissions-acl/smoke-report.md` = green):
- [ ] curl happy на каждом новом endpoint.
- [ ] curl negative: 401, 403 (INSUFFICIENT_PERMISSION), 409 (DUPLICATE_ROLE_NAME, SYSTEM_ROLE_PROTECTED), 400 (INVALID_ROLE_SCOPE).
- [ ] UI handoff: Playwright скриншоты admin/workspace страниц.

**Plan risks (25 items)**: у каждого заполнено addressed_in / deferred_to / accepted_because.

---

## Effort Estimate (ideal hours)

| Phase | Module | Hours |
|-------|--------|-------|
| Phase 1 | Prisma + migration + seed (Step 1.1–1.2) | 8 |
| Phase 1 | Permission engine + cache (Step 1.3–1.4) | 10 |
| Phase 1 | Middleware (Step 1.5) | 4 |
| Phase 1 | Admin endpoints (Step 1.6) | 8 |
| Phase 1 | Workspace features endpoints (Step 1.7) | 6 |
| Phase 1 | Board members endpoints (Step 1.8) | 10 |
| Phase 1 | isPrivate + last-owner (Step 1.9–1.10) | 4 |
| Phase 1 | Audit logging (Step 1.11) | 2 |
| Phase 1 | Frontend admin UI (Step 1.12) | 12 |
| Phase 1 | Frontend workspace UI (Step 1.13) | 10 |
| Phase 1 | Frontend store + hooks + gate (Step 1.14) | 6 |
| Phase 1 | Tests (Step 1.15) | 14 |
| Phase 1 | OpenAPI (Step 1.16) | 2 |
| **Phase 1 total** | | **~96** (~3 недели при 1 dev) |
| Phase 2 | P2-1 … P2-10 (10 модулей × 3–5h) | ~35 |
| Phase 2 | Phase 2 tests + E2E | ~10 |
| **Phase 2 total** | | **~45** (~2 недели) |
| Phase 3 | Drop legacy | ~10 |
| **GRAND TOTAL** | | **~150 ideal hours** (very XL) |

---

## Sequencing notes

1. **Step 1.1 (schema+migration)** — критический путь. Merged + deployed на staging до всего остального.
2. **Step 1.3 (engine)** и **Step 1.4 (cache)** параллельны с **Step 1.12/1.13 (frontend UI)**.
3. **Step 1.6 / 1.7 / 1.8** независимы между собой — могут параллельно после Step 1.3, 1.5.
4. **Phase 2 строго последовательно** — каждый модуль может сломать другой (search использует boards, tasks использует boards, notifications использует tasks). P2-1 … P2-10 = от листьев к корням.

---

## Open Questions (для PO до начала implementation)

SDD §11 и §10 заявляют что open questions зафиксированы. Новые вопросы, возникшие при планировании:

1. **TASK_EXPORT в `system:viewer`** — SDD §11 решение 4 «только *_READ», но TASK_EXPORT — read-операция. Plan решение: **ИСКЛЮЧИТЬ** TASK_EXPORT из viewer. Подтвердить?
2. **`Workspace.isPrivate`** — legacy поле, используется в search и list workspaces для VIEWER-hide. После Phase 2 — оставляем как UX-маркировку «приватный workspace», не использовать в RBAC проверках. Подтвердить?
3. **`Board.isPrivate` toggle**: по board-acl §5.3 «только system:owner или BOARD_MANAGE_ACL+BOARD_UPDATE». Plan решение: **`BOARD_MANAGE_ACL` достаточно**. Подтвердить?
4. **Member видит custom workspace роли в dropdown?** BDD Feature 5 показывает — да. Подтвердить?
5. **`WS_HISTORY_UI=false` блокирует только UI** — API `/api/tasks/:id/history` остаётся открытым. Подтвердить?

⏸ **G4: Plan approved**. Ждёт явного подтверждения PO перед переходом к G5 (Failing tests).
