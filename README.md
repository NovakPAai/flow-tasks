# FlowTask

Лёгкий таск-трекер — аналог YouGile/Trello с Kanban-досками, дорожными картами, рабочими пространствами и workflow-переходами.

**Версия:** v1.7.0 · [Changelog](CHANGELOG.md)

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Node.js 20 · Express 4 · TypeScript 5 |
| ORM | Prisma 6 · PostgreSQL 16 |
| Cache | Redis 7 |
| Frontend | React 18 · Vite 6 · Ant Design 5 · Zustand |
| DnD | @hello-pangea/dnd |
| Auth | JWT (15m access) + Refresh tokens (7d) + SSO (Keycloak / Avanpost) |
| Testing | Vitest · Testing Library · Playwright |

## Возможности

- **Kanban-доски** — drag-and-drop задач, кастомные workflow-переходы (FORWARD_ONLY / BIDIRECTIONAL / CUSTOM)
- **Серверные фильтры** — assignee, priority, status, label, due date; параметры синхронизируются с URL
- **Дорожные карты** — Gantt-подобный вид с зумом (неделя / месяц / квартал), подзадачи раскрывашкой, overdue-индикатор
- **Рабочие пространства** — приватные/публичные, RBAC (Owner / Member / Viewer), страница настроек
- **Подзадачи** — до 5 уровней вложенности (materialized path), drawer drill-down
- **Массовые операции** — выбор задач, batch-изменение статуса/приоритета/исполнителя, массовое удаление
- **Глобальный поиск** — `Cmd+K` командная палитра, поиск задач по заголовку и issueKey
- **Мои задачи — аккордеон** — встроенная панель деталей прямо в списке (описание, статус, дедлайн, исполнитель, теги), синхронизация с URL (`?open=`)
- **Уведомления** — @упоминания в задачах и комментариях, уведомление о назначении, email opt-out
- **История статусов** — сегментные бары изменений в задаче и в дорожной карте
- **Счётчики символов** — в комментариях и пунктах чеклиста с цветовой индикацией
- **Мобильная адаптация** — responsive 3-tier (mobile / tablet / desktop), landscape-режим, safe-area для iPhone notch
- **Обратная связь** — плавающая кнопка FAB на всех страницах, определение устройства
- **Администрирование** — страница пользователей и статистики, горизонтальный скролл на мобиле
- **Human-readable URL** — доски по prefix вместо UUID (DEV-1, OPS-42)
- **SSO** — вход через Keycloak или Avanpost (OIDC/PKCE), JIT-провижининг, режим `SSO_ONLY`
- **Security Hardening** — rotating refresh tokens, LRU session eviction, rate-limit (Redis sliding window), structured logger с redact PII, audit log
- **API Keys** — в профиле пользователя

## Быстрый старт

### Требования

- Node.js 20+
- Docker & Docker Compose

### Запуск

```bash
# 1. Клонировать репозиторий
git clone https://github.com/NovakPAai/flow-tasks.git
cd flow-tasks

# 2. Поднять PostgreSQL + Redis
docker compose up -d

# 3. Установить зависимости + мигрировать БД + seed
make setup

# 4. Запустить backend + frontend
make dev
```

Приложение доступно на http://localhost:5174

### Демо-аккаунты (после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| admin@flowtask.dev | Password1 | Владелец |
| user@flowtask.dev | Password1 | Участник |

## Переменные окружения

Скопируй `.env.example` → `.env` в директории `backend/`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/flowtask
REDIS_URL=redis://localhost:6380
JWT_SECRET=flowtask-dev-secret-change-me
JWT_REFRESH_SECRET=flowtask-dev-refresh-secret-change-me
PORT=3101
NODE_ENV=development

