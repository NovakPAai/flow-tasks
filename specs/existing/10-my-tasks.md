---
id: 10-my-tasks
type: existing
status: approved
---

# Spec: Мои задачи (My Tasks Page)

## Intent
Сводная страница всех задач, назначенных на текущего пользователя, сгруппированных по воркспейсу → доска.

## Scope
- GET /my-tasks: фильтр по duePreset, search, limit/offset (100 за раз)
- Фильтр-чипы: Все / Сегодня / Эта неделя / Просрочено / Без даты
- Поиск по title (debounce 300ms)
- Группировка: воркспейс → доска → список задач
- Каждая строка: статус-кружок, issueKey, title, статус-badge, priority, dueDate
- Просроченные задачи: красная подсветка строки
- Load more: кнопка «Загрузить ещё (N)» при total > loaded
- Клик по строке → переход на доску (/w/:slug/boards/:boardSlug)
- Адаптивность: мобильный breakpoint убирает status/priority badges

## Out of Scope
- Открытие TaskDrawer прямо из My Tasks (см. gap-01 — это баг)
- Групировка по другим полям (priority, deadline)
- Сортировка колонок

## Constraints
- API возвращает только задачи, назначенные на текущего пользователя
- Фильтр only по duePreset и search; без фильтра по статусу/приоритету
- Лимит страницы: 100

## Acceptance Criteria
- [ ] GET /my-tasks (duePreset=overdue) → только задачи с dueDate < today и не DONE
- [ ] Поиск "login" → debounce 300ms → fetch с search=login
- [ ] Load more → offset увеличивается, задачи добавляются к списку
- [ ] Все 0 задач → empty state с иконкой
- [ ] Клик по задаче → navigate к доске (НЕ к task drawer — это известный gap-01)
