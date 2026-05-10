# Паттерн: Разработка фичи от дизайна до релиза

Полный цикл для нетривиальной задачи (>3 файлов или новая сущность/паттерн).

## Этапы

### 0. Impact analysis (обязательно перед любым изменением)

Перед тем как трогать существующий код:
```
gitnexus_impact({ target: "{символ}", direction: "upstream" })
```
Сообщить blast radius. Если HIGH или CRITICAL — предупредить и получить подтверждение.

---

### 1. Spec-first — `/design-doc`

**Когда:** задача затрагивает >3 файлов или вводит новую сущность/паттерн.

Создать два артефакта ДО кода:

**`docs/design/{slug}.md`** — архитектурное решение:
- Цель (одно предложение)
- Инвентаризация данных (все места чтения/записи)
- Карта компонентов (кто потребляет)
- Модель данных (Prisma changes)
- API контракт (эндпоинты и DTO shape)
- Стыки (какие существующие файлы менять)
- Риски (gitnexus_impact на ключевые символы)

**`specs/gaps/` или `specs/existing/`** — поведение:
- BDD Scenarios (Gherkin: happy path + edge cases + ошибки)
- SDD Contracts (TypeScript интерфейсы и API shape)
- Acceptance Criteria (проверяемые условия)

Не начинать реализацию без этих артефактов.

---

### 2. Модель данных

Если задача требует изменений в БД:
```
schema.prisma → миграция → prisma generate → перезапуск dev
```
- Nullable поля: `Type?` в Prisma = `.nullable().optional()` в Zod
- Enum: добавить в Prisma + Zod + проверить все места использования
- После любого изменения схемы — запустить `/audit-schemas`

---

### 3. API — `/new-api`

Порядок: **Zod DTO → OpenAPI регистрация → router → service → тест**

Никогда не создавать роут без:
- Zod DTO зарегистрированного через `registry.register()`
- OpenAPI пути в `shared/openapi/routes/{module}.ts`
- Supertest-теста (минимум: 201/200, 400, 401, 403, 404)

---

### 4. UI

Порядок: **API-клиент → компонент → интеграция**

- Обновить или создать функцию в `frontend/src/api/`
- Компонент в `frontend/src/components/` или страница в `frontend/src/pages/`
- Проверить тёмную и светлую тему
- Проверить мобильный breakpoint (mobile / tablet / desktop)

---

### 5. Три ревью — последовательно

После написания кода, до коммита:

**1. code-reviewer** — качество кода:
- TypeScript строгость, отсутствие `any`
- Паттерны проекта (asyncHandler, authHandler, validate middleware)
- Размер функций (<50 строк), размер файлов (<800 строк)
- Иммутабельность, обработка ошибок

**2. security-reviewer** — безопасность:
- RBAC: все эндпоинты защищены, проверка workspace isolation
- Валидация: все входные данные валидируются через Zod
- IDOR: нет прямого доступа по ID без проверки принадлежности к workspace
- Audit log: деструктивные операции логируются в AuditLog
- Нет hardcoded секретов, нет утечки PII в ответах

**3. UX/UI-reviewer** — пользовательский опыт:
- Состояния loading / empty / error обработаны в UI
- Feedback пользователю на успех и ошибку (toast/notification)
- Доступность (ARIA, keyboard navigation для критичных действий)
- Соответствие дизайн-системе (Ant Design 5 + CSS переменные проекта)

Исправить все находки перед переходом к следующему шагу.

---

### 6. `/preflight` → коммит

```bash
/preflight   # tsc + lint + rbac-check + prisma validate + tests + gitnexus
```
Только после зелёного preflight — коммит и push.

---

## Сокращённый цикл (мелкие задачи)

Для задач в 1-2 файлах без новых сущностей:
1. gitnexus_impact → code-reviewer → security-reviewer → /preflight → коммит
2. Spec и design-doc не обязательны, но добавить acceptance criteria в PR description
