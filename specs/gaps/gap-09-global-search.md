---
id: gap-09-global-search
type: gap-feat
priority: P3
status: draft
---

# Spec: Глобальный поиск по задачам

## Intent
Быстрый поиск задач по title / issueKey / description across all workspaces пользователя.

## Scope
- Shortcut: Cmd+K / Ctrl+K → открывает Search Palette
- Поле ввода: realtime поиск (debounce 200ms)
- Источники: задачи из всех воркспейсов пользователя
- Результаты: issueKey + title + board + workspace + статус
- Клик по результату → TaskDrawer поверх текущей страницы
- Recent: последние 5 открытых задач (localStorage)

### API
- `GET /search/tasks?q=<term>&limit=20`
- Full-text search по `title` и `issueKey` (PostgreSQL `ILIKE` или `tsvector`)
- Фильтрация: только задачи из воркспейсов, где user является участником

## Out of Scope
- Поиск по комментариям
- Поиск по воркспейсам и доскам (только задачи)
- Elasticsearch / Typesense (простой ILIKE достаточен для MVP)
- Fuzzy search

## Constraints
- RBAC: только задачи доступных пользователю воркспейсов
- Limit: max 20 результатов
- Performance: index на `tasks(title, issueKey)` или `tsvector` колонка

## Acceptance Criteria
- [ ] Cmd+K → Search Palette открывается
- [ ] Ввод "DEV-1" → задача с issueKey DEV-1 в результатах
- [ ] Ввод "login" → задачи с "login" в title
- [ ] Клик по результату → TaskDrawer открывается (не navigate)
- [ ] Задачи из чужих воркспейсов → не в результатах
- [ ] Escape → закрывает палитру
