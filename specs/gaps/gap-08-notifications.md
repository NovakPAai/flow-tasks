---
id: gap-08-notifications
type: gap-feat
priority: P3
status: draft
---

# Spec: Уведомления (In-app + Email)

## Intent
Уведомлять участников при назначении задачи, добавлении комментария и упоминании.

## Scope

### Триггеры
- Задача назначена на меня → уведомление assignee
- Кто-то прокомментировал задачу, назначенную на меня → уведомление assignee
- Кто-то прокомментировал задачу, которую я создал → уведомление creator
- Меня добавили в воркспейс → уведомление нового участника

### In-app уведомления
- Иконка колокольчика в Topbar с бейджем (unread count)
- Дропдаун: список уведомлений (тип, текст, ссылка на задачу, время)
- Отметить как прочитанное: по одному или «Отметить все»
- GET /notifications (unread first, limit 50)
- PATCH /notifications/:id/read
- PATCH /notifications/read-all

### Email уведомления
- Шаблон: HTML email (название задачи, комментарий/изменение, кнопка «Открыть»)
- Отправляется через SMTP (уже настроен для password reset)
- Opt-out: настройка профиля "Email notifications: on/off"

## Out of Scope
- Push уведомления (browser/mobile)
- Упоминания (@user) в комментариях
- Дайджест (еженедельный email)
- WebSocket real-time доставка in-app

## Constraints
- Email отправляется асинхронно (не блокирует API response)
- Уведомления не отправляются самому себе (creator == actor)
- Если SMTP не настроен → email уведомления пропускаются, in-app работают

## Acceptance Criteria
- [ ] Назначение задачи → assignee видит бейдж +1 в Topbar
- [ ] GET /notifications → список с type, message, taskId, readAt
- [ ] PATCH /notifications/read-all → все unread → read
- [ ] Email при назначении → отправлен assignee (не себе)
- [ ] Профиль: email notifications off → email не отправляется, in-app остаётся
