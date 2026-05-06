# FlowTask — Specs

Спецификации получены методом реверс-инжиниринга кодовой базы (май 2026).

## Структура

```
specs/
  existing/   — что реализовано (задокументированный факт)
  gaps/       — чего не хватает или сделано криво (задачи на исправление)
  template.md — шаблон для новых спек
```

## Легенда типов

| Тип | Описание |
|-----|----------|
| `existing` | Реализованный функционал, задокументирован как есть |
| `gap-fix` | Баг или неправильная реализация — нужно исправить |
| `gap-feat` | Отсутствующая фича — нужно спроектировать и реализовать |

## Приоритеты гапов

| # | Файл | Тип | Приоритет |
|---|------|-----|-----------|
| 1 | [gap-01-my-tasks-drawer.md](gaps/gap-01-my-tasks-drawer.md) | fix | P1 |
| 2 | [gap-02-board-filters-server.md](gaps/gap-02-board-filters-server.md) | fix | P1 |
| 3 | [gap-03-label-idor.md](gaps/gap-03-label-idor.md) | fix | P1 — security |
| 4 | [gap-04-assignee-validation.md](gaps/gap-04-assignee-validation.md) | fix | P2 |
| 5 | [gap-05-pagination.md](gaps/gap-05-pagination.md) | fix | P2 |
| 6 | [gap-06-comment-limits.md](gaps/gap-06-comment-limits.md) | fix | P2 |
| 7 | [gap-07-subtree-depth.md](gaps/gap-07-subtree-depth.md) | fix | P2 |
| 8 | [gap-08-notifications.md](gaps/gap-08-notifications.md) | feat | P3 |
| 9 | [gap-09-global-search.md](gaps/gap-09-global-search.md) | feat | P3 |
| 10 | [gap-10-bulk-operations.md](gaps/gap-10-bulk-operations.md) | feat | P3 |

## Существующие спеки

| Файл | Модуль |
|------|--------|
| [01-auth.md](existing/01-auth.md) | Аутентификация и сессии |
| [02-workspaces.md](existing/02-workspaces.md) | Воркспейсы и участники |
| [03-boards.md](existing/03-boards.md) | Доски и представления |
| [04-tasks.md](existing/04-tasks.md) | Задачи и подзадачи |
| [05-workflows.md](existing/05-workflows.md) | Воркфлоу и переходы |
| [06-labels.md](existing/06-labels.md) | Метки |
| [07-comments.md](existing/07-comments.md) | Комментарии |
| [08-checklists.md](existing/08-checklists.md) | Чеклисты |
| [09-history.md](existing/09-history.md) | История изменений |
| [10-my-tasks.md](existing/10-my-tasks.md) | Мои задачи |
| [11-admin.md](existing/11-admin.md) | Панель администратора |
| [12-integrations.md](existing/12-integrations.md) | API-ключи и интеграции |
| [13-feedback.md](existing/13-feedback.md) | Обратная связь |
