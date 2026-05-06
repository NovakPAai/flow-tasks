---
id: 05-workflows
type: existing
status: approved
---

# Spec: Воркфлоу и матрица переходов

## Intent
Настраиваемые статусы и правила переходов между ними для каждой доски.

## Scope
- CRUD воркфлоу (OWNER only)
- 3 режима: FORWARD_ONLY / BIDIRECTIONAL / CUSTOM
- Статусы: name, color, category (OPEN / IN_PROGRESS / DONE / CANCELLED), position
- Drag-reorder статусов (PATCH /workflows/:id/statuses/reorder)
- FORWARD_ONLY / BIDIRECTIONAL: переходы автогенерируются при смене режима или порядка
- CUSTOM: матрица N×N, клик по ячейке → add/delete transition
- Default workflow создаётся при создании воркспейса
- WorkflowEditor: расширенный диалог (min 92vw, 860px) с независимым скроллом панелей

## Out of Scope
- Условия переходов (только ownner может переместить)
- Triggered actions при смене статуса (webhooks)
- Цвет дорожки в зависимости от категории

## Constraints
- OWNER only: create/edit/delete workflow, add/delete statuses, toggle transitions
- Нельзя удалить default workflow воркспейса
- Нельзя удалить единственный статус в workflow
- CUSTOM transitions нельзя добавить/удалить в FORWARD_ONLY / BIDIRECTIONAL режиме
- При смене режима с CUSTOM → FORWARD_ONLY все custom transitions удаляются

## Acceptance Criteria
- [ ] POST /workspaces/:wid/workflows → 201
- [ ] PATCH /workflows/:id (mode: BIDIRECTIONAL) → переходы регенерированы (все ↔)
- [ ] POST /workflows/:id/statuses → 201, statuses reordered
- [ ] DELETE /workflow-statuses/:id (последний статус) → 400
- [ ] WorkflowEditor: CUSTOM режим → клик ячейки → transition создан/удалён мгновенно
- [ ] WorkflowEditor: список 10+ статусов → скроллится независимо от матрицы
