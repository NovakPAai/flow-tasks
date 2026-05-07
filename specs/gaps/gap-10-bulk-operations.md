---
id: gap-10-bulk-operations
type: gap-feat
priority: P3
status: done
---

# Spec: Массовые операции над задачами

## Intent
Позволить пользователю выбрать несколько задач и применить действие ко всем сразу.

## Scope

### Выбор задач
- Checkbox на TaskCard в Kanban и строке в List view
- Shift+Click: выделение диапазона
- «Выбрать все в колонке» (Kanban) / «Выбрать все» (List)
- Floating action bar при наличии выбранных задач (count + actions)

### Доступные действия
- Назначить исполнителя → PATCH /tasks/bulk { ids, assigneeId }
- Изменить приоритет → PATCH /tasks/bulk { ids, priority }
- Переместить в статус → PATCH /tasks/bulk { ids, statusId } (с валидацией transitions)
- Удалить → DELETE /tasks/bulk { ids } (confirm dialog)

### API
- `PATCH /tasks/bulk` — body: `{ ids: string[], action: { field, value } }`
- `DELETE /tasks/bulk` — body: `{ ids: string[] }`
- Max 100 задач за операцию
- Транзакция: all-or-nothing; при ошибке → partial success report

## Out of Scope
- Bulk move between boards
- Bulk add label
- Bulk export

## Constraints
- VIEWER: не может выполнять bulk operations
- Transition validation: bulk move → каждая задача должна иметь валидный transition в target status; невалидные — skipped, report в ответе
- Reorder после bulk move: orderIndex сбрасывается к концу колонки

## Acceptance Criteria
- [ ] Выбор 3 задач → action bar появляется с кнопками
- [ ] Bulk assign → PATCH /tasks/bulk → все 3 задачи обновлены
- [ ] Bulk move в статус (нет перехода у 1 задачи) → 2 перемещены, 1 skipped, ответ содержит `{ succeeded: [...], skipped: [...] }`
- [ ] Bulk delete → confirm dialog → DELETE /tasks/bulk → задачи исчезают из доски
- [ ] Max 100 задач: попытка выбора 101й → не добавляется, toast предупреждение
