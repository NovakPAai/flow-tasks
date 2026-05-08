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

---

## Обязательный процесс разработки

Эти правила применяются автоматически — не нужно напоминать.

### Перед изменением любого существующего символа
ВСЕГДА запускать `gitnexus_impact({ target: "symbolName", direction: "upstream" })` и сообщать blast radius. При HIGH или CRITICAL риске — предупредить и ждать подтверждения перед правками.

### Перед реализацией нетривиальной задачи (>3 файлов или новая сущность)
ВСЕГДА создавать два артефакта ДО кода:
1. Design-doc в `docs/design/{slug}.md` — архитектурные решения
2. Spec в `specs/` — BDD сценарии + SDD контракты

Не начинать реализацию без этих артефактов. Использовать команду `design-doc` из `.claude/commands/design-doc.md`.

### После любого изменения Prisma схемы или DTO
ВСЕГДА проверять соответствие nullable/optional по всем затронутым схемам. Использовать команду `audit-schemas` из `.claude/commands/audit-schemas.md`.

### При создании нового API эндпоинта
ВСЕГДА следовать порядку: Zod DTO (через `registry.register()`) → OpenAPI регистрация → router → service → тест. Никогда не создавать роут без DTO и без OpenAPI записи. Использовать команду `new-api` из `.claude/commands/new-api.md`.

### После написания кода — три ревью последовательно
1. **code-reviewer** — качество: TypeScript строгость, паттерны проекта, размер функций, иммутабельность
2. **security-reviewer** — безопасность: RBAC, IDOR, валидация, audit log, нет утечки PII
3. **UX/UI-reviewer** — опыт: loading/empty/error состояния, feedback, доступность, соответствие дизайн-системе

### Перед каждым push
ВСЕГДА выполнять preflight из `.claude/commands/preflight.md`:
`tsc --noEmit` + `lint` + `check:rbac` + `prisma validate` + тесты + `gitnexus_detect_changes`

### Справочники
- Полный цикл разработки фичи: `docs/claude-patterns/feature-development.md`
- Конвенции кода и API: `docs/claude-patterns/dev-conventions.md`
