---
id: gap-13-2fa-totp
type: gap-feat
priority: P2
status: draft
---

# Spec: 2FA / TOTP — двухфакторная аутентификация через Avanpost / Keycloak

## Intent
Добавить поддержку второго фактора (TOTP) для SSO-пользователей: FlowTask делегирует проверку IdP (Avanpost/Keycloak) и верифицирует результат через `amr` claim в OIDC-токене. Для local-пользователей 2FA не реализуется (отдельный backlog).

## Три режима авторизации в системе

| # | Режим | Кто выполняет логин | 2FA | Скоуп gap-13 |
|---|---|---|---|---|
| 1 | **Local** | FlowTask (email + пароль) | нет | — |
| 2 | **SSO** | Avanpost / Keycloak | нет | частично (workspace requireMfa) |
| 3 | **SSO + TOTP** | Avanpost / Keycloak → TOTP-экран IdP | да | ✓ |

В режиме 3 FlowTask **не показывает** TOTP-экран и **не хранит** TOTP-секреты. Всё происходит на стороне IdP. FlowTask только читает `amr` claim из id_token и решает, пропускать пользователя в воркспейс или нет.

## BDD Scenarios

```gherkin
Feature: 2FA / TOTP — проверка второго фактора через IdP

  Background:
    Given AUTH_MODE=avanpost (или keycloak), SSO_ENABLED=true

  # ── Вход без MFA-требования ──────────────────────────────

  Scenario: [A1] SSO-вход без TOTP — workspace не требует MFA
    Given воркспейс: requireMfa = false (default)
    When пользователь проходит OIDC flow без второго фактора
    Then id_token может не содержать amr или содержать amr: ["pwd"]
    And FlowTask создаёт сессию штатно
    And пользователь попадает в воркспейс

  # ── Вход с TOTP через IdP ─────────────────────────────────

  Scenario: [A2] SSO + TOTP — успешный вход
    Given в Avanpost включён обязательный TOTP для группы FloTask-users
    When пользователь нажимает "Войти через Avanpost"
    And вводит корпоративный пароль на странице Avanpost
    And вводит TOTP-код из мобильного приложения на странице Avanpost
    Then Avanpost возвращает id_token с claim amr: ["totp"] (или ["pwd", "totp"])
    And FlowTask создаёт сессию и сохраняет amr в Redis
    And пользователь попадает в воркспейс

  # ── Workspace требует MFA ─────────────────────────────────

  Scenario: [A3] workspace требует MFA — amr содержит totp — доступ разрешён
    Given воркспейс: requireMfa = true
    And в сессии amr: ["totp"]
    When пользователь обращается к любому маршруту воркспейса
    Then workspaceMfaGuard пропускает запрос

  Scenario: [A4] workspace требует MFA — amr не содержит totp — доступ запрещён
    Given воркспейс: requireMfa = true
    And в сессии amr: ["pwd"] или amr отсутствует
    When пользователь обращается к маршруту воркспейса
    Then 403 { code: "MFA_REQUIRED" }
    And фронтенд показывает: "Для доступа к этому воркспейсу требуется двухфакторная аутентификация"
    And ссылка на инструкцию по настройке TOTP в Avanpost

  Scenario: [A5] OWNER включает обязательную MFA для воркспейса
    Given я OWNER, нахожусь на /w/<slug>/settings?tab=security
    When включаю "Обязательная 2FA" и нажимаю "Сохранить"
    Then PATCH /api/workspaces/<slug>/settings { requireMfa: true } → 200
    And все последующие входы без amr totp в этот воркспейс дадут 403

  Scenario: [A6] OWNER включает MFA — grace period для существующих участников
    Given воркспейс только что получил requireMfa = true
    And участник уже авторизован без TOTP (amr: ["pwd"])
    When участник заходит в воркспейс
    Then показывается баннер "Требуется настроить 2FA — осталось 7 дней"
    And доступ к воркспейсу разрешён на период grace period

  Scenario: [A7] grace period истёк
    Given grace period (7 дней) истёк для участника
    When участник пытается зайти в воркспейс
    Then 403 { code: "MFA_GRACE_EXPIRED" }
    And редирект на страницу с инструкцией настройки TOTP в Avanpost
```

## SDD Contracts

### 1. Извлечение amr из OIDC-токена

```typescript
// backend/src/modules/auth/sso/claims-mapper.ts
export interface MappedClaims {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
  amr: string[];   // Authentication Method References (RFC 8176)
                   // Keycloak: ["pwd"] / ["pwd","totp"] / ["otp"]
                   // Avanpost: ["totp"] / ["password","totp"]
}

export function mapClaims(raw: Record<string, unknown>): MappedClaims {
  // ... existing fields ...
  const amr = Array.isArray(raw['amr']) ? (raw['amr'] as string[]) : [];
  return { sub, email, name, emailVerified, amr };
}
```

