---
id: 01-auth
type: existing
status: approved
---

# Spec: Аутентификация и управление сессиями

## Intent
Безопасный вход пользователей через email/пароль или SSO с автообновлением сессии.

## Scope
- Регистрация через заявку (RegistrationRequest → Admin approve)
- Вход: email + пароль → access token (1h) + refresh token (7d, HttpOnly cookie)
- Refresh: ротация refresh token (one-use), LRU eviction (MAX_SESSIONS per user)
- Logout: инвалидация refresh token + Redis session
- Профиль: GET /auth/me, PATCH /auth/me (name, email)
- Сброс пароля: forgot-password (email) → reset-password (token, 1h TTL)
- SSO: OIDC-flow (Keycloak / Avanpost), опциональный SSO-only режим
- Brute-force protection: 5 попыток / 15 мин (Redis)
- Idle timeout: 30 мин бездействия → logout (фронт, useIdleTimeout)
- Проактивный refresh: если токен истекает через <5 мин → refresh до запроса

## Out of Scope
- 2FA / TOTP
- OAuth (GitHub, Google)
- Приглашения по ссылке без email

## Constraints
- Access token только в памяти (never localStorage)
- Refresh token только HttpOnly cookie, path=/
- Пароль хранится как bcrypt hash
- SUPERADMIN_EMAIL в конфиге всегда superadmin, даже без флага в БД
- Домен регистрации фиксирован: REGISTRATION_DOMAIN env

## Acceptance Criteria
- [ ] POST /auth/login → 200 + accessToken + set-cookie refreshToken
- [ ] POST /auth/refresh → новый accessToken, старый refresh невалиден
- [ ] 5 неверных попыток → 429 на 15 мин
- [ ] Неактивность 30 мин → редирект на /login с `{ timedOut: true }`
- [ ] Возврат на вкладку после >5 мин → token + user обновлены автоматически
- [ ] SSO-only пользователь → POST /auth/login → 403
