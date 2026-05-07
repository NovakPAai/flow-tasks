---
id: <XX-slug>
type: existing | gap-fix | gap-feat
priority: P0 | P1 | P2 | P3
status: draft | approved | done
---

# Spec: <Название>

## Intent
<Одна фраза — ЧТО и ЗАЧЕМ>

## BDD Scenarios

```gherkin
Feature: <Название>

  Background:
    Given <предусловие>

  Scenario: <Happy path — основной сценарий>
    Given <условие>
    When <действие>
    Then <результат>

  Scenario: <Edge case>
    Given <условие>
    When <действие>
    Then <результат>

  Scenario: <Негативный сценарий / ошибка>
    Given <условие>
    When <действие>
    Then <ожидаемая ошибка или пустое состояние>
```

## SDD Contracts

```typescript
// Types, interfaces, DTO, API shape — минимально необходимое для реализации
// Пример:
// interface CreateTaskDto { title: string; boardId: string; }
// GET /resource/:id → ResourceDto
```

## Scope
- <Что входит>

## Out of Scope
- <Что НЕ входит>

## Constraints
- <Технические ограничения, RBAC, существующие паттерны>

## Acceptance Criteria
- [ ] <Проверяемое условие>
- [ ] API: `<method> <path>` → `<ожидаемый ответ>`
- [ ] UI: <действие> → <результат>
