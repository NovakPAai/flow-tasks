# Changelog

## [v1.5.0] — 2026-05-06 — Gap Analysis: 10 фичей и улучшений

### Новые возможности

#### Gap-01 — Drawer «Мои задачи» (#132)
- Клик по задаче в «Моих задачах» открывает TaskDrawer прямо на странице (без перехода на доску)
- Сохраняется контекст фильтрации и позиция скролла

#### Gap-02 — Серверные фильтры доски (#133)
- Фильтрация `assigneeId`, `priority`, `statusId`, `labelId`, `dueBefore`/`dueAfter` выполняется на сервере
- Поддерживает Kanban и List View одновременно
- Параметры фильтров синхронизируются с URL для шаринга ссылок

#### Gap-03 — Labels IDOR fix (#128)
- Исправлена уязвимость IDOR: прикрепление лейбла проверяет принадлежность задачи воркспейсу
- Проверка членства пользователя перед операциями с лейблами

#### Gap-04 — Валидация assigneeId (#134)
- При создании/обновлении задачи исполнитель должен быть участником воркспейса
- Backend возвращает 400 с понятным сообщением при нарушении

#### Gap-05 — Пагинация (#135 / предыдущий цикл)
- Курсорная пагинация комментариев (кнопка «Загрузить ещё»)
- Ограничение выборки задач с поддержкой пагинации в List View

#### Gap-06 — Счётчики символов (#137)
- Счётчик символов в текстовом поле комментария (предупреждение при >90%, блокировка при 10 000)
- Счётчик символов в полях пунктов чеклиста
- Визуальная подсветка: жёлтый >90%, красный — достигнут лимит

#### Gap-07 — Ограничение вложенности подзадач (#138)
- Максимальная глубина вложенности подзадач: **5 уровней**
- Backend возвращает 400 при попытке создать подзадачу глубже 5
- Frontend отключает кнопку «Добавить подзадачу» и показывает тултип
- Исправлена навигация уведомлений: роутер-стейт вместо URL-параметров

#### Gap-08 — Триггеры уведомлений + email opt-out (#139)
- **@упоминания в описании задачи**: уведомления при сохранении/обновлении задачи
- **Назначение исполнителя**: уведомление при `assigneeId` изменении
- **Email opt-out**: в профиле пользователя — кнопка «Email-уведомления» (вкл/выкл)
- Email для @упоминаний и назначений отправляется только если `emailNotifications: true`
- Настройки хранятся в поле `emailNotifications` модели `User`

#### Gap-09 — Глобальный поиск Cmd+K (#140)
- Командная палитра `CommandPalette` активируется по `Cmd+K` / `Ctrl+K`
- Поиск задач по заголовку и issueKey через дебаунс 300ms
- Backend: `GET /api/search?q=...&limit=20` с rate limit 30 req/min
- Результаты кликабельны — открывают TaskDrawer
- Закрытие: Escape или клик вне палитры

#### Gap-10 — Массовые операции (#141)
- **Множественный выбор задач** в Kanban (чекбокс на карточке) и List View (чекбокс в строке)
- **BulkActionBar** — плавающий тулбар снизу при выбранных задачах
- Массовое изменение: **статус**, **приоритет**, **исполнитель** (с подтверждением/отменой)
- Массовое **удаление** с подтверждением; каскадное удаление подзадач
- Ограничение: до **100 задач** в одной операции
- История: `taskHistory` + `taskStatusHistory` пишутся при bulk-операциях
- Backend: `PATCH /api/boards/:id/tasks/bulk`, `POST /api/boards/:id/tasks/bulk-delete`
- RBAC: VIEWER получает 403, не-участник — 404

### Исправления и улучшения

