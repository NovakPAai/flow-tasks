# FlowTask — Specs Backlog

Консолидированный бэклог: открытые гепы + out-of-scope из всех спек.
Последнее обновление: май 2026 (gap-21). Верифицировано по git-истории и кодовой базе.

---

## Статус всех гепов

| # | Файл | Тип | Приоритет | Статус | PR |
|---|------|-----|-----------|--------|----|
| gap-01 | my-tasks-drawer | fix | P1 | superseded → gap-11 | — |
| gap-02 | board-filters-server | fix | P1 | **done** | #133 |
| gap-03 | label-idor | fix / security | P1 | **done** | code |
| gap-04 | assignee-validation | fix | P2 | **done** | #134 |
| gap-05 | pagination | fix | P2 | **done** | code |
| gap-06 | comment-limits | fix | P2 | **done** | #137 |
| gap-07 | subtree-depth | fix | P2 | **done** | #138 |
| gap-08 | notifications | feat | P3 | **done** | #139 |
| gap-09 | global-search | feat | P3 | **done** | #140 |
| gap-10 | bulk-operations | feat | P3 | **done** | #141 |
| gap-11 | my-tasks-accordion | feat | P2 | **done** | #145 |
| **gap-12** | **workflow-settings-unlocked** | **fix** | **P1** | **done** | этa ветка |
| **gap-13** | **2fa-totp** | **feat** | **P2** | **done** | #151 |
| **gap-14** | **rate-limit-ip-bypass** | **fix / security** | **P1** | **done** | PR #152 |
| **gap-15** | **email-enumeration** | **fix / security** | **P2** | **done** | PR #152 |
| **gap-16** | **account-disabled** | **fix / security** | **P1** | **done** | эта ветка |
| **gap-17** | **siem-mandatory-fields** | **fix / security** | **P1** | **done** | эта ветка |
| **gap-18** | **role-change-audit** | **fix / security** | **P1** | **done** | эта ветка |
| **gap-19** | **api-key-audit** | **fix / security** | **P1** | **done** | эта ветка |
| **gap-20** | **config-change-audit** | **fix / security** | **P1** | **done** | эта ветка |
| **gap-21** | **validation-error-audit** | **fix / security** | **P2** | **done** | эта ветка |
| **gap-22** | **workspace-settings-always-accessible** | **feat / ux** | **P2** | **done** | PR #159 |
| **gap-23** | **superadmin-email-badge** | **fix** | **P1** | **done** | PR #159 |

---

---

## Out-of-Scope — приоритизированный бэклог

Собрано из `## Out of Scope` всех спек (`existing/` + `gaps/`).
Помечены реализованные позиции.

### P1 — Закрыть в ближайших итерациях

