# FlowTask — Specs Backlog

Консолидированный бэклог: активные гепы + out-of-scope из всех спек.
Источник: реверс-инжиниринг кодовой базы, май 2026.

---

## Активные гепы

### P1 — Критично (безопасность + корректность данных)

| # | Файл | Тип | Что сломано |
|---|------|-----|-------------|
| gap-03 | [gap-03-label-idor.md](gaps/gap-03-label-idor.md) | fix / **security** | IDOR: метка из чужого workspace привязывается к задаче |
| gap-02 | [gap-02-board-filters-server.md](gaps/gap-02-board-filters-server.md) | fix | Фильтры работают только на первых 100 задачах; >100 — неверные результаты |

### P2 — Важно (функциональные дыры, деградация UX)

| # | Файл | Тип | Что сломано / чего не хватает |
|---|------|-----|-------------------------------|
| gap-11 | [gap-11-my-tasks-accordion.md](gaps/gap-11-my-tasks-accordion.md) | feat | **approved** — аккордеон в My Tasks вместо навигации на доску |
| gap-05 | [gap-05-pagination.md](gaps/gap-05-pagination.md) | fix | Нет пагинации: boards лимит 100, comments без лимита (OOM риск) |
| gap-04 | [gap-04-assignee-validation.md](gaps/gap-04-assignee-validation.md) | fix | Можно назначить задачу любому UUID, не только участнику workspace |
| gap-07 | [gap-07-subtree-depth.md](gaps/gap-07-subtree-depth.md) | fix | Рекурсивный subtree без depth limit — потенциальный stack overflow |
| gap-06 | [gap-06-comment-limits.md](gaps/gap-06-comment-limits.md) | fix | Нет max length на comment.body и checklist items — OOM при fetch |

### P3 — Желательно (новые фичи)

| # | Файл | Тип | Что нужно |
|---|------|-----|-----------|
| gap-08 | [gap-08-notifications.md](gaps/gap-08-notifications.md) | feat | Уведомления: in-app (колокольчик) + email (при назначении, комментарии) |
| gap-09 | [gap-09-global-search.md](gaps/gap-09-global-search.md) | feat | Глобальный поиск Cmd+K по задачам всех workspace |
| gap-10 | [gap-10-bulk-operations.md](gaps/gap-10-bulk-operations.md) | feat | Массовые операции: bulk assign / priority / move / delete |

> gap-01 superseded by gap-11.

---

## Out-of-Scope — приоритизированный бэклог

Собрано из `## Out of Scope` всех спек (`existing/` + `gaps/`).

### P1 — Закрыть в ближайших итерациях

| Пункт | Источник | Почему P1 |
|-------|----------|-----------|
| Rate limiting на API-ключи | [12-integrations](existing/12-integrations.md) | Интеграционные ключи без лимита = DoS-вектор |
| Упоминания `@user` в комментариях | [07-comments](existing/07-comments.md), [gap-08](gaps/gap-08-notifications.md) | Базовый collaboration-паттерн; нужен до уведомлений |
| Deep link на задачу (URL при открытии drawer) | [gap-01](gaps/gap-01-my-tasks-drawer.md) | Без deep link нельзя шарить задачу ссылкой |
| Сохранение фильтров в URL | [gap-02](gaps/gap-02-board-filters-server.md) | После серверных фильтров (gap-02) — естественное следствие |

### P2 — Следующая волна фич

| Пункт | Источник | Заметка |
|-------|----------|---------|
| Webhooks (outbound events при изменении задач) | [12-integrations](existing/12-integrations.md) | Нужны для интеграций с CI/CD, Slack, внешними системами |
| 2FA / TOTP | [01-auth](existing/01-auth.md) | Требование enterprise-клиентов |
| Зависимости между задачами (blocking/blocked-by) | [04-tasks](existing/04-tasks.md) | Есть спрос в PM-инструментах; нужна модель в schema |
| Фильтрация в Roadmap view | [gap-02](gaps/gap-02-board-filters-server.md) | Отдельный endpoint; после gap-02 |
| Triggered actions при смене статуса (webhooks) | [05-workflows](existing/05-workflows.md) | Зависит от webhooks выше |
| Reorder пунктов чеклиста (drag-n-drop) | [08-checklists](existing/08-checklists.md) | Базовая UX-потребность |
| WebSocket real-time доставка in-app | [gap-08](gaps/gap-08-notifications.md) | После polling-версии уведомлений (gap-08) |
| Push-уведомления (browser/mobile) | [gap-08](gaps/gap-08-notifications.md) | После in-app (gap-08) |

