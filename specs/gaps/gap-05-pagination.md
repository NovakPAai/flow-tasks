---
id: gap-05-pagination
type: gap-fix
priority: P2
status: draft
---

# Spec: Пагинация на всех list-эндпоинтах

## Intent
Убрать hardcoded лимиты и добавить cursor/offset пагинацию где данные могут расти.

## Root Cause
Несколько эндпоинтов возвращают данные с неявными лимитами:

| Endpoint | Текущий лимит | Проблема |
|----------|--------------|---------|
| `GET /boards/:id` | 100 задач | Доска с 200+ задач — часть не видна |
| `GET /tasks/:id/comments` | без лимита | Тред с 1000 комментариев — OOM риск |
| `GET /workspaces/:id/history` | hardcode 100 | Нет offset, нет пагинации |
| `GET /admin/audit-log` | clamp(100,500) | Нет offset |
| `GET /boards/:id/roadmap` | без лимита | Рекурсивная выборка дерева |

## Scope
- Стандартный query params: `?limit=<n>&offset=<n>` (или `?cursor=<id>` для comments)
- Response envelope: `{ data: [...], total: number, limit: number, offset: number }`
- Фронт: бесконечная прокрутка или «Загрузить ещё» (паттерн уже есть в My Tasks)
- Приоритетные: /boards/:id (задачи Kanban) → /tasks/:tid/comments → /admin/audit-log

## Out of Scope
- Cursor-based пагинация на всех эндпоинтах (offset достаточно для MVP)
- Keyset pagination (производительность не критична на текущих объёмах)

## Constraints
- Default limit: 50 для задач, 100 для комментариев и history
- Max limit: 200
- Не ломать существующих клиентов: если limit/offset не переданы → дефолтное поведение

## Acceptance Criteria
- [ ] GET /boards/:id?limit=20&offset=20 → 20 задач начиная с 21й, total=N
- [ ] GET /tasks/:tid/comments?limit=50 → первые 50, total указан
- [ ] GET /admin/audit-log?limit=100&offset=100 → следующие 100 событий
- [ ] BoardPage Kanban: при total > loaded → кнопка «Загрузить ещё»