| Пункт | Источник | Статус | Заметка |
|-------|----------|--------|---------|
| Упоминания `@user` в комментариях | [07-comments](existing/07-comments.md), [gap-08](gaps/gap-08-notifications.md) | **done** (PR #135) | Реализовано в рамках activity-feed PR |
| Rate limiting на API-ключи | [12-integrations](existing/12-integrations.md) | open | Интеграционные ключи без лимита — DoS-вектор |
| Deep link на задачу (URL при открытии drawer) | [gap-01](gaps/gap-01-my-tasks-drawer.md) | **done** (gap-11) | `?from=my-tasks&open=<id>` реализован в gap-11 |
| Сохранение фильтров в URL | [gap-02](gaps/gap-02-board-filters-server.md) | open | После gap-02; естественное следствие |

### P2 — Следующая волна фич

| Пункт | Источник | Статус | Заметка |
|-------|----------|--------|---------|
| Webhooks (outbound events при изменении задач) | [12-integrations](existing/12-integrations.md) | open | Нужны для CI/CD, Slack, внешних систем |
| Triggered actions при смене статуса | [05-workflows](existing/05-workflows.md) | open | Зависит от webhooks |
| Зависимости между задачами (blocking/blocked-by) | [04-tasks](existing/04-tasks.md) | open | Нужна модель в schema |
| Reorder пунктов чеклиста (drag-n-drop) | [08-checklists](existing/08-checklists.md) | open | Базовая UX-потребность |
| Фильтрация в Roadmap view | [gap-02](gaps/gap-02-board-filters-server.md) | open | Отдельный endpoint; после gap-02 |
| WebSocket real-time уведомления | [gap-08](gaps/gap-08-notifications.md) | open | После polling-версии (gap-08 done) |
| Push-уведомления (browser) | [gap-08](gaps/gap-08-notifications.md) | open | После WebSocket |

### P3 — Среднесрочный roadmap

| Пункт | Источник | Статус | Заметка |
|-------|----------|--------|---------|
| Rich text / Markdown в комментариях и описаниях | [07-comments](existing/07-comments.md), [gap-06](gaps/gap-06-comment-limits.md) | open | Меняет модель хранения + рендерер |
| Вложения / файлы в комментариях | [07-comments](existing/07-comments.md), [13-feedback](existing/13-feedback.md) | open | S3/MinIO; отдельная архитектурная задача |
| Export audit log в CSV | [09-history](existing/09-history.md) | open | Нужен для compliance |
| Экспорт доски в CSV/PDF | [03-boards](existing/03-boards.md) | open | Частый запрос |
| Cursor-based пагинация | [gap-05](gaps/gap-05-pagination.md) | open | После offset-пагинации (gap-05 done) |
| Поиск по комментариям | [gap-09](gaps/gap-09-global-search.md) | open | После глобального поиска (gap-09 done) |
| Bulk export задач | [gap-10](gaps/gap-10-bulk-operations.md) | open | После bulk operations (gap-10 done) |
| Bulk add label | [gap-10](gaps/gap-10-bulk-operations.md) | open | После bulk operations (gap-10 done) |
| Дайджест email (еженедельный) | [gap-08](gaps/gap-08-notifications.md) | open | После email-уведомлений (gap-08 done) |
| OAuth (GitHub, Google) | [01-auth](existing/01-auth.md) | open | Упрощает onboarding |
| Редактирование полей из аккордеона My Tasks | [gap-11](gaps/gap-11-my-tasks-accordion.md) | open | После gap-11 done |
| Мобильный вариант My Tasks аккордеона | [gap-11](gaps/gap-11-my-tasks-accordion.md) | open | Отдельный дизайн |

### P4 — Долгосрочный roadmap / решение не принято

| Пункт | Источник | Заметка |
|-------|----------|---------|
| Elasticsearch / Typesense для поиска | [gap-09](gaps/gap-09-global-search.md) | После ILIKE MVP + роста данных |
| Fuzzy search | [gap-09](gaps/gap-09-global-search.md) | После Elasticsearch |
| Публичные воркспейсы (приглашение по ссылке) | [02-workspaces](existing/02-workspaces.md) | Меняет модель доступа |
| Вложенные воркспейсы | [02-workspaces](existing/02-workspaces.md) | Существенное изменение схемы |
| Перенос доски между воркспейсами | [02-workspaces](existing/02-workspaces.md) | Cascading migration issueKeys |
| Блокировка пользователей (без удаления) | [11-admin](existing/11-admin.md) | Флаг isActive в User |
| Удаление пользователей | [11-admin](existing/11-admin.md) | Cascading delete — осторожно |
| Повторяющиеся задачи | [04-tasks](existing/04-tasks.md) | Сложная логика расписания |
| Вложение задачи из другой доски | [04-tasks](existing/04-tasks.md) | Cross-board materialized path |
| Реакции на комментарии (👍) | [07-comments](existing/07-comments.md) | Nice-to-have |
| Иерархия меток / папки | [06-labels](existing/06-labels.md) | Usability улучшение |
| Cross-workspace labels | [gap-03](gaps/gap-03-label-idor.md) | Не в концепции продукта |
| OAuth apps / scopes для API-ключей | [12-integrations](existing/12-integrations.md) | Нужна отдельная модель permissions |
| Статус обращения feedback (открыт/закрыт) | [13-feedback](existing/13-feedback.md) | Нужен feedback workflow |
| Просмотр своих обращений в FlowTask | [13-feedback](existing/13-feedback.md) | После статусов обращений |
| SMS 2FA | [gap-13](gaps/gap-13-2fa-totp.md) | Не в scope (только TOTP) |
| WebAuthn / FIDO2 | [gap-13](gaps/gap-13-2fa-totp.md) | Долгосрочно |

---

## Сводка

| Раздел | Открыто | Закрыто/Done |
|--------|---------|--------------|
| Активные гепы (gap-01..21) | **0** | 21 (все закрыты) |
| OoS P1 | **2** (rate limit, filter URL) | 2 |
| OoS P2 | **7** | — |
| OoS P3 | **13** | — |
| OoS P4 | **16** | — |