### P3 — Среднесрочный roadmap

| Пункт | Источник | Заметка |
|-------|----------|---------|
| Rich text / Markdown в комментариях и описаниях | [07-comments](existing/07-comments.md), [gap-06](gaps/gap-06-comment-limits.md) | Требует изменение модели хранения + рендерер |
| Вложения / файлы в комментариях | [07-comments](existing/07-comments.md), [13-feedback](existing/13-feedback.md) | S3/MinIO; отдельная архитектурная задача |
| Export audit log в CSV | [09-history](existing/09-history.md) | Нужен для compliance |
| Экспорт доски в CSV/PDF | [03-boards](existing/03-boards.md) | Частый запрос |
| OAuth (GitHub, Google) | [01-auth](existing/01-auth.md) | Упрощает onboarding |
| Cursor-based пагинация на всех эндпоинтах | [gap-05](gaps/gap-05-pagination.md) | После offset-пагинации (gap-05) |
| Поиск по комментариям | [gap-09](gaps/gap-09-global-search.md) | После глобального поиска (gap-09) |
| Bulk export задач | [gap-10](gaps/gap-10-bulk-operations.md) | После bulk operations (gap-10) |
| Bulk add label | [gap-10](gaps/gap-10-bulk-operations.md) | После bulk operations (gap-10) |
| Дайджест email (еженедельный) | [gap-08](gaps/gap-08-notifications.md) | После email-уведомлений (gap-08) |
| Редактирование полей из аккордеона My Tasks | [gap-11](gaps/gap-11-my-tasks-accordion.md) | После gap-11 |
| Мобильный вариант My Tasks аккордеона | [gap-11](gaps/gap-11-my-tasks-accordion.md) | Адаптив; отдельный дизайн |

### P4 — Долгосрочный roadmap / решение не принято

| Пункт | Источник | Заметка |
|-------|----------|---------|
| Elasticsearch / Typesense для поиска | [gap-09](gaps/gap-09-global-search.md) | После ILIKE MVP + роста данных |
| Fuzzy search | [gap-09](gaps/gap-09-global-search.md) | После Elasticsearch |
| Публичные воркспейсы (приглашение по ссылке) | [02-workspaces](existing/02-workspaces.md) | Меняет модель доступа |
| Вложенные воркспейсы | [02-workspaces](existing/02-workspaces.md) | Существенное изменение схемы |
| Перенос доски между воркспейсами | [02-workspaces](existing/02-workspaces.md) | Нужна миграция данных (issueKeys) |
| Блокировка пользователей (без удаления) | [11-admin](existing/11-admin.md) | Требует флаг isActive в User |
| Удаление пользователей | [11-admin](existing/11-admin.md) | Cascading delete — осторожно |
| Повторяющиеся задачи | [04-tasks](existing/04-tasks.md) | Сложная логика расписания |
| Вложение задачи из другой доски | [04-tasks](existing/04-tasks.md) | Cross-board materialized path |
| Реакции на комментарии (👍 и т.д.) | [07-comments](existing/07-comments.md) | Nice-to-have |
| Иерархия меток / папки | [06-labels](existing/06-labels.md) | Usability улучшение |
| Cross-workspace labels | [gap-03](gaps/gap-03-label-idor.md) | Не в концепции продукта |
| Приглашения по ссылке без email | [01-auth](existing/01-auth.md) | Безопасность vs удобство |
| OAuth apps / scopes для API-ключей | [12-integrations](existing/12-integrations.md) | Нужна отдельная модель permissions |
| Статус обращения feedback (открыт/закрыт) | [13-feedback](existing/13-feedback.md) | Нужен feedback workflow |
| Просмотр своих обращений в FlowTask | [13-feedback](existing/13-feedback.md) | После статусов обращений |

---

## Сводка по компонентам

| Компонент | Активных гепов | Out-of-scope (todo) |
|-----------|---------------|---------------------|
| Tasks / Board | 4 (gap-02,05,07,10) | 6+ |
| My Tasks | 2 (gap-01→11, gap-11) | 3 |
| Auth | — | 3 (2FA, OAuth, invite) |
| Labels | 1 (gap-03) | 2 |
| Comments | 1 (gap-06) | 4 (mentions, RT, files, reactions) |
| Notifications | 1 (gap-08) | 3 (push, WS, digest) |
| Search | 1 (gap-09) | 2 (comments, fuzzy) |
| Integrations | — | 3 (webhooks, rate-limit, scopes) |
| Admin | — | 2 (block, delete) |
| Workspaces | — | 3 |
