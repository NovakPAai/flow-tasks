# SDD: Per-board ACL

> Status: **APPROVED** (G2-2, 2026-05-18)
> Owner: jackrescuer-gif
> Дата: 2026-05-18
> Связанный документ: [feature-permissions.md](./feature-permissions.md) (G2-1, утверждён)

## 1. Цель

Дать workspace owner возможность управлять доступом участников **к конкретным доскам**: давать разные роли на разные доски, ограничивать доступ только к одной доске, явно запрещать доступ.

Текущая модель — плоская: если пользователь `WorkspaceMember`, он видит **все** доски. Поле `Board.isPrivate` существует, но не используется в коде.

## 2. Контекст и принципы

### Существующее состояние

```prisma
model Board {
  isPrivate Boolean @default(false)  // существует, не используется
  // ...
}
model WorkspaceMember { workspaceId, userId, role }
```

В коде нет ни одной проверки на `Board.isPrivate`. Список досок отдаёт `boards.service.listByWorkspace(wsId)` без фильтра по доступу пользователя.

### Принципы (после обсуждения)

1. **Полная ACL `(user × board × role)`** — выбрано на G2-1.
2. **Override-модель**: base = workspace role; per-board override либо переопределяет роль, либо явно запрещает доступ.
3. **Public boards (`isPrivate = false`)** — workspace role работает по умолчанию; per-board override опционален.
4. **Private boards (`isPrivate = true`)** — доступ **только** через явный `BoardMember` (allow-list). Owner workspace всегда видит все доски workspace (включая private — иначе он не сможет их администрировать).
5. **Per-board роль** — переиспользуем `RolePreset` из feature-permissions с `scope = WORKSPACE`. То есть на доску можно дать «system:viewer» даже если в workspace у человека «system:member».
6. **Гость к одной доске**: `BoardMember` нельзя добавить для пользователя, которого нет в `WorkspaceMember`. Но при API-вызове `POST /api/boards/:id/members { userId }` backend **автоматически** создаёт `WorkspaceMember` с `isGuest = true`. Гость видит **только** доски, где у него есть `BoardMember` — никакие public-доски workspace ему не доступны. В UI он «привязан» к доске: его My Tasks, Activity, Search ограничены этим набором досок.

## 3. Модель данных

### 3.1 Новая модель

```prisma
model BoardMember {
  id           String   @id @default(uuid())
  boardId      String
  userId       String
  rolePresetId String?              // null = denied (явный запрет доступа)
  addedBy      String                // userId, кто добавил
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  board      Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  rolePreset RolePreset? @relation(fields: [rolePresetId], references: [id])

  @@unique([boardId, userId])
  @@index([userId])
  @@map("board_members")
}
```

**Семантика записи `BoardMember`**:
| `rolePresetId` | Значение |
|----------------|----------|
| `null`         | **DENIED** — доступ явно запрещён, перекрывает workspace role |
| `<preset.id>`  | **OVERRIDE** — на эту доску действует указанный preset вместо workspace role |

Отсутствие записи = используется workspace role (для public board) или нет доступа (для private board).

### 3.2 Расширение существующих моделей

```prisma
model Board {
  isPrivate Boolean @default(false)
  members   BoardMember[]
  // ...
}

model User {
  boardMemberships BoardMember[]
  // ...
}

model RolePreset {
  boardMembers BoardMember[]
  // ...
}

model WorkspaceMember {
  // ...
  isGuest Boolean @default(false) @map("is_guest")
}
```

`Board.isPrivate` остаётся булевым полем, **начинает использоваться** в логике доступа.

`WorkspaceMember.isGuest = true` помечает пользователей, добавленных автоматически через `BoardMember` для не-WorkspaceMember. Влияет на:
- `canAccessBoard` — пропускает правило «public board → workspace role» (гость видит только explicit boards).
- UI workspace — навигация, Activity, My Tasks, search ограничены доступными досками.
- Workspace settings — гость не виден в общем списке участников; отображается отдельной секцией «Гости» (read-only для owner).

## 4. Алгоритм эффективного доступа

