# SDD: Системные feature-permissions

> Status: **APPROVED** (G2-1, 2026-05-18)
> Owner: jackrescuer-gif
> Дата: 2026-05-18
> Связанные документы: [board-acl.md](./board-acl.md) (G2-2, отдельно)

## 1. Цель

Заменить плоскую модель ролей `OWNER / MEMBER / VIEWER` на двухуровневую систему: глобальные feature-toggles + гранулярные пермиссии с пресетами ролей и индивидуальными overrides — по образцу `moex-portal`.

Эта SDD покрывает **системный уровень** (superadmin) и **workspace-уровень** (owner). Per-board ACL — в отдельной SDD ([board-acl.md](./board-acl.md)).

## 2. Контекст

### Что есть сейчас

- `WorkspaceMember.role: OWNER | MEMBER | VIEWER` — одна плоская роль на воркспейс.
- `User.isSuperadmin: Boolean` — глобальный флаг.
- Проверки разбросаны по сервисам в виде `if (member.role !== 'OWNER') throw forbidden`.
- В админке есть только: список пользователей, создание, заявки на регистрацию, audit log, `updateConfig.registrationDomain`.
- Никаких системных feature-toggles нет. Никаких настраиваемых ролей нет.

### Что нужно

1. **Системные toggle (superadmin)** — включить/выключить целиком модули продукта (local registration, MFA, email, feedback, integrations и т.д.) для всей инсталляции.
2. **Workspace toggle (owner)** — owner workspace включает/выключает разрешённые фичи (комментарии, чеклисты, mentions, bulk, экспорт, history-UI и т.д.) для своих участников.
3. **Гранулярные permission codes** — какие действия может делать конкретный пользователь с включёнными фичами.
4. **Role presets** — именованные роли (Owner / Member / Viewer / кастомные) как пакеты пермиссий.
5. **User overrides** — индивидуальные GRANT/REVOKE поверх роли.

## 3. Инвентарь фич

### Уровень 0 — ядро (не toggleable)

| Фича | Модуль |
|------|--------|
| Auth (login/logout/refresh/password reset) | `auth` |
| Workspaces (CRUD своих) | `workspaces` |
| Boards (CRUD) | `boards` |
| Tasks (CRUD, subtasks, materialized path) | `tasks` |
| Workflows (статусы и переходы) | `workflows` |

### Уровень 1 — системные toggle (superadmin)

Хранятся в новой таблице `system_features`. Дефолт — все `enabled = true`.

| Код | UI-название | Что выключает |
|-----|-------------|----------------|
| `LOCAL_REGISTRATION` | Локальная регистрация | Endpoint `POST /api/auth/register` + UI-кнопка |
| `SSO` | SSO / Keycloak | Endpoints `/api/auth/sso/*` + UI-кнопка |
| `MFA` | MFA / TOTP | UI настроек безопасности workspace + middleware enforcement |
| `EMAIL_NOTIFICATIONS` | Email-уведомления | `NotificationService.sendEmail` (no-op) + UI настроек |
| `FEEDBACK_WIDGET` | Feedback виджет | Модуль `feedback` (router отвечает 404) |
| `API_KEYS` | API-ключи / integrations | Модуль `integrations` |
| `GLOBAL_SEARCH` | Global search (Cmd+K) | Модуль `search` + UI-открытие палитры |
| `REGISTRATION_REQUESTS` | Заявки на регистрацию | Flow «заявка → одобрение superadmin» |

### Уровень 2 — workspace toggle (owner)

Хранятся в новой таблице `workspace_features` (по записи `(workspaceId, featureCode, enabled)`). Дефолт — все `enabled = true`. **Каскад:** если системно выключено — owner не может включить.

| Код | UI-название | Что выключает |
|-----|-------------|----------------|
| `WS_COMMENTS` | Комментарии | Comment editor в drawer + notifications о новых комментариях |
| `WS_CHECKLISTS` | Чеклисты | Чеклист-секция в drawer |
| `WS_MENTIONS` | @mentions | Mention-picker в comment editor |
| `WS_LABELS` | Метки | Label-picker + фильтрация по меткам |
| `WS_BULK_OPS` | Массовые операции | Bulk action bar |
| `WS_EXPORT` | Экспорт CSV | Кнопки экспорта |
| `WS_TRASH` | Корзина / soft-delete restore | Кнопка восстановления (purge всегда работает) |
| `WS_HISTORY_UI` | History UI в drawer и workspace | UI-видимость (аудит в БД пишется всегда) |
| `WS_ONBOARDING_TOUR` | Onboarding tour | Туториал при первом входе |