- **Activity feed**: человекочитаемые описания событий вместо технических полей (#135)
- **Скриншот в форме обратной связи**: вложение изображения при отправке (#135)
- **@Упоминания**: синтаксис `@[Имя](userId)` в задачах и комментариях (#135)
- **Колокольчик уведомлений**: дропдаун с превью и форматированием (#135)
- **VIEWER-роль**: добавлена проверка в `reorderTasks` (ранее отсутствовала) (#141)

---

## [v1.4.0] — 2026-05-05

### Новые возможности

#### SSO — Keycloak & Avanpost (#121)
- Аутентификация через OIDC/PKCE для Keycloak и Avanpost
- JIT-провижининг: автоматическое создание пользователя при первом входе через SSO
- Режим `SSO_ONLY`: отключает локальный вход по паролю
- Маппинг claims: имя, email, аватар из OIDC-провайдера
- Кнопка «Войти через SSO» на странице логина (отображается при `SSO_ENABLED=true`)

#### Security Hardening — 8 этапов (#120)
- **P0 — Хранение секретов**: API-ключи хранятся только как SHA-256-хэш (+ 12-символьный display prefix); токены сброса пароля — только хэш (был plaintext)
- **P0 — Multi-session**: атомарное LRU-вытеснение сессий через Prisma-транзакцию (`MAX_SESSIONS=5`); исключает накопление старых refresh-токенов
- **P0 — IDOR**: `attachPulsarLabel` проверяет принадлежность задачи воркспейсу и членство пользователя
- **P1 — Rate limiter**: sliding window через Redis sorted sets (ZADD + ZREMRANGEBYSCORE + ZCARD в атомарном MULTI pipeline); graceful degradation на in-memory Map при недоступности Redis
- **P1 — Structured logger**: рекурсивный redact по regex `password|secret|token|authorization|cookie|...`; PII не попадает в логи
- **P1 — Audit log**: модель `AuditLog` в Prisma; fire-and-forget в `createUser`, `setUserSuperadmin`, `reviewRequest`; эндпоинт `GET /api/admin/audit-log`
- **P2 — Email провайдер**: nodemailer SMTP для сброса пароля; graceful degradation если SMTP не настроен
- **P2 — CI/CD**: vitest coverage с порогами (lines 60%, branches 50%, functions 60%); E2E job в CI (PR + main); RBAC static check — блокирует CI если роутер без `authenticate`
- **P3 — nginx**: `Content-Security-Policy: default-src 'none'` и `X-Frame-Options: DENY` для `/api/`

### Исправления

- **Диалог редактирования колонок** (#122): раскрывается на 75vw вместо фиксированных 640px — больше не сжатый ([issue #119](https://github.com/NovakPAai/flow-tasks/issues/119))
- **StrictMode double-loadUser** (#123): `useRef`-гард в `App.tsx` предотвращает двойной конкурентный `refreshToken()` в React StrictMode — устраняет редиректы на `/login` в E2E и dev-режиме
- **seed.ts** (#123): флаг `isSuperadmin: true` для `novak.pavel@flowtask.dev` синхронизирован с config-derived проверкой в `getMe()`
- **Lint** (#118): устранены все pre-existing предупреждения ESLint; `FilterState` перенесена в `types/index.ts`
- **Skeleton overflow / nginx cache** (#117): скелетон-грид на мобиле, дублирующиеся `Cache-Control`, idle session timeout
- **Sprint 1 polish** (#116): атомарный `setDefault` для workflow, кнопка «Назад» в My Tasks, mobile overflow, безопасность feedback (rate limit, `escapeMd()`)

---

## [v1.3.0] — 2026-04-25 — Mobile UX & Admin improvements

### Новые возможности
- **FeedbackFAB** — плавающая кнопка обратной связи на всех страницах
- **Landscape-режим** — компактный топбар 40px на iPhone, safe-area-inset, `viewport-fit=cover`
- **AdminUsers** — горизонтальный скролл на мобиле, hover-подсветка

### Исправления
- z-index FAB: 300 (не перекрывает модалки Ant Design)
- `svg aria-hidden="true"` для доступности
- Типизация тестов: `vi.mocked` вместо небезопасного cast

---

## [v1.2.0] — 2026-04-25 — Roadmaps & Subtasks

- RoadmapView: зум (неделя / месяц / квартал), раскрывашки подзадач, overdue-хвост
- SubtaskDrawer drill-down
- История статусов — сегментные бары
- Workspace Dashboard + Roadmaps Hub

---

## [v1.1.0] — 2026-04-20 — Spaces & Polish

- Приватные воркспейсы и доски
- API Keys в профиле
- Adaptive layout 3-tier

---

## [v1.0.0] — 2026-04-11 — UI Kit 2.0

- Dual theme (dark/light), нулевые Ant Design компоненты в базовых вьюхах
