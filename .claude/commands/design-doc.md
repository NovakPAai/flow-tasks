Создай design-doc и spec для задачи перед началом реализации. Аргументы: $ARGUMENTS

## Использование
```
/design-doc "Расширение RBAC до per-feature permissions"
/design-doc gap-22 "Настройки пространства"
```

## Контекст
Design-doc + spec — обязательные артефакты перед реализацией задачи с >3 файлами или новой сущностью/паттерном. Создаются ДО написания кода. Design-doc фиксирует архитектурные решения и живёт в `docs/design/`. Spec описывает поведение в BDD + контракты в SDD и живёт в `specs/`.

## Шаги

### 1. Изучи контекст
- Найди связанные файлы через `gitnexus_query({ query: "{тема}" })`
- Прочитай существующие specs в `specs/existing/` для понимания масштаба
- Если указан gap-номер — прочитай `specs/gaps/gap-{N}-*.md`

### 2. Создай design-doc

Файл: `docs/design/{slug}.md`

```markdown
# Design Doc: {Название}

**Дата:** {дата}
**Статус:** draft
**Spec:** [specs/{path}](../../specs/{path})

## Цель
Одно предложение: что пользователь/система получит в результате.

## Инвентаризация данных
ВСЕ места где затронутая сущность читается или пишется:
- `backend/src/modules/{module}/{file}.service.ts` — что делает
- `backend/src/modules/{module}/{file}.router.ts` — какие эндпоинты
- `frontend/src/api/{file}.ts` — какие вызовы
- `frontend/src/components/{Component}.tsx` — что рендерит

## Карта компонентов
Кто потребляет изменяемые данные (upstream от изменения).

## Модель данных
Prisma-изменения: новые модели, поля, enum-значения, миграции.

## API контракт
Новые или изменённые эндпоинты (метод, путь, DTO shape).

## Стыки
Какие существующие файлы нужно менять и почему.

## Риски и blast radius
Результат `gitnexus_impact()` на ключевые символы.
Что может неожиданно сломаться.

## Решения
Принятые архитектурные решения и их обоснование.
Альтернативы которые рассматривались и почему отклонены.
```

### 3. Создай spec

Для gap-задачи: `specs/gaps/gap-{N}-{slug}.md`
Для новой фичи без gap-номера: `specs/existing/{N}-{slug}.md` со статусом `draft`

```markdown
---
id: {slug}
type: gap-feat | gap-fix | existing
priority: P0 | P1 | P2 | P3
status: draft
design-doc: docs/design/{slug}.md
---

# Spec: {Название}

## Intent
{Одна фраза — ЧТО и ЗАЧЕМ}

## BDD Scenarios

\`\`\`gherkin
Feature: {Название}

  Background:
    Given {предусловие}

  Scenario: {Happy path — основной сценарий}
    Given {условие}
    When {действие}
    Then {результат}

  Scenario: {Edge case}
    Given {условие}
    When {действие}
    Then {результат}

  Scenario: {Негативный / ошибка}
    Given {условие}
    When {действие}
    Then {ожидаемая ошибка}
\`\`\`

## SDD Contracts

\`\`\`typescript
// Интерфейсы, DTO, API shape — минимально необходимое для реализации
// Пример:
// interface CreateLabelDto { name: string; color: string; workspaceId: string; }
// POST /api/workspaces/:wid/labels → LabelDto
// GET  /api/workspaces/:wid/labels → { items: LabelDto[]; total: number }
\`\`\`

## Scope
- {Что входит}

## Out of Scope
- {Что не входит}

## Constraints
- {Технические ограничения, RBAC-правила, существующие паттерны}

## Acceptance Criteria
- [ ] {Проверяемое условие}
- [ ] API: `{method} {path}` → `{ожидаемый ответ}`
- [ ] UI: {действие} → {результат}
```

### 4. Добавь перекрёстные ссылки
- В design-doc уже есть ссылка на spec (шаг 2)
- В spec frontmatter: `design-doc: docs/design/{slug}.md`
- Обнови `specs/README.md` — добавь новый spec в таблицу приоритетов
