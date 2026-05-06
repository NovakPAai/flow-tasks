---
id: 03-boards
type: existing
status: approved
---

# Spec: Доски и представления

## Intent
Доска — пространство задач внутри воркспейса с 4 режимами отображения.

## Scope
- CRUD досок (OWNER only для create/update/delete)
- Привязка к workflow (можно сменить на совместимый)
- Prefix: уникальный в рамках воркспейса, alphanumeric, ≤20 символов, генерирует issue keys (DEV-1, OPS-42)
- 4 представления: Kanban / List / Calendar / Roadmap
- FilterBar: поиск, статус, приоритет, исполнитель, метка, дедлайн (пресеты)
- Управление колонками (WorkflowEditor) из тулбара доски

## Views

### Kanban
- Колонки по статусам workflow, DnD между колонками и внутри
- Оптимистичное обновление при перетаскивании
- Быстрое создание задачи в колонке (+)
- Клик по карточке → TaskDrawer

### List
- Плоский список задач с group by status (сворачиваемые секции)
- Inline создание задачи
- Сортировка по orderIndex

### Calendar
- Месячный календарь, задачи привязаны по dueDate
- Навигация по месяцам

### Roadmap
- Временная шкала задач с startDate / dueDate
- Диапазон: от/до параметры запроса

## Out of Scope
- Приватные доски для отдельных участников (все видят все доски воркспейса кроме VIEWER)
- Экспорт доски в CSV/PDF

## Constraints
- GET /boards/:id возвращает первые 100 задач (hard limit, без пагинации — см. gap-05)
- Roadmap: рекурсивная выборка, нет пагинации — риск при большом дереве
- VIEWER видит доску, но не может создавать/редактировать задачи

## Acceptance Criteria
- [ ] POST /workspaces/:id/boards → 201, prefix уникален
- [ ] Kanban DnD → PATCH /boards/:bid/tasks/reorder → порядок сохранён
- [ ] FilterBar: выбор исполнителя → список задач обновляется (client-side)
- [ ] Переключение вкладок Kanban / List / Calendar / Roadmap без перезагрузки
- [ ] Кнопка «Колонки» → WorkflowEditor в расширенном диалоге
