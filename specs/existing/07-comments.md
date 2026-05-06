---
id: 07-comments
type: existing
status: approved
---

# Spec: Комментарии к задачам

## Intent
Обсуждение задачи внутри команды с разграничением прав редактирования.

## Scope
- CRUD комментариев к задаче
- Список: хронологический (ASC), без пагинации (все за раз)
- Редактирование: только автор
- Удаление: автор или OWNER воркспейса
- CommentThread в TaskDrawer (таб Comments)
- Аватары с инициалами и цветом по имени

## Out of Scope
- Реакции на комментарии (👍 и т.д.)
- Упоминания (@user)
- Rich text / Markdown
- Вложения / файлы

## Constraints
- VIEWER: читает, но не создаёт комментарии
- Нет max length на body (см. gap-06)
- Нет пагинации на GET /tasks/:tid/comments (см. gap-05)
- OWNER может удалить любой комментарий, MEMBER — только свой

## Acceptance Criteria
- [ ] POST /tasks/:tid/comments (VIEWER) → 403
- [ ] PATCH /comments/:id (не автор) → 403
- [ ] DELETE /comments/:id (OWNER) → 204 (даже чужой комментарий)
- [ ] GET /tasks/:tid/comments → отсортированы по createdAt ASC
- [ ] CommentThread: новый комментарий → скролл к нему автоматически
