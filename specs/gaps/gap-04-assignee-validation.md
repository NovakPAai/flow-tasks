---
id: gap-04-assignee-validation
type: gap-fix
priority: P2
status: draft
---

# Spec: Валидация assigneeId — только участники воркспейса

## Intent
При назначении исполнителя задачи проверять, что пользователь является участником воркспейса.

## Root Cause
`PATCH /tasks/:id` принимает любой UUID как assigneeId без проверки членства в воркспейсе. Можно назначить задачу произвольному пользователю системы.

## Scope
- В `tasks.service.ts` → `updateTask`: если `assigneeId` присутствует → проверить `WorkspaceMember` для воркспейса доски
- Если не член → 400 "Assignee is not a member of this workspace"
- Аналогично при `POST /boards/:bid/tasks` (create с assigneeId)

## Out of Scope
- Автоматическое добавление в воркспейс при назначении
- Уведомление исполнителя (gap-08)

## Constraints
- Нужно достать workspaceId через board: task → board → workspaceId
- assigneeId = null (снятие исполнителя) — всегда разрешено, не валидируем

## Acceptance Criteria
- [ ] PATCH /tasks/:id (assigneeId = UUID не-члена) → 400
- [ ] PATCH /tasks/:id (assigneeId = UUID члена) → 200
- [ ] PATCH /tasks/:id (assigneeId = null) → 200
- [ ] POST /boards/:bid/tasks (assigneeId не-члена) → 400
