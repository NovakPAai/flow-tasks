---
id: 12-integrations
type: existing
status: approved
---

# Spec: API-ключи и интеграции

## Intent
Программный доступ к FlowTask через API-ключи; интеграция с Pulsar (внешняя система).

## Scope

### API Keys
- GET /integrations/api-keys: список ключей пользователя (key замаскирован, только prefix)
- POST /integrations/api-keys: создание ключа (возвращает raw key один раз)
- DELETE /integrations/api-keys/:id: отзыв ключа
- Auth middleware: префикс `ft_` + 64 hex символа → проверка по SHA-256 хешу
- lastUsedAt: debounce 1 мин, не обновляется на каждый запрос

### Pulsar Integration
- GET /integrations/workspaces: список воркспейсов для Pulsar
- GET /integrations/workspaces/:wid/boards: список досок
- POST /integrations/tasks/:taskId/pulsar-label: привязка Pulsar-метки к задаче

## Out of Scope
- Webhooks (outbound events при изменении задач)
- OAuth apps / scopes для API-ключей
- Rate limiting на API-ключи

## Constraints
- API-ключ хранится только как SHA-256 hash (raw key не восстанавливается)
- lastUsedAt обновляется не чаще 1 раза в минуту на ключ
- Pulsar интеграция предполагает внешнюю систему, валидации Pulsar-запросов нет

## Acceptance Criteria
- [ ] POST /integrations/api-keys → 201, rawKey в ответе
- [ ] GET /integrations/api-keys → rawKey не возвращается, только keyPreview
- [ ] Запрос с Bearer ft_<64hex> → authenticate middleware → 200
- [ ] Запрос с невалидным API-ключом → 401
- [ ] DELETE /integrations/api-keys/:id → ключ инвалидирован, следующий запрос → 401
