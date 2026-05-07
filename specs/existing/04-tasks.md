---
id: 04-tasks
type: existing
status: approved
---

# Spec: Задачи и подзадачи

## Intent
Основная единица работы: CRUD с issue keys, неограниченная вложенность подзадач через materialized path, переходы по статусам workflow, history-аудит на уровне полей.

## BDD Scenarios

```gherkin
Feature: Задачи — создание и редактирование

  Background:
    Given я авторизован как участник воркспейса
    And существует доска "DEV" с воркфлоу "Default" (статусы: To Do → In Progress → Done)

  # ──── Создание ────

  Scenario: создание задачи через POST API
    When POST /boards/:bid/tasks { title: "Добавить кнопку", statusId: <toDoId> }
    Then 201 + { id, issueKey: "DEV-1", title: "Добавить кнопку", status: { id, name: "To Do" } }
    And следующая задача в этой доске получит issueKey "DEV-2"

  Scenario: создание задачи без statusId — берётся первый статус воркфлоу
    When POST /boards/:bid/tasks { title: "Задача без статуса" }
    Then 201 + { statusId: <первый статус по position> }

  Scenario: создание с невалидным statusId — 400
    When POST /boards/:bid/tasks { title: "X", statusId: "not-a-uuid" }
    Then 400 "Некорректный ID статуса"

  Scenario: title слишком длинный — 400
    When POST /boards/:bid/tasks { title: "<501 символ>" }
    Then 400 "Название не должно превышать 500 символов"

  Scenario: XSS в title — стрипается
    When POST /boards/:bid/tasks { title: "<script>alert(1)</script>Задача" }
    Then 201 + { title: "Задача" }

  # ──── Редактирование ────

  Scenario: inline edit title в TaskDrawer
    Given TaskDrawer открыт для задачи DEV-1
    When я кликаю на title, меняю текст на "Новое название", нажимаю Enter
    Then PATCH /tasks/:id { title: "Новое название" } → 200
    And title в drawer обновляется без перезагрузки страницы
    And в истории задачи появляется запись "title изменён"

  Scenario: сброс assignee (null)
    When PATCH /tasks/:id { assigneeId: null }
    Then 200 + { assignee: null }

  Scenario: установка dueDate в прошлом — допустимо
    When PATCH /tasks/:id { dueDate: "2020-01-01T00:00:00Z" }
    Then 200 (дата в прошлом — валидна, UI красит красным)

  # ──── Переход по статусу ────

  Scenario: переход по разрешённому переходу
    Given воркфлоу FORWARD_ONLY: To Do → In Progress → Done
    When PATCH /tasks/:id/move { statusId: <inProgressId> } (задача в To Do)
    Then 200 + { status: { name: "In Progress" } }
    And history: "status изменён: To Do → In Progress"

  Scenario: переход по запрещённому переходу (FORWARD_ONLY)
    Given задача в статусе "In Progress"
    When PATCH /tasks/:id/move { statusId: <toDoId> } (переход назад)
    Then 400 "Переход из In Progress в To Do не разрешён"

  Scenario: BIDIRECTIONAL — любой переход разрешён
    Given воркфлоу BIDIRECTIONAL
    When PATCH /tasks/:id/move { statusId: <toDoId> } (задача в Done)
    Then 200

  # ──── Подзадачи ────

  Scenario: создание подзадачи
    Given существует задача DEV-5
    When POST /boards/:bid/tasks { title: "Подзадача", parentId: "<DEV-5.id>" }
    Then 201 + { issueKey: "DEV-6", parentId: "<DEV-5.id>" }
    And GET /tasks/DEV-5-id/subtree содержит DEV-6

  Scenario: SubtaskTree в TaskDrawer показывает вложенные подзадачи
    Given DEV-5 имеет подзадачу DEV-6, DEV-6 имеет подзадачу DEV-7
    When я открываю TaskDrawer для DEV-5
    Then вижу дерево: DEV-5 → DEV-6 → DEV-7

  Scenario: клик на подзадачу в SubtaskTree открывает вложенный Drawer
    When я кликаю на DEV-6 в SubtaskTree
    Then открывается вложенный TaskDrawer для DEV-6 поверх родительского

  # ──── Drag-and-drop (Kanban) ────

  Scenario: перетаскивание задачи в другую колонку
    Given задача DEV-1 в колонке "To Do"
    When пользователь перетаскивает DEV-1 в колонку "In Progress"
    Then PATCH /boards/:bid/tasks/reorder с обновлёнными statusId + orderIndex
    And 200 + задача отображается в "In Progress"

  Scenario: перетаскивание внутри колонки (reorder)
    Given колонка "To Do" содержит DEV-1, DEV-2, DEV-3
    When пользователь перетаскивает DEV-3 перед DEV-1
    Then PATCH /boards/:bid/tasks/reorder обновляет orderIndex для всех затронутых задач
    And порядок в колонке: DEV-3, DEV-1, DEV-2

  # ──── Удаление ────

  Scenario: удаление задачи с подзадачами
    Given DEV-5 имеет подзадачу DEV-6 с комментарием и чеклистом
    When DELETE /tasks/<DEV-5-id>
    Then 204
    And GET /tasks/<DEV-6-id> → 404
    And комментарии и чеклисты DEV-6 удалены

  Scenario: удаление задачи другого воркспейса — 403
    Given пользователь не состоит в воркспейсе задачи
    When DELETE /tasks/<task-id>
    Then 403

  # ──── История изменений ────

  Scenario: аудит при редактировании title
    When PATCH /tasks/:id { title: "Новое" }
    Then GET /tasks/:id/history содержит { field: "title", oldValue: "Старое", newValue: "Новое", actorId }

  Scenario: аудит при смене статуса
    When PATCH /tasks/:id/move { statusId: <doneId> }
    Then GET /tasks/:id/history содержит { field: "status", oldValue: "In Progress", newValue: "Done" }

  Scenario: аудит при смене assignee
    When PATCH /tasks/:id { assigneeId: <userId> }
    Then GET /tasks/:id/history содержит { field: "assignee", newValue: "<userName>" }

  # ──── TaskDrawer — табы ────

  Scenario: Drawer открывается на табе Details по умолчанию
    When пользователь кликает на карточку задачи на доске
    Then открывается TaskDrawer, активен таб "Детали"
    And видны: title, description, статус, приоритет, исполнитель, дедлайн, метки, чеклисты, подзадачи

  Scenario: переключение на таб Комментарии
    When я кликаю "Комментарии" в Drawer
    Then загружаются комментарии задачи (GET /tasks/:id/comments)
    And доступно поле ввода нового комментария

  Scenario: переключение на таб История
    When я кликаю "История" в Drawer
    Then загружается history timeline (GET /tasks/:id/history)
    And каждая запись: поле, старое → новое значение, автор, время

  # ──── Фильтрация задач на доске ────

  Scenario: фильтр по исполнителю
    When GET /boards/:bid/tasks?assigneeId=<userId>
    Then ответ содержит только задачи с assigneeId = userId

  Scenario: фильтр duePreset=overdue
    When GET /boards/:bid/tasks?duePreset=overdue
    Then ответ содержит только задачи с dueDate < now()

  Scenario: поиск по title
    When GET /boards/:bid/tasks?search=логин
    Then ответ содержит только задачи с "логин" в title (ILIKE)

  Scenario: пагинация — limit + offset
    When GET /boards/:bid/tasks?limit=10&offset=20
    Then ответ содержит задачи 21–30 (если есть)
```