### 2. Сохранение amr в Redis-сессию

```typescript
// backend/src/modules/auth/sso/sso.service.ts
// В handleSsoCallback, после jitProvision:
await setUserSession(user.id, refreshToken, {
  amr: claims.amr,   // сохраняем вместе с сессией
});
```

### 3. Поле requireMfa на Workspace

```prisma
// backend/src/prisma/schema.prisma
model Workspace {
  // ... existing fields ...
  requireMfa      Boolean  @default(false)
  mfaGraceDays    Int      @default(7)
  @@map("workspaces")
}
```

### 4. Workspace MFA Guard middleware

```typescript
// backend/src/shared/middleware/workspace-mfa-guard.ts
const MFA_AMR_VALUES = ['totp', 'otp', 'mfa', 'hwk', 'swk'];

export async function workspaceMfaGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const workspace = req.workspace;  // прикреплён вышестоящим middleware
  if (!workspace.requireMfa) return next();

  const session = await getUserSession(req.userId);
  const amr: string[] = session?.amr ?? [];
  const mfaSatisfied = amr.some(v => MFA_AMR_VALUES.includes(v));
  if (mfaSatisfied) return next();

  // Проверка grace period
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.userId } },
    select: { createdAt: true, mfaGraceUntil: true },
  });

  const graceUntil = member?.mfaGraceUntil ?? null;
  if (graceUntil && graceUntil > new Date()) {
    const daysLeft = Math.ceil((graceUntil.getTime() - Date.now()) / 86_400_000);
    res.setHeader('X-MFA-Grace-Days', daysLeft);
    return next();
  }

  throw new AppError(403, graceUntil ? 'MFA_GRACE_EXPIRED' : 'MFA_REQUIRED');
}
```

### 5. Workspace settings DTO

```typescript
// backend/src/modules/workspaces/workspaces.dto.ts
export const UpdateWorkspaceSettingsSchema = z.object({
  name:         z.string().min(1).max(100).optional(),
  description:  z.string().max(500).optional(),
  isPrivate:    z.boolean().optional(),
  requireMfa:   z.boolean().optional(),   // ← новый
  mfaGraceDays: z.number().int().min(1).max(30).optional(),  // ← новый
});
```

### 6. WorkspaceMember — grace period поле

```prisma
model WorkspaceMember {
  // ... existing fields ...
  mfaGraceUntil DateTime?  // выставляется при включении requireMfa на воркспейс
  @@map("workspace_members")
}
```

> При PATCH `requireMfa: true` → сервис проставляет `mfaGraceUntil = now() + mfaGraceDays` всем участникам без `amr: totp` в активных сессиях.

## Scope
- `backend/src/modules/auth/sso/claims-mapper.ts` — добавить `amr` в `MappedClaims`
- `backend/src/modules/auth/sso/sso.service.ts` — сохранять `amr` в Redis-сессию
- `backend/src/shared/middleware/workspace-mfa-guard.ts` — новый middleware
- `backend/src/prisma/schema.prisma` — `Workspace.requireMfa`, `Workspace.mfaGraceDays`, `WorkspaceMember.mfaGraceUntil`
- `backend/src/modules/workspaces/workspaces.dto.ts` — `requireMfa`, `mfaGraceDays`
- `backend/src/modules/workspaces/workspaces.service.ts` — при включении MFA проставить grace period участникам
- `frontend/src/pages/WorkspaceSettingsPage.tsx` — вкладка Security: toggle `requireMfa`
- `frontend` — баннер grace period в WorkspaceLayout

## Out of Scope
- Native TOTP (QR-код, секрет, challenge) для local-пользователей — отдельный backlog
- SMS 2FA
- WebAuthn / FIDO2
- Настройка TOTP в Avanpost / Keycloak — это сторона ИБ, не FlowTask

## Constraints
- `amr` claim должен быть включён в id_token на стороне IdP — Avanpost ≥ 4.x, Keycloak ≥ 18.x
- Grace period считается от момента включения `requireMfa` (через `mfaGraceUntil`), не от `createdAt` участника
- Middleware применяется только к SSO-пользователям (`authProvider != 'local'`); local-пользователи не затрагиваются

## Acceptance Criteria
- [ ] `mapClaims` извлекает `amr` из id_token
- [ ] `amr` сохраняется в Redis-сессию при SSO-входе
- [ ] `requireMfa = false` → workspaceMfaGuard пропускает все запросы
- [ ] `requireMfa = true` + `amr: ["totp"]` → доступ разрешён
- [ ] `requireMfa = true` + `amr: ["pwd"]` → 403 `MFA_REQUIRED`
- [ ] Grace period: участники получают `mfaGraceUntil` при включении MFA, баннер показывается N дней
- [ ] После истечения grace period → 403 `MFA_GRACE_EXPIRED`
- [ ] OWNER переключает `requireMfa` через PATCH /workspaces/:slug/settings
