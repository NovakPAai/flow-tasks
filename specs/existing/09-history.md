---
id: 09-history
type: existing
status: approved
---

# Spec: История изменений (Audit Log)

## Intent
Отслеживание кто, когда и что изменил — на уровне задачи и воркспейса.

## Scope

### Task History (GET /tasks/:id/history)
- Field-level changes: title, description, priority, status, assignee, dueDate, startDate, parentId
- Показывает: actor (name), field, oldValue, newValue, timestamp
- TaskHistoryTimeline в DrawerHistory (таб History)

### Workspace History (GET /workspaces/:id/history, OWNER only)
- События воркспейса: создание/удаление досок, добавление/удаление участников, смена ролей
- WorkspaceHistoryTimeline в WorkspaceSettingsPage
- Лимит: 100 последних событий, без пагинации

## Out of Scope
- Diff для description (только факт изменения)
- История комментариев (edit history)
- Export audit log в CSV

## Constraints
- Workspace history: только OWNER может видеть
- History не удаляется (append-only)
- Лимит 100 без offset (см. gap-05)

## Acceptance Criteria
- [ ] PATCH /tasks/:id (priority) → GET /tasks/:id/history → запись с oldValue/newValue
- [ ] GET /workspaces/:id/history (MEMBER) → 403
- [ ] TaskHistoryTimeline: события отсортированы DESC (новые сверху)
- [ ] История при удалении участника воркспейса: событие появляется в workspace history
