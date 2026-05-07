---
id: gap-03-label-idor
type: gap-fix
priority: P1
status: done
---

# Spec: IDOR — валидация принадлежности метки к воркспейсу задачи

## Intent
Предотвратить привязку метки из чужого воркспейса к задаче.

## Root Cause
`POST /tasks/:tid/labels/:labelId` в `labels.service.ts` проверяет только что пользователь является членом воркспейса задачи, но не проверяет что `label.workspaceId === task.board.workspaceId`.

Атака: пользователь член воркспейса A и воркспейса B. Создаёт метку в B, передаёт её labelId при привязке к задаче в A — работает.

## Scope
- В `addLabelToTask`: fetch label → проверить `label.workspaceId === task.board.workspaceId`
- Если не совпадает → 400 "Label does not belong to this workspace"
- Аналогичная проверка в `removeLabelFromTask` (там уже нет IDOR, но стоит добавить проверку для консистентности)

## Out of Scope
- Миграция существующих некорректных TaskLabel (редких, т.к. bug только в dev)
- Cross-workspace labels (не в scope продукта)

## Constraints
- Минимальное изменение: только в `labels.service.ts`, без изменения API контракта
- Ошибка 400, не 403 (это не проблема прав, а проблема валидности данных)

## Acceptance Criteria
- [ ] POST /tasks/:tid/labels/:labelId (label из другого workspace) → 400
- [ ] POST /tasks/:tid/labels/:labelId (label из того же workspace) → 200
- [ ] Тест: member двух workspace не может кросс-привязать метку