**Subtasks намеренно нет** — выключение сломает materialized path.

### Уровень 3 — permission codes (что пользователь может делать)

Хранятся в `permission_codes` enum в Prisma. ~40 кодов. Используются в пресетах ролей (`RolePermission`) и индивидуальных overrides (`UserPermission`).

```
// READ
TASK_READ
TASK_READ_ALL              // включая private boards (override workspace-уровня)
BOARD_READ
WORKFLOW_READ
LABEL_READ
COMMENT_READ
CHECKLIST_READ
HISTORY_READ
WORKSPACE_READ

// WRITE — tasks
TASK_CREATE
TASK_UPDATE
TASK_DELETE
TASK_REASSIGN
TASK_BULK_EDIT
TASK_EXPORT

// WRITE — boards / workflows
BOARD_CREATE
BOARD_UPDATE
BOARD_DELETE
BOARD_MANAGE_COLUMNS
WORKFLOW_CREATE
WORKFLOW_UPDATE
WORKFLOW_DELETE

// WRITE — labels / comments / checklists
LABEL_CREATE
LABEL_UPDATE
LABEL_DELETE
COMMENT_CREATE
COMMENT_UPDATE_OWN
COMMENT_DELETE_OWN
COMMENT_DELETE_ANY
CHECKLIST_WRITE

// WORKSPACE
WS_INVITE_MEMBER
WS_REMOVE_MEMBER
WS_CHANGE_MEMBER_ROLE
WS_EDIT_SETTINGS
WS_EDIT_SECURITY
WS_TOGGLE_FEATURES         // включать/выключать workspace-фичи
WS_DELETE
WS_RESTORE_FROM_TRASH

// BOARD ACL (детали в board-acl.md)
BOARD_MANAGE_ACL

// ADMIN (только для глобальных ролей)
ADMIN_USERS
ADMIN_ROLES
ADMIN_PERMISSIONS
ADMIN_AUDIT
ADMIN_FEATURE_FLAGS
ADMIN_SYSTEM_CONFIG
```

## 4. Модель данных (Prisma additions)

### 4.1 Enums

```prisma
enum PermissionCode {
  // ... 40 кодов из раздела 3 уровень 3
}

enum PermissionType {
  GRANT
  REVOKE
}

enum FeatureScope {
  SYSTEM
  WORKSPACE
}
```

### 4.2 Models

```prisma
model SystemFeature {
  code      String   @id                      // например "LOCAL_REGISTRATION"
  enabled   Boolean  @default(true)
  updatedAt DateTime @updatedAt
  updatedBy String?                            // userId

  @@map("system_features")
}

model WorkspaceFeature {
  id          String   @id @default(uuid())
  workspaceId String
  code        String                            // например "WS_COMMENTS"
  enabled     Boolean  @default(true)
  updatedAt   DateTime @updatedAt
  updatedBy   String?

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, code])
  @@map("workspace_features")
}

model RolePreset {
  id          String   @id @default(uuid())
  name        String   @unique                 // системные: "system:owner", "system:member", "system:viewer"
  displayName String
  scope       FeatureScope                     // SYSTEM (для админки) или WORKSPACE (для участников)
  isSystem    Boolean  @default(false)         // системные нельзя удалить
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions RolePermission[]
  members     WorkspaceMember[]                // FK с WorkspaceMember.rolePresetId
  globalUsers User[]                           // для SYSTEM-роли

  @@map("role_presets")
}

model RolePermission {
  id         String         @id @default(uuid())
  presetId   String
  permission PermissionCode

  preset RolePreset @relation(fields: [presetId], references: [id], onDelete: Cascade)

  @@unique([presetId, permission])
  @@map("role_permissions")
}

model UserPermission {
  id          String         @id @default(uuid())
  userId      String
  workspaceId String?                           // null = глобальный override
  permission  PermissionCode
  type        PermissionType                    // GRANT или REVOKE
  grantedBy   String?
  createdAt   DateTime       @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId, permission])
  @@index([userId, workspaceId])
  @@map("user_permissions")
}
```

### 4.3 Изменения в существующих моделях

```prisma
model User {
  // ...
  globalRolePresetId String?
  globalRolePreset   RolePreset? @relation("UserGlobalRole", fields: [globalRolePresetId], references: [id])
  userPermissions    UserPermission[]
  // isSuperadmin сохраняем для bootstrap — superadmin = неявная роль "ADMIN_*"
}

model WorkspaceMember {
  // ...
  rolePresetId String?
  rolePreset   RolePreset? @relation(fields: [rolePresetId], references: [id])
  isGuest      Boolean     @default(false) @map("is_guest")  // см. board-acl.md §2 принцип 6
  // role: WorkspaceRole оставляем DEPRECATED на одну фазу для backward compat
}
```

