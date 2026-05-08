---
id: gap-21-validation-error-audit
type: gap-fix
priority: P2
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Ошибки валидации входных данных не логировались

## Intent
Невалидные запросы (например, `email: "not-an-email"`, `password: ""`) 
молча отклонялись Zod-валидацией с ответом 400, но не создавали AuditLog-запись.
SIEM не видел попыток отправки malformed-запросов — потенциальный fuzzing или
reconnaissance оставался незамеченным.

## Root Cause
`validate.ts` middleware — обработчик `ZodError` возвращал 400-ответ, но не вызывал `auditLog()`.

## BDD Scenarios

```gherkin
Feature: Аудит ошибок валидации (Req логирование §2.6)

  Scenario: Невалидное тело /login создаёт system.validation.error
    When POST /api/auth/login {"email":"not-an-email","password":""}
    Then статус 400
    And AuditLog содержит:
      | field       | value                    |
      | action      | system.validation.error  |
      | result      | FAIL                     |
      | meta.path   | /api/auth/login          |
      | meta.errors | [{"field":"email",...}]  |

  Scenario: Корректный запрос не создаёт validation.error
    When POST /api/auth/login {"email":"valid@corp.ru","password":"Password1"}
    Then статус 200 или 401
    And AuditLog с action=system.validation.error НЕ создаётся
```

## SDD Contracts

```typescript
// validate.ts middleware — в обработчике ZodError
import { auditLog } from '../utils/audit-logger.js';

if (err instanceof ZodError) {
  void auditLog({
    actorId: null,
    action: 'system.validation.error',
    result: 'FAIL',
    ip: req.ip ?? undefined,
    meta: {
      path: req.path,
      errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    },
  });
  return res.status(400).json({ errors: err.errors });
}
```

## Scope
- `shared/middleware/validate.ts` — добавить `void auditLog(...)` в обработчик `ZodError`

## Out of Scope
- Хранение тела невалидного запроса (ПДн / секреты — не логировать)
- Блокировка IP после N ошибок валидации

## Acceptance Criteria
- [x] Невалидное тело `POST /api/auth/login` создаёт AuditLog с `action=system.validation.error`
- [x] `meta.path` содержит URL эндпоинта
- [x] `meta.errors` содержит список ошибок Zod
- [x] `actorId` равен `null` (пользователь не аутентифицирован)
