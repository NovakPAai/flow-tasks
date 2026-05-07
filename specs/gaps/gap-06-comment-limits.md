---
id: gap-06-comment-limits
type: gap-fix
priority: P2
status: done
---

# Spec: Ограничения длины для комментариев и чеклистов

## Intent
Защита от хранения и передачи неограниченно больших строк в comment.body и checklist item titles.

## Root Cause
`POST /tasks/:tid/comments` и `POST /checklists/:id/items` не имеют max length в Zod-схеме.
Можно отправить строку в 10MB → запись в БД → потенциальный OOM при fetch.

## Scope
- `comment.body`: max 10 000 символов
- `checklist item title`: max 500 символов
- `checklist name`: max 200 символов
- Zod validation в соответствующих DTO
- Фронт: показывать счётчик символов при приближении к лимиту (>80%)
- Ошибка 400 с понятным сообщением

## Out of Scope
- Rich text / Markdown с хранением HTML (отдельная фича)
- Ограничение количества комментариев на задачу
- Ограничение количества чеклистов на задачу

## Constraints
- Изменение только в DTO/Zod schemas — минимальный diff
- Существующие данные с нарушением длины не трогаем (они уже в БД)

## Acceptance Criteria
- [ ] POST /tasks/:tid/comments (body 10001 символ) → 400 "Comment too long"
- [ ] POST /checklists/:id/items (title 501 символ) → 400 "Title too long"
- [ ] CommentThread textarea: при 8000+ символов → счётчик "8000/10000"
- [ ] При 10000 → поле не принимает новые символы