## 5. Эффективная пермиссия — алгоритм

```
isAllowed(userId, workspaceId, permission) =>
  if user.isSuperadmin and permission.startsWith("ADMIN_"): return true

  systemEnabled = SystemFeature(deriveFeatureCode(permission)).enabled ?? true
  if !systemEnabled: return false

  if workspaceId:
    wsEnabled = WorkspaceFeature(workspaceId, deriveFeatureCode(permission)).enabled ?? true
    if !wsEnabled: return false

  // 1. ищем явный REVOKE на (user, workspace)
  if UserPermission(userId, workspaceId, permission, type=REVOKE): return false
  if UserPermission(userId, null, permission, type=REVOKE): return false

  // 2. явный GRANT на (user, workspace) или global
  if UserPermission(userId, workspaceId, permission, type=GRANT): return true
  if UserPermission(userId, null, permission, type=GRANT): return true

  // 3. через role preset
  if workspaceId:
    preset = WorkspaceMember(userId, workspaceId)?.rolePreset
    if preset?.permissions.includes(permission): return true

  preset = User(userId).globalRolePreset
  if preset?.permissions.includes(permission): return true

  return false
```

**Каскад выключения (3): system off → ws off независимо → user override игнорируется** (фича недоступна никому).

## 6. API контракты

### 6.1 Admin endpoints (superadmin only)

```
GET    /api/admin/system-features                  → SystemFeatureDto[]
PATCH  /api/admin/system-features/:code            { enabled }
                                                   → SystemFeatureDto

GET    /api/admin/role-presets?scope=SYSTEM|WORKSPACE
                                                   → RolePresetDto[]
POST   /api/admin/role-presets                    { name, displayName, scope, permissions }
                                                   → RolePresetDto
PATCH  /api/admin/role-presets/:id                { displayName?, permissions? }
                                                   → RolePresetDto
DELETE /api/admin/role-presets/:id                — 409 если isSystem=true

GET    /api/admin/users/:id/permissions            → { rolePreset, overrides: UserPermissionDto[] }
PATCH  /api/admin/users/:id/role                  { rolePresetId }
POST   /api/admin/users/:id/permissions           { permission, type, workspaceId? }
DELETE /api/admin/users/:id/permissions/:permId
```

### 6.2 Workspace endpoints (workspace owner)

```
GET    /api/workspaces/:id/features                → WorkspaceFeatureDto[]
PATCH  /api/workspaces/:id/features/:code         { enabled }

GET    /api/workspaces/:id/members/:userId/permissions
                                                   → { rolePreset, overrides }
PATCH  /api/workspaces/:id/members/:userId        { rolePresetId? }
POST   /api/workspaces/:id/members/:userId/permissions
                                                   { permission, type }   // только WORKSPACE-scope
```

### 6.3 DTO

```typescript
type SystemFeatureDto = {
  code: string;
  enabled: boolean;
  updatedAt: string;     // ISO
  updatedBy: string | null;
};

type WorkspaceFeatureDto = {
  code: string;
  enabled: boolean;
  systemEnabled: boolean;  // computed — если false, owner не может включить
  updatedAt: string;
};

type RolePresetDto = {
  id: string;
  name: string;
  displayName: string;
  scope: 'SYSTEM' | 'WORKSPACE';
  isSystem: boolean;
  permissions: string[];   // PermissionCode[]
};

type UserPermissionDto = {
  id: string;
  permission: string;
  type: 'GRANT' | 'REVOKE';
  workspaceId: string | null;
  grantedBy: string | null;
  createdAt: string;
};
```

### 6.4 Формат ошибок (как сейчас)

```typescript
{ error: { code: string; message: string; details?: unknown } }
```

Новые коды:
- `FEATURE_DISABLED` — 403, попытка использовать выключенную фичу
- `INSUFFICIENT_PERMISSION` — 403, нет требуемого PermissionCode
- `SYSTEM_ROLE_PROTECTED` — 409, попытка изменить/удалить системную роль

## 7. Миграционный план

### Phase 1 — additive (одна миграция)