# SSO — опционально (кнопка "Войти через SSO" появляется только при SSO_ENABLED=true)
# SSO_ENABLED=true
# SSO_PROVIDER=keycloak          # keycloak | avanpost
# SSO_CLIENT_ID=flowtask
# SSO_CLIENT_SECRET=<secret>
# SSO_ISSUER_URL=https://keycloak.example.com/realms/myrealm
# SSO_ONLY=false                 # true — отключить локальный вход по паролю
```

## Команды Makefile

| Команда | Описание |
|---------|---------|
| `make setup` | Docker up + npm install + migrate + seed |
| `make dev` | Backend (3101) + Frontend (5174) |
| `make backend` | Только backend |
| `make frontend` | Только frontend |
| `make migrate` | Prisma migrate dev |
| `make seed` | Пересеять БД |
| `make lint` | ESLint |
| `make typecheck` | TypeScript проверка |
| `make sync` | Синхронизация с origin/main |
| `make pr` | Push + создать PR |
| `make ship` | sync → lint → push → PR |
| `make merge` | Squash-merge текущего PR |

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id
GET    /api/workspaces/:id/members
POST   /api/workspaces/:id/invite
PATCH  /api/workspaces/:id/members/:userId
DELETE /api/workspaces/:id/members/:userId

GET    /api/boards
POST   /api/boards
PATCH  /api/boards/:id
DELETE /api/boards/:id
GET    /api/boards/:bid/tasks          # query: assigneeId, priority, statusId, labelId, dueBefore, dueAfter
POST   /api/boards/:bid/tasks
PATCH  /api/boards/:bid/tasks/reorder
PATCH  /api/boards/:bid/tasks/bulk     # bulk update (status, priority, assignee); max 100 ids
POST   /api/boards/:bid/tasks/bulk-delete  # bulk delete with subtask cascade; max 100 ids

GET    /api/tasks/:id
PATCH  /api/tasks/:id
PATCH  /api/tasks/:id/move
DELETE /api/tasks/:id
GET    /api/tasks/:id/history
GET    /api/tasks/:id/subtasks
POST   /api/tasks/:id/subtasks

GET    /api/workspaces/:wid/labels
POST   /api/workspaces/:wid/labels
POST   /api/tasks/:tid/labels/:labelId
DELETE /api/tasks/:tid/labels/:labelId

GET    /api/tasks/:tid/comments
POST   /api/tasks/:tid/comments
PATCH  /api/comments/:id
DELETE /api/comments/:id

GET    /api/my-tasks
GET    /api/roadmap/:boardId
GET    /api/search?q=&limit=       # global task search, rate-limit 30/min
GET    /api/notifications
PATCH  /api/notifications/:id/read
POST   /api/notifications/read-all
GET    /api/users                  # admin only
GET    /api/users/:id/stats        # admin only
```

## Деплой на VPS

```bash
# На сервере (Ubuntu 22.04 / Astra Linux)
git clone https://github.com/NovakPAai/flow-tasks.git /opt/flow-tasks
cd /opt/flow-tasks
cp backend/.env.example backend/.env
# Отредактировать backend/.env (продакшн-секреты!)
docker compose -f docker-compose.yml up -d
make setup
```

Nginx reverse-proxy:
- `http://localhost:3101` → `/api`
- Статика фронта: `npm run build` → раздавать из `frontend/dist`

## Структура проекта

```
flow-tasks/
├── backend/
│   └── src/
│       ├── modules/          # auth, workspaces, workflows, boards, tasks, labels, comments, history, onboarding, roadmap, users
│       ├── shared/           # middleware (asyncHandler, rate-limit, logger), utils, types
│       └── prisma/           # schema.prisma, migrations, seed.ts
├── frontend/
│   └── src/
│       ├── api/              # axios клиент + типизированные вызовы
│       ├── components/       # AppLayout, TaskCard, TaskDrawer, SubtaskDrawer, FeedbackFAB, RoadmapView, ...
│       ├── hooks/            # useBreakpoint, useIsLandscape, useResponsiveValue
│       ├── pages/            # WorkspacesPage, BoardPage, MyTasksPage, WorkspaceDashboardPage, AdminUsersPage, ...
│       ├── store/            # auth.store, workspace.store (Zustand)
│       └── types/            # TypeScript типы
├── docker-compose.yml
├── Makefile
└── README.md
```

## Changelog

