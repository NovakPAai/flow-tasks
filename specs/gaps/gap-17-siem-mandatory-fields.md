---
id: gap-17-siem-mandatory-fields
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Отсутствие обязательных SIEM-полей в AuditLog

## Intent
События в `AuditLog` не содержали обязательных полей для SIEM-интеграции:
`source`, `subject`, `tech_segment`, `tags`, `session_id`, `result`.
Без этих полей события нельзя корректно классифицировать и маршрутизировать в SIEM.

## Root Cause
`audit-logger.ts` записывал только пользовательские метаданные (`meta`).
Нормативные поля не добавлялись автоматически при каждом событии.
SIEM-теги генерировались только для auth-событий и только при наличии `tagsForAction()`.

## BDD Scenarios

```gherkin
Feature: Обязательные SIEM-поля в каждом AuditLog-событии

  Scenario: Каждая запись AuditLog содержит обязательные SIEM-поля
    Given выполнено любое действие (login/logout/task-change/admin-action)
    When запись сохранена в AuditLog
    Then record.meta содержит ключи:
      | ключ         | тип     | описание                          |
      | source       | string  | "flow-tasks-backend"              |
      | subject      | string  | actorId или "system"              |
      | tech_segment | string  | "iia" / "audit" / "admin" / ...   |
      | tags         | array   | ["flowtasks",<type>,<segment>,…]  |
      | session_id   | string? | null допустим при отсутствии сессии |
      | result       | string  | "SUCCESS" или "FAIL"              |

  Scenario: SIEM-теги auth.login
    When POST /api/auth/login (успех)
    Then event.meta.tags == ["flowtasks","auth","iia",<env>,<dc>]

  Scenario: SIEM-теги admin-события
    When POST /api/admin/... (любое admin-действие)
    Then event.meta.tags[0] == "flowtasks"
    And  event.meta.tags[1] == "admin"

  Scenario: createdAt соответствует ISO-8601
    When запись создана в AuditLog
    Then new Date(record.createdAt).toISOString() не бросает исключение
```

## SDD Contracts

```typescript
// audit-logger.ts — функция auditLog()
export async function auditLog(event: AuditEvent): Promise<void> {
  const tags = tagsForAction(event.action);           // [system,type,segment,env,dc]
  const techSegment = tags[2] ?? 'iia';

  const meta = maskPii({
    result: event.result ?? 'SUCCESS',
    source: 'flow-tasks-backend',
    subject: event.actorId ?? 'system',
    tech_segment: techSegment,
    tags,
    session_id: event.sessionId ?? null,   // null проходит toBeDefined() в тестах
    ip: event.ip,
    userAgent: event.userAgent,
    sessionId: event.sessionId,            // camelCase сохраняется для обратной совместимости
    time: new Date().toISOString(),
    ...event.meta,
  });

  await prisma.auditLog.create({
    data: { actorId: event.actorId, action: event.action, targetId: event.targetId, meta },
  });
}

// siem-tags.ts — tagsForAction()
export function tagsForAction(action: string): string[] {
  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  const dc  = process.env.DC_REGION ?? 'dc1';

  if (action.startsWith('auth.')) return ['flowtasks', 'auth', 'iia', env, dc];
  if (action.startsWith('admin.')) return ['flowtasks', 'admin', 'admin', env, dc];
  if (action.startsWith('system.')) return ['flowtasks', 'system', 'ops', env, dc];
  return ['flowtasks', 'app', 'app', env, dc];
}
```

## Scope
- `audit-logger.ts` — добавить `source`, `subject`, `tech_segment`, `tags`, `session_id` в meta
- `siem-tags.ts` — создать / расширить функцию `tagsForAction()`
- `admin.service.ts` — заменить приватный `writeAuditLog` на `auditLog()` из shared utility

## Out of Scope
- SIEM-транспорт (syslog / HTTP-sink) — отдельный gap
- Буферизация при недоступном SIEM

## Acceptance Criteria
- [x] Каждая AuditLog-запись содержит `source`, `subject`, `tech_segment`, `tags`, `session_id`, `result`
- [x] `tags` — массив минимум из 3 элементов: `["flowtasks", <type>, <segment>]`
- [x] `session_id: null` при отсутствии сессии (Vitest `toBeDefined()` допускает `null`)
- [x] `createdAt` парсируется как ISO-8601
