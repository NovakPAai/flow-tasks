# Smoke report — issue #167 (QuickDueDate)

**Дата:** 2026-05-18
**Стек:** local Docker (Postgres :5434 + Redis :6380) + backend :3101 + frontend :5174
**Аккаунт:** admin@flowtask.dev (Owner workspace `demo`)
**Verdict:** **green**

## Что проверено

### 1. Kanban (`/w/demo/boards/dev`)

| Сценарий | Шаг | Результат |
|----------|-----|-----------|
| Render с датой | DEV-3 был с `dueDate=2026-05-11` | Чип "11 мая" виден, `aria-label="Изменить срок задачи, 11 мая"` |
| Render без даты | DEV-1/2/4/5 (no dueDate) | Кнопка "+ срок" виден, `aria-label="Добавить срок задачи"` |
| Open popover | Клик по чипу с датой | `role="dialog"` появляется, native date input pre-filled `2026-05-11` |
| TaskDrawer isolation | Клик по чипу | TaskDrawer **не** открылся |
| Save new date | Pick `2026-05-25` → input fires change | UI чип → "25 мая". `GET /api/.../boards/by-prefix/DEV` → `2026-05-28` (после ещё одной правки) ✓ persisted |
| Clear date | Open chip → "Очистить" | UI чип скрылся. API: `dueDate: null` ✓ persisted |
| Add date from empty | Click "+ срок" on DEV-5 → pick `2026-06-15` | UI обновляется. API: `2026-06-15T00:00:00.000Z` ✓ persisted |

### 2. List view (`/w/demo/boards/dev` → toggle "Список")

- Колонка «Срок» отображает чипы для задач с датой
- DEV-5: "15 июн." после сохранения через popover
- DEV-3 пуст (после Clear) — placeholder "+ срок" появляется при hover (по CSS `*:hover .qdd-add-trigger`)

### 3. My Tasks (`/my-tasks`)

- Все 23 задачи admin отображают чипы дат с calendar icon
- Overdue: "Просрочено · 15 мая" / "Просрочено · 18 мая" формат сохранён
- Все чипы кликабельны (admin — Owner во всех воркспейсах через store)

### 4. Backend smoke

| Сценарий | curl | Ответ |
|----------|------|-------|
| Update dueDate | `PATCH /api/tasks/<DEV-3 id>` с `{"dueDate":"2026-05-25T00:00:00.000Z"}` | 200, persisted |
| Clear dueDate | `PATCH /api/tasks/<DEV-3 id>` с `{"dueDate":null}` | 200, persisted |
| Set new dueDate | `PATCH /api/tasks/<DEV-5 id>` с `{"dueDate":"2026-06-15T00:00:00.000Z"}` | 200, persisted |

## Не проверено (за рамками или невозможно локально)

- **Roadmap view** — скип по design-doc (tooltip read-only, drag-resize отдельная задача)
- **Viewer scenario** — нет VIEWER-аккаунта в seed; покрыто unit-тестом (`renders read-only badge when canEdit=false`)
- **Touch / mobile** — hover-state не воспроизводится в headless; CSS `@media (hover: none)` показывает "+ срок" всегда — covered by media query, не тестировалось руками

## Unit tests

11/11 ✓ (`frontend/src/__tests__/QuickDueDate.test.tsx`)

Покрывает:
- render variants (badge-only / badge-or-add / viewer / null value)
- popover open/close
- click isolation (stopPropagation)
- optimistic update + rollback on error
- "Очистить" button
- Escape key
- Overdue styling