### v1.7.0 — Корзина, быстрая правка срока, polish (2026-05-18)
- **Быстрая правка срока задачи** (#167): клик по дате на карточке/в списке/в «Моих задачах» открывает календарь без TaskDrawer
- **Корзина воркспейсов** (#157): удалённый воркспейс хранится 10 рабочих дней; восстановление и hard-delete с type-to-confirm — в меню профиля
- **Свернуть/развернуть всё в Дорожной карте** (#156): кнопка в тулбаре и клавиша `E`
- **«Настройки пространства» в меню аватарки** (#159): доступны из любой страницы
- **Подсказки требований к паролю на регистрации** (#162): живой чек-лист
- **Дорожная карта polish** (#158, #160): milestone-ромб, легенда, touch-тултип, скелетоны
- **`.env` override** (#166): значения из `.env` всегда перекрывают окружение процесса
- Стандарты разработки + автогенерация OpenAPI из Zod-схем (#161)

### v1.6.0 — Security Hardening: gaps 12–21 (2026-05-08)
- WorkspaceSettingsPage ghost-lock fix (gap-12), SSO MFA через `amr`-claim (gap-13)
- Rate-limit по email (gap-14), email enumeration prevention (gap-15)
- isActive check в JWT middleware (gap-16), SIEM-теги в AuditLog (gap-17)
- Role change audit (gap-18), API key audit (gap-19), config change audit (gap-20), validation error audit (gap-21)

### v1.5.0 — Gap Analysis: 11 улучшений (2026-05-06)
- **Аккордеон в «Мои задачи»** (gap-11): детали задачи прямо в списке, синхронизация с URL
- **Серверные фильтры** доски (gap-02): assignee/priority/status/label/due
- **Счётчики символов** (gap-06): комментарии и чеклисты, предупреждение при >90%
- **Ограничение вложенности** подзадач 5 уровней (gap-07)
- **Email opt-out + доп. триггеры** уведомлений (gap-08): @упоминания в задачах, назначение исполнителя
- **Глобальный поиск** Cmd+K (gap-09): командная палитра, поиск по задачам
- **Массовые операции** (gap-10): bulk-update статуса/приоритета/исполнителя и bulk-delete до 100 задач
- Исправлен IDOR для labels, валидация assigneeId в workspace, пагинация комментариев
- Исправлены TypeScript-ошибки (`emitMentionNotifications`), обновлены тесты под paginated API

### v1.4.0 — SSO, Security Hardening & E2E CI (2026-05-05)
- SSO через Keycloak и Avanpost (OIDC/PKCE), JIT-провижининг, режим SSO_ONLY
- Security Hardening: rotating refresh tokens + LRU session eviction, rate-limit (Redis sliding window), structured logger с redact PII, audit log, SMTP для сброса пароля
- E2E CI: Playwright тесты в CI (PR + main), coverage gates (vitest), RBAC static check
- Исправления: StrictMode double-loadUser, диалог колонок 75vw, seed superadmin flag

### v1.3.0 — Mobile UX & Admin (2026-04-26)
- FeedbackFAB плавающая кнопка на всех страницах (включая login/reset), только для авторизованных
- Landscape-адаптация: компактный топбар 40px, safe-area для iPhone notch, viewport-fit=cover
- AdminUsersPage: таблица в горизонтальный скролл на мобиле, hover через React state
- Human-readable URLs для досок (prefix вместо UUID)

### v1.2.0 — Roadmaps & Subtasks (2026-04-25)
- RoadmapView: Gantt с зумом неделя/месяц/квартал, раскрывашки подзадач, overdue-хвост
- SubtaskDrawer drill-down — открытие подзадачи в drawer без переходов
- История статусов: сегментные бары в задаче и в roadmap-тултипе
- Workspace Dashboard: быстрая навигация + активность
- Roadmaps Hub: все доски в виде дорожной карты

### v1.1.0 — Spaces & Polish (2026-04-20)
- Приватные воркспейсы и доски, настройки доски
- Упрощённая регистрация (Имя + Фамилия) + статистика пользователей (admin)
- API Keys в профиле
- Адаптивная вёрстка — 3-tier breakpoint (mobile/tablet/desktop)
- Паттерны безопасности из Pulsar: asyncHandler, rate-limit, logger

### v1.0.0 — UI Kit 2.0 (2026-04-11)
- Dual theme (dark/light), кастомный дизайн без Ant Design компонентов
- Базовые модули: auth, workspaces, boards, tasks, labels, comments, checklists, workflow
