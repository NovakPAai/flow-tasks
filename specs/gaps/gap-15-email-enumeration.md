---
id: gap-15-email-enumeration
type: gap-fix
priority: P2
status: done
source: pentest-2026-05-07
---

# Spec: Email enumeration через POST /api/auth/register

## Intent
Эндпоинт регистрации возвращает три разных ответа, по которым атакующий определяет
статус email: зарегистрирован / pending / свободен. Унифицировать ответы в один.

## Root Cause
`auth.service.ts:56-60` — явные `AppError(409, ...)` с уникальным текстом:
- `"Email уже зарегистрирован"` — email есть в `users`
- `"Заявка с этим email уже ожидает рассмотрения"` — email в `registrationRequests` с PENDING
- `"Заявка на регистрацию отправлена..."` — email свободен

Атакующий перебирает email и различает все три состояния.

> Примечание: `POST /api/auth/forgot-password` уже реализован правильно — возвращает
> один и тот же ответ для существующего и несуществующего email.

## BDD Scenarios

```gherkin
Feature: POST /api/auth/register не раскрывает статус email

  Background:
    Given существует пользователь "alice@flowtask.dev"
    And есть PENDING заявка на "pending@flowtask.dev"
    And "new@flowtask.dev" не зарегистрирован

  Scenario: Повторная регистрация существующего email — ответ неотличим
    When POST /api/auth/register {"email":"alice@flowtask.dev","password":"Pass1!","name":"X"}
    Then статус 200
    And тело ответа содержит {"message":"..."}
    And текст совпадает с ответом для несуществующего email

  Scenario: Повторная регистрация PENDING email — ответ неотличим
    When POST /api/auth/register {"email":"pending@flowtask.dev","password":"Pass1!","name":"X"}
    Then статус 200
    And текст ответа идентичен ответу для нового email

  Scenario: Регистрация нового email — стандартный ответ
    When POST /api/auth/register {"email":"new@flowtask.dev","password":"Pass1!","name":"New"}
    Then статус 200
    And тело ответа содержит ключ "message"

  Scenario: Три запроса с разным статусом email возвращают одинаковый ответ
    When POST /api/auth/register для "alice@flowtask.dev"  → response_A
    And  POST /api/auth/register для "pending@flowtask.dev" → response_B
    And  POST /api/auth/register для "new@flowtask.dev"     → response_C
    Then response_A.body.message == response_B.body.message == response_C.body.message
```

## SDD Contracts

```typescript
// auth.service.ts — register()

const REGISTER_MSG = 'Если email доступен, заявка отправлена. Ожидайте подтверждения администратора.';

export async function register(dto: RegisterDto) {
  const localPart = dto.email.trim().toLowerCase().split('@')[0];
  const email = `${localPart}@${config.REGISTRATION_DOMAIN}`;

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.registrationRequest.findUnique({ where: { email } }),
  ]);

  // Silent exit — не раскрываем существование email
  if (existingUser || (existingRequest?.status === 'PENDING')) {
    return { message: REGISTER_MSG };
  }

  // ... создание заявки
  return { message: REGISTER_MSG };
}
```

## Scope
- `auth.service.ts` — убрать `AppError(409)` из `register()`, вернуть единый `message`
- `auth.test.ts` — обновить тест с `expect(409)` → `expect(200)` + проверка одинакового message
- `ib-authentication.test.ts` — обновить сценарий уникальности

## Out of Scope
- Изменение поведения `/forgot-password` (уже корректно)
- Изменение ответов `/login` (разные ошибки там допустимы после аутентификации)

## Constraints
- Поведение повторной rejected-заявки (update status → PENDING снова) остаётся без изменений
- HTTP-статус меняется с 409 → 200 для случаев duplicate/pending

## Acceptance Criteria
- [ ] `POST /api/auth/register` с существующим email → 200, тот же message
- [ ] `POST /api/auth/register` с PENDING email → 200, тот же message
- [ ] `POST /api/auth/register` с новым email → 200, тот же message
- [ ] Тест проверяет идентичность трёх ответов
- [ ] Тест `'rejects duplicate email with 409'` обновлён