1. Создать enum `PermissionCode`, `PermissionType`, `FeatureScope`.
2. Создать таблицы `system_features`, `workspace_features`, `role_presets`, `role_permissions`, `user_permissions`.
3. Добавить FK `User.globalRolePresetId`, `WorkspaceMember.rolePresetId` — **nullable**, не ломает существующее.
4. Seed:
   - `SystemFeature`: все коды с `enabled = true`.
   - `RolePreset`: три системные роли с фиксированными `name`:
     - `system:owner` (scope=WORKSPACE) — все WORKSPACE-пермиссии включая `WS_*` и `BOARD_MANAGE_ACL`.
     - `system:member` (scope=WORKSPACE) — read + create/update tasks/comments/checklists. Без `WS_*`, без `BOARD_DELETE`, без `TASK_DELETE`.
     - `system:viewer` (scope=WORKSPACE) — только `*_READ`.
     - `system:admin` (scope=SYSTEM) — все `ADMIN_*`.
   - Migrate данные: для каждого `WorkspaceMember.role`:
     - `OWNER` → `rolePresetId = system:owner.id`
     - `MEMBER` → `system:member.id`
     - `VIEWER` → `system:viewer.id`
   - `User.isSuperadmin = true` → `globalRolePresetId = system:admin.id` (но `isSuperadmin` оставляем как fallback на одну фазу).

### Phase 2 — switch checks (отдельный PR)

Заменить проверки `if (member.role !== 'OWNER')` на `if (!isAllowed(userId, wsId, 'WS_EDIT_SETTINGS'))`. Делается по модулям. `WorkspaceMember.role` пока остаётся как deprecated.

### Phase 3 — drop legacy (через 2-3 релиза)

Удалить колонку `WorkspaceMember.role`, удалить `WorkspaceRole` enum.

## 8. UX & Accessibility

**Целевой WCAG-уровень**: AA. Админка безопасности → AAA для критичных flow (роли, пермиссии).

### Required UI states

**AdminUsersPage → новая вкладка «Роли»**
- [x] Loading — skeleton-строки списка
- [x] Empty — «Системные роли не удаляются, кастомных пока нет» + CTA «Создать роль»
- [x] Error — «Не удалось загрузить роли» + retry
- [x] Disabled — для `isSystem` ролей кнопка «Удалить» disabled с tooltip
- [x] Confirmation — modal перед удалением кастомной роли с подсчётом затронутых пользователей

**AdminUsersPage → вкладка «Системные фичи»**
- [x] Loading — skeleton-таблица
- [x] Error — toast + retry
- [x] Confirmation — modal «Выключить LOCAL_REGISTRATION? Это запретит regiter endpoint для всех» с предупреждением о побочных эффектах

**AdminUsersPage → user detail → блок «Permissions»**
- [x] Dropdown «Роль» + список текущих overrides
- [x] Empty overrides — «Нет индивидуальных правок»
- [x] Удаление override — confirmation с пометкой какая роль вернётся в силу

**WorkspaceSettingsPage → новая вкладка «Фичи»**
- [x] Toggle-список фич уровня 2
- [x] Если `systemEnabled = false` — toggle disabled + бейдж «Выключено администратором»
- [x] Confirmation при выключении фичи которая используется (например `WS_COMMENTS` если есть >0 комментариев) — «У вас 12 комментариев останутся видны, но новые добавить нельзя»

**WorkspaceSettingsPage → вкладка «Участники» → расширение**
- Колонка «Роль» = dropdown с RolePreset списком (вместо текущего OWNER/MEMBER/VIEWER)
- Кнопка «Настроить пермиссии» → modal с overrides

### Клавиатурный сценарий

- Tab order: nav → toggle-список → save
- Focus visible на всех interactive (toggle, button, dropdown)
- Esc закрывает confirmation modal
- Enter подтверждает confirmation
- Toggle переключается Space или Enter (стандарт role="switch")

### Screen reader

- Каждый toggle: `role="switch"` + `aria-checked` + `aria-describedby` (описание что выключится)
- При смене состояния — `aria-live="polite"` объявляет «Комментарии включены / выключены»
- При confirmation — `role="alertdialog"` с фокусом на cancel

### Touch targets

Все toggle ≥ 44×44, кнопки строк ≥ 44×44.

### Responsive

- Desktop: двухколоночная (nav + content)
- Tablet ≤ 1024: nav collapsable
- Mobile ≤ 640: nav → top tabs, контент в полную ширину; modal в bottom-sheet

### Performance budget

Admin страницы: LCP < 2.5s (списки до 500 пользователей), INP < 200ms на toggle.

## 9. Стыки

### Файлы для модификации

