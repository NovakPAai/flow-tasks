---
id: 11-admin
type: existing
status: approved
---

# Spec: Панель администратора

## Intent
Управление пользователями и заявками на регистрацию (только Superadmin).

## Scope
- GET /admin/users: список всех пользователей со статистикой (loginCount, lastLoginAt, isSuperadmin)
- POST /admin/users: создание пользователя с автогенерированным паролем
- PATCH /admin/users/:id: установка флага isSuperadmin
- GET /admin/registration-requests: заявки на регистрацию (PENDING/APPROVED/REJECTED)
- PATCH /admin/registration-requests/:id: approve / reject
- GET /admin/audit-log: глобальный лог событий (limit 100-500 без пагинации)
- AdminUsersPage: таблица пользователей + вкладка заявок

## Out of Scope
- Удаление пользователей (нет endpoint)
- Блокировка пользователей (временная деактивация без удаления)
- Редактирование профиля пользователя от лица админа

## Constraints
- Все /admin/* → только isSuperadmin (проверка через requireSuperadmin middleware)
- SUPERADMIN_EMAIL из конфига всегда superadmin, даже без флага в БД (возможный десинк)
- Пагинация audit log: clamp(limit, 100, 500) без offset — см. gap-05

## Acceptance Criteria
- [ ] GET /admin/users (не superadmin) → 403
- [ ] POST /admin/users → 201, пароль возвращается в ответе один раз
- [ ] PATCH /admin/registration-requests/:id (status: APPROVED) → пользователь создаётся в БД
- [ ] PATCH /admin/registration-requests/:id (status: REJECTED) → пользователь НЕ создаётся
- [ ] AdminUsersPage: список пользователей → кнопка Make Superadmin → PATCH /admin/users/:id
