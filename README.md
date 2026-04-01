# FlowTask

Лёгкий таск-трекер — аналог YouGile/Trello с Kanban-досками, рабочими пространствами и workflow-переходами.

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Node.js 20 · Express 4 · TypeScript 5 |
| ORM | Prisma 6 · PostgreSQL 16 |
| Cache | Redis 7 |
| Frontend | React 18 · Vite 6 · Ant Design 5 · Zustand |
| DnD | @hello-pangea/dnd |
| Auth | JWT (15m access) + Refresh tokens (7d) |

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

## API Endpoints (краткий обзор)

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
POST   /api/workspaces/:id/invite      # пригласить по email
PATCH  /api/workspaces/:id/members/:userId
DELETE /api/workspaces/:id/members/:userId

GET    /api/boards/:bid/tasks
POST   /api/boards/:bid/tasks
PATCH  /api/boards/:bid/tasks/reorder

GET    /api/tasks/:id
PATCH  /api/tasks/:id
PATCH  /api/tasks/:id/move             # смена статуса (workflow)
DELETE /api/tasks/:id
GET    /api/tasks/:id/history

GET    /api/workspaces/:wid/labels
POST   /api/workspaces/:wid/labels
POST   /api/tasks/:tid/labels/:labelId
DELETE /api/tasks/:tid/labels/:labelId

GET    /api/tasks/:tid/comments
POST   /api/tasks/:tid/comments
PATCH  /api/comments/:id
DELETE /api/comments/:id

GET    /api/my-tasks                   # задачи во всех пространствах
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

Рекомендуется поставить nginx в качестве reverse-proxy:
- `http://localhost:3101` → `/api`
- `http://localhost:5174` → `/` (или собрать фронт `npm run build` и раздавать static)

## Структура проекта

```
flow-tasks/
├── backend/
│   └── src/
│       ├── modules/          # auth, workspaces, workflows, boards, tasks, labels, comments, checklists
│       ├── shared/           # middleware, utils, types
│       └── prisma/           # schema.prisma, migrations, seed.ts
├── frontend/
│   └── src/
│       ├── api/              # axios клиент + типизированные вызовы
│       ├── components/       # AppLayout, TaskCard, TaskDrawer, FilterBar, ...
│       ├── pages/            # WorkspacesPage, BoardPage, MyTasksPage, ...
│       ├── store/            # auth.store, workspace.store (Zustand)
│       └── types/            # TypeScript типы
├── docker-compose.yml
├── Makefile
└── README.md
```
