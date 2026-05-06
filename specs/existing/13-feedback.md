---
id: 13-feedback
type: existing
status: approved
---

# Spec: Обратная связь (Feedback FAB)

## Intent
Встроенная кнопка отправки баг-репортов / фидбека, создающая GitHub Issues.

## Scope
- FeedbackFAB: плавающая кнопка в правом нижнем углу (все authenticated страницы)
- FeedbackModal: форма с полями type (bug/feedback/feature) + message
- POST /feedback → создание GitHub Issue с метаданными (browser, OS, URL, userAgent)
- Rate limiting: 3 запроса / 10 мин на пользователя (Redis)
- Markdown escaping заголовка и тела issue

## Out of Scope
- Просмотр своих обращений внутри FlowTask
- Статус обращения (открыт/закрыт)
- Вложения / скриншоты

## Constraints
- GITHUB_ISSUES_TOKEN env: если не задан → 503 с понятным сообщением
- Ошибка создания Issue в GitHub: логируется, пользователь видит ошибку
- Rate limit: 429 если превышен

## Acceptance Criteria
- [ ] POST /feedback (type: bug, message: "...") → 201, GitHub Issue создан
- [ ] POST /feedback 4 раза за 10 мин → 4й → 429
- [ ] GITHUB_ISSUES_TOKEN не задан → POST /feedback → 503 с описанием
- [ ] FeedbackModal: после отправки → success state, форма сбрасывается
