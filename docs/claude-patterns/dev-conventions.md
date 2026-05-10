# Паттерн: Конвенции разработки FlowTask

Единые правила для всего проекта. Эти конвенции применяются автоматически — не нужно напоминать.

## TypeScript

### Типизация
- **Никогда `any`**: объекты → `Record<string, unknown>`, ошибки → `unknown` с `instanceof` guard
- Неиспользуемые переменные — удалять. В деструктуризации массива — пропуск через `,`
- Enum из Prisma — использовать сгенерированные типы, не дублировать вручную
- Возвращаемые типы функций сервисов — всегда явные (`Promise<TaskDto>`, не `Promise<any>`)

### ESLint
- `eslint-disable` только блочный `/* eslint-disable rule */`, не строчный `// eslint-disable-line`
- Исключения документировать комментарием — почему отключено

---

## Git

### Коммиты
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `refactor:` — рефакторинг без изменения поведения
- `chore:` — зависимости, конфиг, CI
- `docs:` — документация
- `test:` — тесты

### Ветки
- `claude/jack-{slug}` — jackrescuer-gif через Claude Code
- `claude/alex-{slug}` — St1tcher86 через Claude Code
- `cursor/jack-{slug}` — jackrescuer-gif через Cursor
- `cursor/alex-{slug}` — St1tcher86 через Cursor

---

## API

### Обработка ошибок
```typescript
// ВСЕГДА asyncHandler или authHandler — никогда голый async
router.get('/', asyncHandler(async (req, res) => { ... }));
router.post('/', validate(dto), authHandler(async (req, res) => { ... }));

// Структура ошибки — единый формат
res.status(400).json({ error: 'Сообщение', details: [...] });
res.status(404).json({ error: 'Не найдено' });
res.status(403).json({ error: 'Нет прав' });
```

### Валидация
- Все входные данные через `validate(dto)` middleware — никогда вручную в сервисе
- Источник: `body` (default), `params`, `query`
- DTO файл: `{module}.dto.ts` — рядом с роутером

### RBAC
- Каждый роут защищён `authenticate` + проверкой принадлежности к workspace
- Superadmin операции: `requireSuperadmin` middleware
- Workspace isolation: проверять `workspaceId` через `WorkspaceMember` перед любым действием над данными

### OpenAPI
- Каждый новый DTO — через `registry.register()`, не голый `z.object()`
- Каждый новый путь — зарегистрировать в `shared/openapi/routes/{module}.ts`
- `/api/docs` — живая документация, обновляется автоматически

---

## Prisma

### Миграции
- После любого изменения `schema.prisma` — ОБЯЗАТЕЛЬНО создать миграцию (`prisma migrate dev`)
- Никогда `prisma db push` в разработке — только через миграции
- Миграции только аддитивные: добавлять поля/таблицы можно, переименовывать/удалять — с backfill

### Nullable
- Поле `Type?` в Prisma → `.nullable().optional()` в Zod (обязательно оба)
- После изменения схемы — запустить `/audit-schemas` для проверки всех DTO

### Queries
- `select` вместо полного объекта там где возможно — не тащить лишние поля
- N+1 — использовать `include` или отдельный batch-запрос

---

## BDD / SDD

### Когда писать spec
Нетривиальная задача (>3 файлов или новая сущность) → сначала spec в `specs/`, потом код.

### Формат BDD
Gherkin в секции `## BDD Scenarios` файла spec. Три обязательных сценария:
- Happy path (основной поток)
- Edge case (граничное условие)
- Негативный (ошибка или недостаточно прав)

### Формат SDD
TypeScript интерфейсы + API shape в секции `## SDD Contracts`. Минимально необходимое для реализации — не весь DTO, только контракт.

### Ссылки
Design-doc (архитектура) → ссылка на spec (поведение), и обратно.
Обновить `specs/README.md` при добавлении нового spec.

---

## Безопасность

- Никаких секретов в коде — только через переменные окружения
- PII (email, имя) — не логировать в plaintext, только с маскировкой
- Деструктивные операции (delete, bulk) — логировать в `AuditLog`
- Rate limiting — на всех публичных и потенциально дорогих эндпоинтах
