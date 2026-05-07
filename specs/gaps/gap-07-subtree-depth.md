---
id: gap-07-subtree-depth
type: gap-fix
priority: P2
status: done
---

# Spec: Лимит глубины рекурсивной выборки подзадач

## Intent
Защита от stack overflow и длительных запросов при неограниченной вложенности подзадач.

## Root Cause
`GET /tasks/:id/subtree` использует рекурсивный CTE без DEPTH LIMIT в Prisma.
Теоретически: задача → 100 уровней вложенности → запрос зависает или ломает БД.

## Scope
- Ограничить subtree: max 10 уровней вложенности (depth limit в materialized path)
- `GET /boards/:id/roadmap`: рекурсивная выборка — аналогичный лимит
- Response: если дерево обрезано → добавить `truncated: true` в метаданные
- SubtaskTree в UI: если `truncated` → показать "Показать ещё уровни" (lazy load)

## Out of Scope
- Изменение materialized path модели
- Ограничение количества подзадач на одном уровне

## Constraints
- Materialized path уже хранит полный path → depth = count(`.` разделителей) + 1
- Лимит 10 достаточен для любого реального use case
- Не ломать существующие данные

## Acceptance Criteria
- [ ] GET /tasks/:id/subtree (дерево 15 уровней) → возвращает первые 10, `truncated: true`
- [ ] GET /tasks/:id/subtree (дерево 5 уровней) → полное, `truncated: false`
- [ ] Запрос не занимает > 500ms при 1000 подзадачах в дереве
- [ ] SubtaskTree: при `truncated: true` → кнопка загрузки следующего уровня