```
canAccessBoard(userId, boardId) =>
  user = User(userId)
  board = Board(boardId)
  ws   = Workspace(board.workspaceId)

  // 0. superadmin / soft-deleted workspace
  if user.isSuperadmin: return { allowed: true, role: 'system:admin' }
  if ws.deletedAt !== null: return { allowed: false }

  wsMember = WorkspaceMember(ws.id, userId)
  if !wsMember: return { allowed: false }

  bm = BoardMember(boardId, userId)

  // 1. Workspace owner всегда видит все доски (включая private)
  //    Owner не может быть guest — это проверяется на API уровне (см. R-GUEST в §9).
  if wsMember.rolePreset.name == 'system:owner': return { allowed: true, role: wsMember.rolePresetId }

  // 2. Явный per-board DENIED
  if bm and bm.rolePresetId == null: return { allowed: false }

  // 3. Явный per-board OVERRIDE
  if bm and bm.rolePresetId: return { allowed: true, role: bm.rolePresetId }

  // 4. Guest без explicit BoardMember → нет доступа (даже к public boards)
  if wsMember.isGuest: return { allowed: false }

  // 5. Private board без записи → нет доступа
  if board.isPrivate: return { allowed: false }

  // 6. Public board → workspace role
  return { allowed: true, role: wsMember.rolePresetId }
```

`canActOnBoard(userId, boardId, permission)`:
```
access = canAccessBoard(userId, boardId)
if !access.allowed: return false
return isAllowed(userId, ws.id, permission, withRole = access.role)
```

Функция `isAllowed` из `feature-permissions.md` §5 получает аргумент `withRole?` чтобы заменить дефолтный workspace role на per-board role при проверке.

### 4.1 Особые случаи

| Сценарий | Результат |
|----------|-----------|
| User в WorkspaceMember (не guest), без BoardMember, board public | Доступ по workspace role |
| User в WorkspaceMember (не guest), без BoardMember, board private | Нет доступа |
| User в WorkspaceMember (`system:viewer`), BoardMember с `system:member` | На эту доску читает+пишет (override повышает) |
| User в WorkspaceMember (`system:member`), BoardMember с `null` (denied) | На эту доску **нет** доступа (override понижает в zero) |
| User не в WorkspaceMember, но в BoardMember | Невозможно — auto-create `WorkspaceMember(isGuest=true)` при POST на BoardMember |
| Guest, board public, без BoardMember | Нет доступа (правило 4 блокирует public default) |
| Guest, board с explicit BoardMember | Доступ по per-board role |
| Owner workspace, BoardMember с `null` для себя | Доступ есть (правило 1 перекрывает) — owner нельзя «забанить» с доски |
| Superadmin | Доступ ко всему |

## 5. API контракты

### 5.1 Endpoints

```
GET    /api/boards/:boardId/members
       — список BoardMember + computed effective access для всех WS members
       → BoardAccessRowDto[]

POST   /api/boards/:boardId/members
       { userId | email, rolePresetId | null }   // null = explicit DENY
       — если userId не WorkspaceMember → auto-create WorkspaceMember(isGuest=true)
       — если передан email и user не существует → создать User + invite flow
       → BoardMemberDto

PATCH  /api/boards/:boardId/members/:userId
       { rolePresetId | null }
       → BoardMemberDto

DELETE /api/boards/:boardId/members/:userId
       — удаляет запись BoardMember, возвращает к workspace-default (или к no-access если guest)
       — если у user не остаётся ни одной BoardMember-записи и isGuest=true → удалить WorkspaceMember
       → 204

PATCH  /api/boards/:boardId
       { isPrivate?: boolean, ... }
       — toggle private/public; при переходе public→private требует minimum 1 BoardMember (или сам owner)
```

### 5.2 DTO

```typescript
type BoardMemberDto = {
  userId: string;
  rolePresetId: string | null;     // null = DENIED
  rolePreset: RolePresetDto | null;
  addedBy: string;
  createdAt: string;
};

type BoardAccessRowDto = {
  userId: string;
  user: { id: string; name: string; email: string; avatar: string | null };
  source: 'workspace' | 'board-override' | 'board-denied' | 'workspace-owner' | 'superadmin';
  effectiveRolePresetId: string | null;     // null если denied
  effectiveRoleDisplayName: string | null;
  canEdit: boolean;                          // может ли текущий пользователь править эту строку
};
```

