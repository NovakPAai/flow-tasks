---
id: 02-workspaces
type: existing
status: approved
---

# Spec: Воркспейсы и управление участниками

## Intent
Организационная единица верхнего уровня. Пользователи объединяются в воркспейс с ролями OWNER / MEMBER / VIEWER.

## Scope
- CRUD воркспейсов (создание → default workflow автоматически)
- Участники: добавление по userId или по email (invite), смена роли, удаление
- Поиск участников по имени/email
- История воркспейса (audit events, OWNER only)
- RBAC: OWNER полный доступ, MEMBER read+write, VIEWER readonly

## Out of Scope
- Публичные воркспейсы (приглашение по ссылке)
- Вложенные воркспейсы
- Перенос доски между воркспейсами

## Constraints
- OWNER не может понизить свою роль или удалить себя
- Удаление воркспейса — каскадное (все доски, задачи, участники)
- История: лимит 100 последних событий (без пагинации — см. gap-05)
- Слаг воркспейса: уникальный, генерируется из имени

## Acceptance Criteria
- [ ] POST /workspaces → 201, создан default workflow
- [ ] POST /workspaces/:id/invite (email) → 200, пользователь добавлен
- [ ] PATCH /workspaces/:id/members/:userId (role: OWNER, self) → 403
- [ ] GET /workspaces (VIEWER) → видит только непривате воркспейсы
- [ ] DELETE /workspaces/:id → 204, все дочерние сущности удалены
