---
id: gap-02-board-filters-server
type: gap-fix
priority: P1
status: done
---

# Spec: FilterBar — перенести фильтрацию на сервер

## Intent
Текущие фильтры (поиск, статус, приоритет, исполнитель, метка, дедлайн) работают на клиенте над уже загруженными 100 задачами. При >100 задачах фильтры не дают правильный результат.

## Root Cause
`BoardPage.tsx:43` — `applyFilters()` фильтрует только tasks, загруженные при маунте (max 100).
API `GET /boards/:bid/tasks` уже поддерживает query params (statusId, priority, assigneeId, dueDate, labelIds) — они просто не используются с фронта при фильтрации.

## Scope
- FilterBar изменения → PATCH params → новый `GET /boards/:bid/tasks?<filters>`
- Kanban: при активных фильтрах показывать только отфильтрованные карточки
- List/Calendar: аналогично, серверные данные
- Убрать client-side `applyFilters()` из Kanban-рендера
- Поиск: debounce 300ms → новый запрос

## Out of Scope
- Фильтрация в Roadmap view (отдельный endpoint)
- Сохранение фильтров в URL (следующая итерация)
- Комбинирование нескольких labelIds (API уже поддерживает)

## Constraints
- DnD Kanban: при активных фильтрах reorder работает только внутри отфильтрованного набора
- Фильтр «Все» = пустые params = поведение как сейчас
- Не ломать оптимистичное обновление при DnD

## Acceptance Criteria
- [ ] Выбор assignee в FilterBar → GET /boards/:bid/tasks?assigneeId=X → только его задачи в Kanban
- [ ] Поиск "login" → debounce 300ms → GET /boards/:bid/tasks?search=login
- [ ] Board с 200 задачами + фильтр by status → все 200 задач в этом статусе возвращаются, не только первые 100
- [ ] Сброс фильтров → GET без params → полный список
- [ ] applyFilters() удалён из BoardPage.tsx
