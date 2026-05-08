---
id: gap-14-rate-limit-ip-bypass
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
---

# Spec: Обход IP rate-limit через X-Forwarded-For на /login

## Intent
Атакующий обходит IP-based rate-limit на POST /api/auth/login, меняя X-Forwarded-For
на каждый запрос. Добавить email-based ключ для rate-limit на auth-эндпоинтах.

## Root Cause
`app.ts:25` — `trust proxy 1` → `req.ip` берётся из `X-Forwarded-For`.
`rate-limit.ts:47` — `defaultKey()` использует `req.ip`.
`auth.router.ts` — rate-limit middleware НЕ применялся к `/login`, `/register`, `/forgot-password`.

Brute-force защита в `auth.service.ts` ключируется по email (Redis), но
middleware-уровень rate-limit (IP-based) можно было обойти.

## BDD Scenarios

```gherkin
Feature: Rate-limit на auth-эндпоинтах ключируется по email

  Background:
    Given система Flow Tasks запущена
    And существует пользователь "victim@flowtask.dev"

  Scenario: Брутфорс с одного IP блокируется
    Given атакующий с IP 1.2.3.4
    When выполнено 10 POST /api/auth/login с неверным паролем
    Then 11-й запрос возвращает 429 Too Many Requests

  Scenario: Ротация X-Forwarded-For не помогает обойти блокировку
    Given атакующий меняет X-Forwarded-For на каждый запрос
    When выполнено 10 POST /api/auth/login {"email":"victim@flowtask.dev","password":"wrong"}
         с заголовком X-Forwarded-For: 10.0.0.N (N=1..10)
    Then 11-й запрос с X-Forwarded-For: 10.0.0.11 возвращает 429
    And тело ответа содержит {"error":"Too many requests"}

  Scenario: Rate-limit применяется к /register
    When выполнено 10 POST /api/auth/register {"email":"new@flowtask.dev",...}
    Then 11-й запрос возвращает 429

  Scenario: Rate-limit применяется к /forgot-password
    When выполнено 10 POST /api/auth/forgot-password {"email":"victim@flowtask.dev"}
    Then 11-й запрос возвращает 429
```

## SDD Contracts

```typescript
// auth.router.ts — добавить middleware на три эндпоинта
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';

// Ключ: нормализованный email из тела (или IP как fallback).
// Смена X-Forwarded-For не помогает, т.к. ключ не зависит от IP.
const authEmailKey = (req: Request): string =>
  (req.body?.email as string | undefined)?.trim().toLowerCase()
  ?? req.ip
  ?? 'anonymous';

const authLimit = rateLimit({ ...RATE_LIMITS.auth, keyFn: authEmailKey });

router.post('/login',          authLimit, validate(loginDto),          ...)
router.post('/register',       authLimit, validate(registerDto),        ...)
router.post('/forgot-password', authLimit, validate(forgotPasswordDto), ...)
```

## Scope
- Добавить `authLimit` middleware в `auth.router.ts` на `/login`, `/register`, `/forgot-password`
- `keyFn` использует email из `req.body` (нормализованный)

## Out of Scope
- Изменение порогов лимитов (10 req/min остаётся)
- Изменение логики fallback in-memory store

## Constraints
- `express.json()` выполняется в `app.ts` до роутера → `req.body` доступен в keyFn
- `validate(dto)` запускается ПОСЛЕ rate-limit, порядок: `authLimit → validate → handler`
- В тестовой среде Redis может быть недоступен → падение на in-memory fallback

## Acceptance Criteria
- [ ] `POST /api/auth/login` с email-ключом: 11-й запрос → 429 вне зависимости от IP
- [ ] `POST /api/auth/register` — аналогично
- [ ] `POST /api/auth/forgot-password` — аналогично
- [ ] Существующие happy-path тесты проходят
- [ ] Тест: 11 запросов с разными X-Forwarded-For на один email → 429