**Backend**:
- `backend/src/prisma/schema.prisma` — добавить модели и enums.
- `backend/src/modules/admin/admin.router.ts` — endpoints из 6.1.
- `backend/src/modules/admin/admin.service.ts` — логика role/permission CRUD.
- `backend/src/modules/admin/admin.dto.ts` — Zod схемы.
- `backend/src/modules/workspaces/workspaces.router.ts` — endpoints из 6.2.
- `backend/src/shared/middleware/` — новый `requirePermission(code: PermissionCode)`.
- `backend/src/shared/utils/permissions.ts` — `isAllowed()` функция.
- Все существующие сервисы — замена `requireOwner` → `requirePermission`.

**Frontend**:
- `frontend/src/api/admin.ts` — клиент новых endpoints.
- `frontend/src/api/permissions.ts` — новый клиент.
- `frontend/src/pages/AdminUsersPage.tsx` — добавить вкладки «Роли», «Системные фичи».
- `frontend/src/pages/WorkspaceSettingsPage.tsx` — добавить вкладку «Фичи», расширить «Участники».
- `frontend/src/store/permissions.store.ts` — Zustand store эффективных пермиссий пользователя.
- `frontend/src/hooks/usePermission.ts` — `usePermission('TASK_DELETE')` → boolean для conditional rendering.

### Что не трогаем

- `auth/*` — login/logout без изменений.
- `notifications/*` — только проверка `SystemFeature.EMAIL_NOTIFICATIONS` перед отправкой.
- E2E тесты MFA/SSO — отдельный pass после Phase 2.

## 10. Риски

| # | Риск | Вероятность | Mitigation |
|---|------|-------------|------------|
| R1 | Миграция оставит пользователей без роли | Низкая | Backfill в той же миграции по `WorkspaceMember.role`. Тест на пустой `WorkspaceMember.rolePresetId` после миграции. |
| R2 | Сломаем проверки в существующих сервисах | Высокая | Phase 2 отдельным PR, по модулям, с тестами для каждого. На Phase 1 `WorkspaceMember.role` остаётся работать. |
| R3 | Кэш-инвалидация пермиссий | Средняя | Все мутации (role/override/feature toggle) — инкремент `User.permissionsRev` или Redis pub/sub. Frontend `permissions.store` ловит и рефрешит. |
| R4 | Owner отключит себе `WS_TOGGLE_FEATURES` и заблокирует | Средняя | Backend отказывает: «Нельзя выключить свою последнюю роль с `WS_EDIT_SETTINGS`». Тест на этот сценарий. |
| R5 | Superadmin выключит `LOCAL_REGISTRATION` пока сам не логинился | Низкая | UI confirmation с предупреждением. Tehnical lockout восстанавливается через прямую запись в БД (документировать в runbook). |
| R6 | Большой рост числа `UserPermission` строк | Низкая | Индекс `(userId, workspaceId)`. Pagination на UI. |
| R7 | Кастомные роли позволят owner workspace создать роль с `ADMIN_*` пермиссиями | Средняя | Валидация: `RolePreset.scope = WORKSPACE` → запрещены все `ADMIN_*` коды. |
| R8 | Backward compat сломается для интеграций по API | Высокая | DTO `WorkspaceMemberDto` сохраняет поле `role` (computed из `rolePreset.name`) на одну major-версию. CHANGELOG + deprecation note. |

## 11. Решения (зафиксированы 2026-05-18)

1. **Кастомные роли scope=WORKSPACE** — owner workspace **может** создавать свои роли. Валидация: только WORKSPACE-permissions, все `ADMIN_*` запрещены на API-уровне (`role_presets` с scope=WORKSPACE не принимают ADMIN-коды).
2. **`User.isSuperadmin`** — **оставляем** как fallback в Phase 1+2 («isSuperadmin=true → ADMIN_* всегда true»). Удаление флага вынесено в Phase 3 (отдельная миграция через 2–3 релиза).
3. **`User.globalRolePresetId`** — **добавляем**. Используется для кросс-workspace ролей вроде «Глобальный аудитор» (`*_READ` везде без add member в каждый workspace).
4. **`system:viewer` пермиссии** — только `*_READ` (без `COMMENT_CREATE`, без `CHECKLIST_WRITE`, без любых WRITE-кодов). Совпадает с текущим поведением `WorkspaceRole.VIEWER`.
5. **Endpoint visibility при выключенной фиче**:
   - Если модуль выключен целиком (`SystemFeature.FEEDBACK_WIDGET = false`) — модуль не подключается к роутеру → **404**.
   - Если фича доступна, но конкретное действие выключено для пользователя/workspace — **403 `FEATURE_DISABLED`** или **403 `INSUFFICIENT_PERMISSION`** в зависимости от причины.

---