## SDD Contracts

```typescript
// ── DTOs ──────────────────────────────────────────────────
interface CreateTaskDto {
  title: string;           // 1–500 символов, XSS-stripped
  description?: string;   // XSS-stripped
  statusId?: string;       // UUID; default: первый статус воркфлоу по position
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;        // ISO 8601 datetime
  startDate?: string;      // ISO 8601 datetime
  assigneeId?: string;     // UUID; не проверяется на членство в workspace (gap-04)
  parentId?: string;       // UUID; задача становится подзадачей
}

interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  dueDate?: string | null;
  startDate?: string | null;
  assigneeId?: string | null;
}

interface MoveTaskDto {
  statusId: string;  // UUID; валидируется по transitions текущего workflow
}

interface TaskFiltersDto {
  statusId?: string;
  assigneeId?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  labelId?: string;
  parentId?: string | null;
  rootOnly?: boolean;    // только корневые задачи (parentId = null)
  search?: string;       // max 200 символов, ILIKE по title
  duePreset?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'no_date';
  limit?: number;        // 1–500, default 100
  offset?: number;       // default 0
}

// ── API Routes ────────────────────────────────────────────
// GET    /boards/:boardId/tasks        → TaskDto[]  (фильтры через query)
// POST   /boards/:boardId/tasks        → 201 TaskDto
// PATCH  /boards/:boardId/tasks/reorder → 200 (drag-and-drop порядок)
// PATCH  /boards/:boardId/tasks/bulk   → 200 (bulk update статус/assignee/priority)
// POST   /boards/:boardId/tasks/bulk-delete → 204
//
// GET    /tasks/:id                    → TaskDto
// PATCH  /tasks/:id                    → 200 TaskDto
// PATCH  /tasks/:id/move               → 200 TaskDto  (переход статуса)
// DELETE /tasks/:id                    → 204 (каскад: subtree, comments, checklists, labels)
// GET    /tasks/:id/subtree            → TaskDto[]  (рекурсивное дерево подзадач)
// GET    /tasks/:id/history            → TaskHistoryEntryDto[]
//
// GET    /my-tasks                     → MyTaskDto[]  (задачи текущего user, все workspaces)

// ── Response shape ────────────────────────────────────────
interface TaskDto {
  id: string;
  issueKey: string;          // "DEV-1"
  title: string;
  description: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  dueDate: string | null;
  startDate: string | null;
  orderIndex: number;
  status: { id: string; name: string; color: string; category: StatusCategory };
  assignee: { id: string; name: string; email: string } | null;
  labels: { id: string; name: string; color: string }[];
  _count: { subtasks: number; comments: number; checklists: number };
  parentId: string | null;
  boardId: string;
  createdAt: string;
  updatedAt: string;
}

type StatusCategory = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

interface TaskHistoryEntryDto {
  id: string;
  field: string;           // "title" | "status" | "assignee" | "priority" | "dueDate" | ...
  oldValue: string | null;
  newValue: string | null;
  actor: { id: string; name: string };
  createdAt: string;
}

// ── Materialized path (subtask nesting) ──────────────────
// tasks.path: "/<rootId>/<parentId>/<taskId>/"
// Depth = path.split('/').length - 2
// Subtree query: WHERE path LIKE '<taskPath>%'
// Max depth: 5 (gap-07 enforcement)

// ── Issue Key generation ──────────────────────────────────
// issueKey = board.prefix + '-' + (max issueNum + 1)
// Retry on unique constraint violation (concurrent creates)
```

