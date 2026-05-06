---
id: 06-labels
type: existing
status: approved
---

# Spec: Метки (Labels)

## Intent
Цветные теги для классификации задач в рамках воркспейса.

## Scope
- CRUD меток (name, color) в рамках воркспейса
- Привязка метки к задаче (upsert), открепление
- Список меток воркспейса с количеством задач (taskCount)
- LabelPicker в TaskDrawer: поиск по name, создание новой метки inline
- FilterBar: фильтрация задач по одной метке

## Out of Scope
- Метки уровня задачи (без workspace-scope)
- Множественный фильтр по меткам
- Иерархия меток / папки

## Constraints
- OWNER/MEMBER: create/update/delete метки
- VIEWER: только просмотр
- DELETE метки → каскадное удаление TaskLabel (но не задач)
- IDOR: attach label к задаче не проверяет принадлежность метки тому же воркспейсу (см. gap-03)

## Acceptance Criteria
- [ ] POST /workspaces/:wid/labels → 201
- [ ] DELETE /labels/:id (VIEWER) → 403
- [ ] POST /tasks/:tid/labels/:labelId → 200, метка отображается в DrawerDetails
- [ ] GET /workspaces/:wid/labels → каждая метка содержит taskCount
- [ ] LabelPicker: ввод нового имени + Enter → создаёт метку и привязывает к задаче
