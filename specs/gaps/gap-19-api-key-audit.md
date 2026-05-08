---
id: gap-19-api-key-audit
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Использование API-ключа не логировалось в AuditLog

## Intent
При аутентификации через Bearer-токен формата `ft_*` (API-ключ) событие `auth.apikey.use`
не записывалось. Инциденты с утечкой ключей нельзя было ретроспективно расследовать.

## Root Cause
`backend/src/shared/middleware/auth.ts` — ветка API-ключевой аутентификации проверяла
ключ и устанавливала `req.user`, но не вызывала `auditLog()`.

## BDD Scenarios

```gherkin
Feature: Аудит использования API-ключа (Req §1.3.4)

  Scenario: Валидный API-ключ создаёт AuditLog с action=auth.apikey.use
    Given пользователь имеет активный API-ключ key_abc
    When GET /api/my-tasks с заголовком Authorization: Bearer key_abc
    Then статус 200
    And AuditLog содержит:
      | field      | value            |
      | action     | auth.apikey.use  |
      | actorId    | <user_id>        |
      | result     | SUCCESS          |
      | meta.keyPrefix | первые 10 символов ключа |
      | meta.ip    | <request_ip>     |

  Scenario: Невалидный API-ключ не создаёт AuditLog (возвращает 401)
    When GET /api/my-tasks с Authorization: Bearer invalid_key
    Then статус 401
    And AuditLog с action=auth.apikey.use НЕ создаётся
```

## SDD Contracts

```typescript
// auth.ts middleware — после успешной проверки API-ключа
import { auditLog } from '../utils/audit-logger.js';

// в ветке успешной аутентификации по API-ключу:
void auditLog({
  actorId: apiKey.user.id,
  action: 'auth.apikey.use',
  result: 'SUCCESS',
  ip: (req.headers['x-real-ip'] as string) ?? req.ip ?? 'unknown',
  userAgent: (req.headers['user-agent'] as string) ?? 'unknown',
  meta: { keyPrefix: token.slice(0, 10) },
});
next();
```

## Scope
- `shared/middleware/auth.ts` — добавить `void auditLog(...)` после успешной проверки API-ключа

## Out of Scope
- Логирование неудачных попыток (отсутствие записи в apiKeys — 401 без аудита)
- Лимиты на количество запросов через API-ключ (Rate limiting на apiKeys — отдельный gap)

## Acceptance Criteria
- [x] Успешный запрос через API-ключ создаёт AuditLog с `action=auth.apikey.use`
- [x] `actorId` содержит id владельца ключа
- [x] `meta.keyPrefix` содержит первые 10 символов ключа (без хранения full key)
- [x] SIEM-поля присутствуют (через `auditLog()` из shared utility)
