---
id: gap-16-account-disabled
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Блокировка аккаунта администратором не препятствует входу

## Intent
Флаг `isActive=false` в модели `User` не проверялся при аутентификации.
Заблокированный пользователь мог войти в систему и получить refresh-токен.

## Root Cause
`auth.service.ts` — метод `login()` не проверял `user.isActive` перед сравнением пароля.
Поле `isActive` присутствовало в схеме Prisma, но игнорировалось в бизнес-логике.

Эндпоинт `PATCH /api/admin/users/:id` принимал только `isSuperadmin`;
`isActive` не передавался в `admin.service.ts`.

## BDD Scenarios

```gherkin
Feature: Блокировка пользователя администратором

  Scenario: Заблокированный пользователь не может войти
    Given пользователь "bob@corp.ru" существует с isActive=false
    When POST /api/auth/login {"email":"bob@corp.ru","password":"CorrectPass1"}
    Then статус 403
    And тело ответа содержит {"code":"ACCOUNT_DISABLED"}

  Scenario: Блокировка фиксируется в AuditLog
    Given admin@corp.ru аутентифицирован (superadmin)
    When PATCH /api/admin/users/:id {"isActive":false}
    Then статус 200
    And AuditLog содержит запись:
      | field    | value                 |
      | action   | admin.user.deactivate |
      | targetId | <blocked_user_id>     |
      | actorId  | <admin_id>            |
      | result   | SUCCESS               |
```

## SDD Contracts

```typescript
// auth.service.ts — login(), после нахождения user, перед comparePassword
if (user.isActive === false) {
  void auditLog({ actorId: user.id, action: 'auth.login', result: 'FAIL',
    ip: clientMeta?.ip, meta: { reason: 'ACCOUNT_DISABLED' } });
  throw new AppError(403, 'Account disabled', { code: 'ACCOUNT_DISABLED' });
}

// admin.service.ts — setUserActive()
export async function setUserActive(actorId: string, targetId: string, isActive: boolean) {
  await prisma.user.update({ where: { id: targetId }, data: { isActive } });
  void auditLog({
    actorId, action: isActive ? 'admin.user.activate' : 'admin.user.deactivate',
    targetId, result: 'SUCCESS', meta: { isActive },
  });
}

// admin.router.ts — PATCH /users/:id
if (dto.isActive !== undefined) {
  return res.json(await adminService.setUserActive(req.user!.userId, req.params.id, dto.isActive));
}
```

## Scope
- `auth.service.ts` — добавить проверку `isActive` в `login()`
- `admin.service.ts` — добавить `setUserActive()`
- `admin.router.ts` — диспетчеризация на `setUserActive` при `isActive` в теле
- `admin.dto.ts` — `updateUserDto` принимает `isActive?: boolean`

## Out of Scope
- Разблокировка через email (только через admin panel)
- Автоматическая разблокировка по времени

## Acceptance Criteria
- [x] `login()` проверяет `isActive === false` до сравнения пароля
- [x] Ответ 403 + `{"code":"ACCOUNT_DISABLED"}` для заблокированных
- [x] `PATCH /api/admin/users/:id {"isActive":false}` обновляет поле
- [x] AuditLog с `action=admin.user.deactivate` и `targetId=<userId>`
