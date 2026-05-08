---
id: gap-23-superadmin-email-badge
type: gap-fix
priority: P1
status: draft
source: ux-review-2026-05-08
pr: —
---

# Spec: Метка «Суперадмин» не отображается для SUPERADMIN_EMAIL аккаунта при isSuperadmin=false в БД

## Intent
`GET /api/admin/users` возвращает сырое значение `isSuperadmin` из БД. При этом
`getMe()` правильно вычисляет производное значение:

```ts
const isSuperadmin = user.isSuperadmin || user.email === config.SUPERADMIN_EMAIL;
```

Если у аккаунта `SUPERADMIN_EMAIL` (default: `novak.pavel@flowtask.dev`) флаг
в БД равен `false` — в таблице AdminUsersPage бейдж «Суперадмин» не показывается,
хотя пользователь де-факто является суперадминистратором.

Симптом: у novak.pavel@flowtask.dev нет бейджа, хотя у Дмитрия Пузырёва
(которому был выдан флаг через UI) бейдж есть.

## Root Cause
`admin.service.ts` — `listUsers()` маппит сырой `isSuperadmin` без применения
`SUPERADMIN_EMAIL` override.

## BDD Scenarios

```gherkin
Feature: Метка суперадмина в списке пользователей

  Background:
    Given SUPERADMIN_EMAIL=novak.pavel@flowtask.dev

  Scenario: SUPERADMIN_EMAIL аккаунт с isSuperadmin=false в БД — видит метку
    Given в БД: novak.pavel@flowtask.dev имеет isSuperadmin=false
    When GET /api/admin/users (запрос суперадмином)
    Then в ответе объект с email=novak.pavel@flowtask.dev имеет isSuperadmin=true

  Scenario: SUPERADMIN_EMAIL аккаунт с isSuperadmin=true в БД — видит метку
    Given в БД: novak.pavel@flowtask.dev имеет isSuperadmin=true
    When GET /api/admin/users
    Then в ответе объект с email=novak.pavel@flowtask.dev имеет isSuperadmin=true

  Scenario: Обычный пользователь с isSuperadmin=false — метки нет
    Given в БД: user@flowtask.dev имеет isSuperadmin=false
    And user@flowtask.dev != SUPERADMIN_EMAIL
    When GET /api/admin/users
    Then в ответе объект с email=user@flowtask.dev имеет isSuperadmin=false

  Scenario: Кнопка «Снять» недоступна для собственного аккаунта суперадмина
    Given суперадмин novak.pavel@flowtask.dev просматривает AdminUsersPage
    Then для своей строки кнопка «Снять»/«Назначить» не отображается
    # (usingу.id !== user?.id — уже реализовано, тест на регрессию)
```

## SDD Contracts

```typescript
// backend/src/modules/admin/admin.service.ts

export async function listUsers() {
  const raw = await prisma.user.findMany({ ... }); // без изменений

  const superadminEmail = config.SUPERADMIN_EMAIL;

  return raw.map(({ createdWorkspaces, _count, ...u }) => ({
    ...u,
    // Применяем тот же override, что и в getMe()
    isSuperadmin: u.isSuperadmin || u.email === superadminEmail,
    stats: {
      workspaces: _count.createdWorkspaces,
      boards:     createdWorkspaces.reduce((s, ws) => s + ws._count.boards, 0),
      tasks:      _count.createdTasks,
      members:    createdWorkspaces.reduce((s, ws) => s + ws._count.members, 0),
    },
  }));
}
```

## Scope
- `backend/src/modules/admin/admin.service.ts` — `listUsers()`, одна строка изменений

## Out of Scope
- Синхронизация флага в БД (seed/migration) — отдельная операция при необходимости
- Логика `setUserSuperadmin()` — она не должна позволять снимать флаг с `SUPERADMIN_EMAIL`
  (отдельный гэп если нужен)

## Acceptance Criteria
- [ ] `GET /api/admin/users` возвращает `isSuperadmin: true` для аккаунта с email = `SUPERADMIN_EMAIL`, даже если DB-флаг `false`
- [ ] Для всех остальных пользователей поведение не изменилось
- [ ] Тест: `admin.test.ts` — проверить ответ для `SUPERADMIN_EMAIL` аккаунта
