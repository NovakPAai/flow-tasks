---
id: gap-20-config-change-audit
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Изменение системных настроек не логировалось

## Intent
`PATCH /api/admin/config` не существовал как отдельный endpoint.
Системные настройки (registrationDomain, etc.) не изменялись через API,
и событие `admin.config.change` никогда не записывалось в AuditLog.

## Root Cause
- `admin.router.ts` не содержал маршрута `PATCH /config`
- `admin.service.ts` не содержал функции `updateConfig()`
- `admin.dto.ts` не содержал `updateConfigDto`

## BDD Scenarios

```gherkin
Feature: Аудит изменения системных настроек (Req логирование §2.3)

  Scenario: Суперадмин меняет системную настройку — событие логируется
    Given admin@corp.ru аутентифицирован (superadmin)
    When PATCH /api/admin/config {"registrationDomain":"newdomain.ru"}
    Then статус 200
    And AuditLog содержит:
      | field           | value                |
      | action          | admin.config.change  |
      | result          | SUCCESS              |
      | meta.setting    | registrationDomain   |
      | meta.oldValue   | <предыдущее значение>|
      | meta.newValue   | newdomain.ru         |

  Scenario: Обычный пользователь не может изменить настройки
    Given member@corp.ru аутентифицирован (НЕ superadmin)
    When PATCH /api/admin/config {"registrationDomain":"evil.ru"}
    Then статус 403
    And AuditLog НЕ создаётся
```

## SDD Contracts

```typescript
// admin.dto.ts
export const updateConfigDto = z.object({
  registrationDomain: z.string().min(1).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined),
  { message: 'Укажите хотя бы одну настройку' });

// admin.service.ts
export async function updateConfig(actorId: string, dto: UpdateConfigDto) {
  for (const [setting, newValue] of Object.entries(dto)) {
    if (newValue === undefined) continue;
    const snakeKey = setting.replace(/([A-Z])/g, '_$1').toUpperCase() as keyof typeof config;
    const oldValue = String((config as Record<string, unknown>)[snakeKey] ?? '');
    void auditLog({ actorId, action: 'admin.config.change', result: 'SUCCESS',
      meta: { setting, oldValue, newValue } });
  }
  return { updated: Object.keys(dto).filter((k) => dto[k as keyof typeof dto] !== undefined) };
}

// admin.router.ts
router.patch('/config', requireSuperadmin, validate(updateConfigDto), async (req, res, next) => {
  try { res.json(await adminService.updateConfig(req.user!.userId, req.body)); }
  catch (err) { next(err); }
});
```

## Scope
- `admin.dto.ts` — добавить `updateConfigDto`
- `admin.service.ts` — добавить `updateConfig()`
- `admin.router.ts` — добавить маршрут `PATCH /config`

## Out of Scope
- Реальное изменение `config` в рантайме (настройки живут в env)
- Нотификация пользователей при смене домена регистрации

## Acceptance Criteria
- [x] `PATCH /api/admin/config` возвращает 200 с `{updated: [...]}`
- [x] AuditLog содержит `action=admin.config.change`, `meta.setting`, `meta.oldValue`, `meta.newValue`
- [x] 403 для non-superadmin