### 5.3 RBAC на сами эндпоинты

- Управлять BoardMember может пользователь с пермиссией `BOARD_MANAGE_ACL`. Эта пермиссия по умолчанию входит в `system:owner` и кастомные роли по выбору owner-а.
- Менять `Board.isPrivate` — только `system:owner` workspace (или `BOARD_MANAGE_ACL` + `BOARD_UPDATE`).

### 5.4 Коды ошибок

| Код | HTTP | Когда |
|-----|------|-------|
| `BOARD_ACCESS_DENIED` | 403 | `canAccessBoard` = false |
| `CANNOT_DENY_OWNER` | 409 | Попытка `POST /members` с rolePresetId=null для пользователя с workspace-ролью `system:owner` |
| `PRIVATE_BOARD_NEEDS_MEMBER` | 409 | Попытка `isPrivate: true` без хотя бы одного BoardMember |
| `INVALID_ROLE_SCOPE` | 400 | `rolePresetId` указывает на роль с `scope != WORKSPACE` |
| `CANNOT_GUESTIFY_OWNER` | 409 | Попытка автосоздания WorkspaceMember с isGuest=true для user, который уже owner workspace или superadmin |

## 6. UX & Accessibility

### 6.1 Где появляется UI

**Локация A — Board page → новая кнопка «Доступ»** (header или меню «...»)
Открывает modal/drawer «Доступ к доске».

**Локация B — WorkspaceSettings → вкладка «Участники»**
В строке участника — кнопка «Показать доступ к доскам» → раскрывается таблица `board × role` для этого пользователя.

### 6.2 Modal «Доступ к доске» (локация A)

Поля:
- Toggle «Приватная доска» (с подсказкой: «Если включено — только явно добавленные участники видят доску»)
- Список всех `WorkspaceMember`:
  - Аватар + имя
  - Источник доступа (badge): «Через workspace» / «Per-board override» / «Запрещён» / «Owner»
  - Dropdown «Роль» с системными + кастомными ролями + опция «Запретить доступ» + опция «Сбросить (как в workspace)»
  - Disabled state для owner workspace и superadmin (нельзя изменить)

### 6.3 Required UI states

- [x] **Loading** — skeleton-строки списка
- [x] **Empty** — для public board без overrides: «Все участники workspace видят эту доску по умолчанию. Добавьте override при необходимости.»
- [x] **Error** — toast + retry; partial-fail при батч-операциях не делаем (одна мутация = одна строка)
- [x] **Confirmation** — modal перед переключением public → private с подсчётом потенциально теряющих доступ: «35 участников потеряют доступ. Продолжить?»
- [x] **Disabled** — для owner workspace dropdown disabled с tooltip «Owner всегда имеет доступ»
- [x] **Optimistic** — изменение роли применяется оптимистично с rollback при ошибке (с aria-live объявлением)

### 6.4 Клавиатурный сценарий

- Tab по строкам списка, dropdown открывается Enter/Space
- Esc закрывает modal с подтверждением если есть несохранённые изменения
- Visible focus на каждой строке

### 6.5 Screen reader

- Список — `role="list"`, строки — `role="listitem"`
- Dropdown — стандартная `combobox` semantics с aria-expanded/aria-activedescendant
- При изменении роли — `aria-live="polite"`: «Роль Анны изменена на Viewer»
- Confirmation modal — `role="alertdialog"`

### 6.6 Touch / responsive

- Mobile: modal становится bottom-sheet на всю высоту
- Строка участника — высота ≥ 56 для удобного нажатия dropdown
- Длинные имена/email обрезаются с tooltip

### 6.7 Edge данные

- 500+ участников в workspace → виртуальный скролл (`react-window` или существующий паттерн)
- Поиск по имени/email в header modal
- Фильтр «Только с per-board override» / «Все»

### 6.8 UI для гостя

Если у текущего пользователя `WorkspaceMember.isGuest = true` в данном workspace:

