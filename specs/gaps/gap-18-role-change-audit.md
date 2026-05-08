---
id: gap-18-role-change-audit
type: gap-fix
priority: P1
status: done
source: pentest-2026-05-07
pr: этa ветка
---

# Spec: Смена роли участника не фиксировала «было-стало»

## Intent
`PATCH /api/workspaces/:id/members/:userId` обновлял роль, но не записывал
WorkspaceEvent с `oldRole` / `newRole`. Аудитор не мог проследить историю
изменения прав без ручной сверки.

## Root Cause
`workspaces.service.ts` — `updateMemberRole()` вызывал `logEvent()` только для
`member_added`, но не для `member_role_changed`. Текущая роль не читалась до
обновления, поэтому `oldRole` нигде не сохранялся.

## BDD Scenarios

```gherkin
Feature: Аудит изменения роли участника воркспейса (ГОСТ 57580 УЗП.24)

  Scenario: Смена роли записывается в WorkspaceEvent с было-стало
    Given owner@corp.ru аутентифицирован
    And member@corp.ru имеет роль VIEWER в воркспейсе WS-1
    When PATCH /api/workspaces/WS-1/members/:memberId {"role":"MEMBER"}
    Then статус 200
    And WorkspaceEvent содержит:
      | field   | value                |
      | action  | member_role_changed  |
      | userId  | owner_user_id        |
      | meta.oldRole | VIEWER          |
      | meta.newRole | MEMBER          |

  Scenario: Смена роли не происходит без прав OWNER
    Given member@corp.ru аутентифицирован (роль MEMBER)
    When PATCH /api/workspaces/WS-1/members/:viewerId {"role":"OWNER"}
    Then статус 403
    And WorkspaceEvent НЕ создаётся
```

## SDD Contracts

```typescript
// workspaces.service.ts — updateMemberRole()
export async function updateMemberRole(workspaceId, requesterId, targetUserId, dto) {
  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  const oldRole = member.role;   // сохраняем ДО обновления

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role: dto.role },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  await logEvent(workspaceId, requesterId, 'member_role_changed', 'WorkspaceMember',
    targetUserId, { oldRole, newRole: dto.role, targetUserId });

  return updated;
}
```

## Scope
- `workspaces.service.ts` — читать `member.role` до `update()`, передавать `oldRole` в `logEvent()`

## Out of Scope
- Уведомление пользователю о смене роли
- История ролей в UI

## Acceptance Criteria
- [x] `PATCH /api/workspaces/:id/members/:userId` создаёт WorkspaceEvent с `action=member_role_changed`
- [x] `event.meta.oldRole` содержит предыдущую роль
- [x] `event.meta.newRole` содержит новую роль
- [x] `event.userId` содержит id инициатора (OWNER)