## Scope
- `backend/src/modules/tasks/` — tasks.router.ts, tasks.service.ts, tasks.dto.ts
- `frontend/src/pages/BoardPage.tsx` — Kanban рендер, drag-and-drop (dnd-kit)
- `frontend/src/components/TaskDrawer.tsx` — Details / Comments / History табы
- `frontend/src/components/SubtaskTree.tsx` — рекурсивное дерево в Drawer
- `frontend/src/pages/MyTasksPage.tsx` — список задач текущего пользователя

## Out of Scope
- Повторяющиеся задачи
- Зависимости (blocking/blocked-by)
- Вложение задачи из другой доски
- Bulk export в CSV/PDF (BACKLOG P3)

## Constraints
- `assigneeId` не валидируется как участник workspace → см. gap-04
- Subtree запрашивается рекурсивно без depth guard → см. gap-07
- Board list: `limit` max 500, default 100; нет cursor-based пагинации → см. gap-05
- `PATCH /tasks/:id/move` валидирует только наличие transition в матрице; принадлежность statusId тому же воркфлоу не проверяется
- `title` и `description` проходят `stripHtml()` — сырой HTML сохранить нельзя
- `reorder` принимает массив; backend пересчитывает `orderIndex` атомарно в транзакции

## Acceptance Criteria
- [ ] `POST /boards/:bid/tasks` → 201, `issueKey = BOARD_PREFIX-N`
- [ ] `POST /boards/:bid/tasks` (title > 500 символов) → 400
- [ ] `POST /boards/:bid/tasks` (XSS в title) → 201, HTML stripped
- [ ] `PATCH /tasks/:id/move` (statusId в transitions) → 200
- [ ] `PATCH /tasks/:id/move` (statusId не в transitions) → 400
- [ ] `DELETE /tasks/:id` → 204, все подзадачи и их данные каскадно удалены
- [ ] `GET /tasks/:id/subtree` возвращает полное дерево подзадач
- [ ] TaskDrawer: inline edit title → Enter → `PATCH` → title обновлён без reload
- [ ] TaskDrawer: таб "История" → `GET /tasks/:id/history` → timeline с field/old/new/actor
- [ ] Drag-and-drop на Kanban → `PATCH /boards/:bid/tasks/reorder` → порядок сохранён
- [ ] Клик на подзадачу в SubtaskTree → вложенный Drawer открывается поверх текущего
- [ ] `GET /boards/:bid/tasks?assigneeId=X` → только задачи assignee X
- [ ] `GET /boards/:bid/tasks?duePreset=overdue` → только просроченные задачи