- **Workspace switcher (topbar)** — показывает workspace name + badge «Гость», entry-point ведёт на единственную доступную доску (или список из 2-3 если их несколько).
- **Сайдбар Boards** — отфильтрован: только доски с explicit BoardMember (не все public).
- **My Tasks** — задачи только из доступных досок.
- **Activity / Last activity feed** — события только из доступных досок (фильтр на бэкенде по `canAccessBoard`).
- **Global search (Cmd+K)** — результаты только из доступных досок.
- **Mentions picker** — гость видит других участников **только своей доски** (BoardMember-список), не workspace-список.
- **WorkspaceSettings** — пункт меню скрыт целиком; даже если гость заходит по прямому URL — 403.

### 6.9 UI для owner — секция «Гости»

В `WorkspaceSettingsPage → Участники`:

- Основной список — `WorkspaceMember WHERE isGuest = false`.
- Отдельная свёрнутая секция «Гости (N)» — список с `isGuest = true`:
  - Аватар, имя, email
  - Колонка «Доступ к доскам» — список названий досок, к которым у гостя есть BoardMember
  - Кнопка «Повысить до участника» — снимает `isGuest`, проставляет дефолтную роль (например `system:member`)
  - Кнопка «Удалить» — каскадно удаляет WorkspaceMember и все BoardMember

## 7. Стыки

### Backend

- `backend/src/prisma/schema.prisma` — `BoardMember` + relations + `Board.members`.
- `backend/src/modules/boards/boards.router.ts` — endpoints из §5.1.
- `backend/src/modules/boards/boards.service.ts`:
  - `listByWorkspace` — теперь фильтрует по `canAccessBoard` для текущего пользователя.
  - `getById` — проверяет `canAccessBoard`.
  - Новые методы `listMembers`, `addMember`, `updateMember`, `removeMember`.
- `backend/src/modules/boards/boards.dto.ts` — `addBoardMemberDto`, `updateBoardMemberDto`.
- `backend/src/shared/utils/permissions.ts` — добавить `canAccessBoard`, `canActOnBoard`.
- `backend/src/shared/middleware/require-board-access.ts` — новое middleware на маршрутах `/api/boards/:boardId/*` и `/api/tasks/*` (через `task.boardId`).
- `backend/src/modules/tasks/tasks.service.ts` — все list/get методы проверяют `canAccessBoard(task.boardId)`.

### Frontend

- `frontend/src/api/boards.ts` — клиенты новых endpoints.
- `frontend/src/components/BoardAccessModal.tsx` — новый компонент (локация A).
- `frontend/src/pages/BoardPage.tsx` — кнопка «Доступ» (видна с `BOARD_MANAGE_ACL`).
- `frontend/src/pages/WorkspaceSettingsPage.tsx` — расширить `renderMembers()` секцией «Доступ к доскам» (локация B).
- `frontend/src/components/BoardCard.tsx` (в списке досок) — фильтрация по `canAccessBoard` уже на backend, но скрытие/полупрозрачность для досок с `denied` не нужно — они просто не приходят.
- `frontend/src/store/boards.store.ts` — invalidate при изменении BoardMember.

### Что не трогаем

- `Task` модель — права на задачи косвенно через `Task.boardId`.
- Комментарии/чеклисты — наследуют доступ от родительской задачи.

## 8. Миграционный план

Одна миграция, additive:

1. `CREATE TABLE board_members (...)`.
2. `ALTER TABLE workspace_members ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false`. Все существующие WorkspaceMember → `isGuest = false`.
3. **Никакого backfill для BoardMember** — таблица стартует пустая. Public boards (текущий дефолт `isPrivate=false`) работают как раньше через workspace role.
4. Phase 2 (отдельный PR): включить проверки `canAccessBoard` в backend (list, get, mutations, notifications, search).
5. Phase 3: UI «Доступ к доске» в Board page и расширение WorkspaceSettings (включая секцию «Гости»).

**Backward compat**: `Board.isPrivate` уже существует, но не используется. После Phase 2 значение начинает действовать. Audit: убедиться что все существующие доски имеют `isPrivate=false` (миграция: `UPDATE boards SET is_private = false WHERE is_private IS NULL` — на всякий случай).

## 9. Риски

