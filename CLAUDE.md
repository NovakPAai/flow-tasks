# FlowTask — Standalone Task Tracker

## Что это

FlowTask — легковесный таск-трекер (аналог YouGile/Trello) для команд.
Standalone сервис, бренд Flow Universe, но без связи с PM-системой Flow Universe.

## Стек

| Слой | Технология |
|------|-----------|
| Language | TypeScript 5.x |
| Frontend | React 18 + Vite 6 + Ant Design 5 |
| State | Zustand |
| Backend | Node.js 20 LTS + Express 4 |
| ORM | Prisma 6 |
| Validation | Zod |
| Database | PostgreSQL 16 (port 5434) |
| Cache | Redis 7 (port 6380) |
| Auth | JWT + refresh tokens |

## Запуск

```bash
make setup   # Docker + npm install + Prisma migrate + seed
make dev     # backend :3101 + frontend :5174
```

**Аккаунты:** `admin@flowtask.dev` / `user@flowtask.dev`, пароль: `Password1`

## Архитектура

Модульный монолит. Backend: `modules/` (auth, workspaces, boards, tasks, workflows, labels, comments, history, onboarding).
Каждый модуль: router → service → Prisma.

## Фазы

| Фаза | Содержание | Статус |
|------|-----------|--------|
| 0a | Paper дизайн (27 артбордов) | DONE |
| 0b | Bootstrap: scaffold, auth, Docker, Prisma | DONE |
| 1 | Workspaces + Workflows | — |
| 2 | Boards + Tasks + Kanban DnD | — |
| 3 | List View + Calendar + My Tasks | — |
| 4 | Labels + Comments + Checklists + FilterBar | — |
| 5 | Polish + Seed + Deploy | — |

## Ключевые решения

- **Auth:** JWT (копия FU) + AuthProvider абстракция (env AUTH_MODE=local|keycloak)
- **RBAC:** Owner / Member / Viewer (per workspace)
- **Задачи:** Materialized path для unlimited subtask nesting
- **Workflow:** 3 режима — FORWARD_ONLY / BIDIRECTIONAL / CUSTOM
- **Issue keys:** BOARD_PREFIX-N (DEV-1, OPS-42)
- **Навигация:** Topbar 56px

## Paper дизайн

27 артбордов (Dark + Light). Палитра Dark: #03050F bg, #0F1320 cards, #4F6EF7 accent.
