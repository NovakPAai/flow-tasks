---
id: 04-tasks
type: existing
status: approved
---

# Spec: Задачи и подзадачи

## Intent
Основная единица работы. Поддерживает неограниченную вложенность, переходы по статусам workflow, историю изменений.

## Scope
- CRUD задач (title, description, priority, dueDate, startDate, assigneeId)
- Issue keys: BOARD_PREFIX-N, автогенерация с retry на коллизию
- Materialized path для unlimited subtask nesting
- Переход по статусу: PATCH /tasks/:id/move → валидация по transitions workflow
- Drag-reorder внутри колонки и между колонками (Kanban)
- История изменений поля (field-level audit: title, description, priority, status, assignee, dueDate)
- Подзадачи: SubtaskTree в TaskDrawer, PATCH /tasks/:id (parentId для вложения)
- TaskDrawer: 3 таба — Details / Comments / History

### TaskDrawer — Details
- Inline edit: title (click), description (textarea)
- Поля: статус (select), приоритет (select), исполнитель (dropdown участников), дедлайн (date input), начало (date input)
- Метки (LabelPicker)
- Чеклисты (ChecklistBlock)
- Подзадачи (SubtaskTree)
- Удаление задачи (каскад: подзадачи, комментарии, чеклисты, метки)

## Out of Scope
- Повторяющиеся задачи
- Зависимости между задачами (blocking/blocked-by)
- Вложение задачи из другой доски

## Constraints
- assigneeId — не валидируется как участник воркспейса (см. gap-04)
- Subtree: рекурсивная выборка без depth limit (см. gap-07)
- Board task list: неявный лимит 100 задач без пагинации (см. gap-05)
- Переход статуса валидируется только по transitions; target status принадлежность воркфлоу не проверяется

## Acceptance Criteria
- [ ] POST /boards/:bid/tasks → 201, issueKey = PREFIX-N
- [ ] PATCH /tasks/:id/move (statusId не в transitions) → 400
- [ ] DELETE /tasks/:id → 204, все подзадачи удалены
- [ ] TaskDrawer: inline edit title → Enter → PATCH /tasks/:id → title обновлён без перезагрузки страницы
- [ ] Subtask в DrawerSubtaskTree → открывает вложенный Drawer
