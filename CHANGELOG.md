# Changelog

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