| # | Риск | Вероятность | Mitigation |
|---|------|-------------|------------|
| R1 | Запрос «список досок workspace» N+1 по `canAccessBoard` | Высокая | Один запрос: `JOIN BoardMember`. В сервисе — батч-расчёт effective access для списка доступных досок. |
| R2 | Owner случайно делает private+забывает добавить себя | Низкая | Правило 1 (owner всегда видит) — спасает. Плюс UI препятствует создать private без членов (R8 ниже). |
| R3 | Per-board роли с `WS_*` permissions (выходящими за доску) | Средняя | `RolePreset` для board override должна содержать только `BOARD_*`, `TASK_*`, `COMMENT_*`, `CHECKLIST_*`, `LABEL_READ` коды. Валидация на API: warn если preset содержит WS-коды, эффективно игнорируем для board scope. |
| R4 | Cascading delete BoardMember при удалении Board | Низкая | `onDelete: Cascade` в схеме. |
| R5 | Notification spam для denied users | Средняя | Notification service должен учитывать `canAccessBoard` перед отправкой (mention в задаче недоступной доски — skip). |
| R6 | E2E тесты падают потому что user без BoardMember не видит доску | Высокая | Seed обновить: в существующих фикстурах все боарды public, как сейчас. Новые тесты для private + ACL — отдельным suite. |
| R7 | Filter на серверной стороне не учитывает override | Средняя | Серверные фильтры досок (`gap-02 серверные фильтры`) уже работают через `boards.service`, наследуют новую проверку. Тест-кейс обязателен. |
| R8 | Permission caching не инвалидирует при `BoardMember` мутации | Средняя | `permissions.store` уже инвалидируется на mutation; добавить эмит `board:access-changed` через WebSocket / refresh trigger. |
| R9 | Private toggle с 0 BoardMember сделает доску невидимой никому кроме owner | Низкая | API возвращает `409 PRIVATE_BOARD_NEEDS_MEMBER` если попытка переключить в private без хотя бы одной записи. |
| R-GUEST | Гость, повышенный до owner, остаётся isGuest=true → конфликт в правиле 1 algo | Средняя | При смене WorkspaceMember.rolePresetId на `system:owner` — автоматически `isGuest = false`. Тест-кейс. |
| R-GUEST-2 | Гость через mention в комментарии получает уведомление о задаче на public board (не своей) | Высокая | Notification service фильтрует по `canAccessBoard` (см. R5). Для guest правило 4 блокирует public-доски — уведомление не уйдёт. Тест обязателен. |
| R-GUEST-3 | DELETE последнего BoardMember у guest оставит «висячий» WorkspaceMember без любых досок | Средняя | API при DELETE проверяет: если у user `isGuest=true` и `BoardMember.count = 0` после удаления → каскадно удалить WorkspaceMember. Транзакция. |
| R-GUEST-4 | Поднятие isPrivate→false делает доску видимой всем — но guest не должен её видеть | Низкая | Алгоритм правила 4 блокирует guest на public-досках всегда. Не зависит от isPrivate. |
| R-GUEST-5 | Guest видит workspace name в topbar — leak? | Низкая | OK: name + список доступных досок — это и есть его рабочий контекст. Member list, settings, history workspace — недоступны. |

## 10. Решения (зафиксированы 2026-05-18)

1. **Default для новой доски** — `isPrivate = false`, **чекбокс «Приватная» в форме создания**. Если чекнут — после создания обязательное добавление creator в BoardMember (или owner workspace).
2. **Search/Cmd+K и private boards** — **строгая серверная фильтрация по `canAccessBoard`**. Из результатов исчезают задачи/доски/комментарии из недоступных досок. Эндпоинт `/api/search` принимает `userId` из JWT, фильтрует через JOIN с `board_members + workspace_members`.
3. **Глобальный аудитор (`*_READ`) и private boards** — **нет автоматического доступа**. Для аудита приватной доски owner workspace добавляет аудитора в BoardMember явно. Это сохраняет принцип «private = explicit allow-list».
4. **`BoardMember` без `WorkspaceMember`** — **автосоздаём** `WorkspaceMember(isGuest=true)`. Гость видит **только** доски с explicit BoardMember; public-доски workspace ему недоступны. В UI workspace «привязан» к доске. Это новый кейс «гость к одной доске».
5. **Удаление из workspace и BoardMember** — **не каскадно**. История overrides сохраняется. При возврате `WorkspaceMember` — overrides сразу в силе. Каскадное удаление только при удалении `User` целиком из системы (CASCADE на FK userId в BoardMember).

---
