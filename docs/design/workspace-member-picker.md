# Workspace Member Picker — Design Document

> **Slug**: `workspace-member-picker`
> **Status**: Draft (G2)
> **Author**: Claude Code (jack)
> **Date**: 2026-05-18
> **Related BDD**: `specs/workspace-member-picker.feature`
> **Pipeline**: feat + api (затрагивает backend и frontend)

## 1. Цель

Дать владельцам воркспейсов возможность быстро добавлять **уже зарегистрированных** пользователей системы в свой workspace через **inline autocomplete** в разделе «Настройки → Участники», без необходимости знать точный email.

Существующие flow остаются:
- `POST /workspaces/:id/invite` — по точному email (включая пользователей, которых нет в системе → возвращает 404, отдельный flow приглашений в будущем).
- `POST /workspaces/:id/members` (по `userId`) — уже существует, переиспользуется picker'ом.

Новое — поиск по подстроке имени/email с защитой от user enumeration.

## 2. Не-цели (Non-goals)

- **Глобальный @-mention в комментариях** — отдельная задача, переиспользует тот же endpoint позже.
- **Поиск среди НЕ-зарегистрированных** — invite-by-email сохраняется как fallback (см. секцию 7 «UX flow»).
- **Bulk-add** (массовое добавление через чекбоксы) — vNext.
- **Поиск по компаниям/группам/AD-атрибутам** — Phase 1 это plain text по name+email.
- **Картина из Board → Settings → Участники доски** — отложено (не в G1 scope, см. AskUserQuestion ответ пользователя).

## 3. Инвентаризация данных

| Таблица | Поля используем | Notes |
|---------|-----------------|-------|
| `users` | `id`, `name`, `email`, `avatar`, `isActive` | Возвращаем только `isActive = true` |
| `workspace_members` | `workspaceId`, `userId` | Используем для пометки `alreadyMember` |

Не используем: `ssoSubjectId`, `lastLoginAt`, `isSuperadmin`, `authProvider`, любые другие membership'ы юзера. Это закрывает enumeration по «где ещё этот человек».

## 4. API Contract

### 4.1 Новый endpoint — поиск кандидатов

```
GET /api/workspaces/{id}/members/candidates?q={query}&limit={limit}
```

**Auth**: Bearer JWT (existing `authenticate` middleware).
**RBAC**: caller MUST быть OWNER текущего workspace (`assertOwner`).
**Rate limit**: scope `member-search`, 30 запросов/мин per userId.

**Query params**:

| Param | Тип | Constraint | Default |
|-------|-----|------------|---------|
| `q` | string | `1..100` chars после `.trim()`. Если `< 2` после trim → 400 `query too short` | required |
| `limit` | int | `1..20` | 10 |

**Response 200**:

```ts
type CandidatesResponse = Array<{
  id: string;            // UUID
  name: string;
  email: string;
  avatar: string | null;
  alreadyMember: boolean; // true если уже в workspaceId
}>;
```

**Сортировка**: сначала точные совпадения по email (case-insensitive), затем startsWith по name, затем contains. Стабильная сортировка по `name` внутри группы.

**Errors**:

| Status | Code | Условие |
|--------|------|---------|
| 400 | `validation_error` | `q` отсутствует, или после trim < 2 символов, или `limit` вне диапазона |
| 401 | `unauthorized` | Нет/невалидный токен |
| 403 | `forbidden` | Не OWNER текущего workspace |
| 404 | `workspace_not_found` | Workspace не существует или soft-deleted |
| 429 | `rate_limited` | Превышен лимит. `Retry-After` в секундах |

### 4.2 Переиспользуемый endpoint — добавление

```
POST /api/workspaces/{id}/members
Content-Type: application/json

{ "userId": "uuid", "role": "OWNER" | "MEMBER" | "VIEWER" }
```

**Существует уже** — не меняется. Возвращает `WorkspaceMember` с include `user{id,name,email,avatar}`. Дедуп через 409, Owner-only.

## 5. Privacy / Anti-enumeration model

Эндпоинт `/members/candidates` — потенциальный вектор user enumeration: любой Owner workspace получает справочник всех юзеров системы.

**Митигации**:

| Risk | Митигация |
|------|-----------|
| Скрейпинг полной user базы по перебору 2-символьных префиксов («a», «b», …, «aa», «ab», …) | Rate limit 30 req/min per userId. С `limit=20` максимум 600 user-записей в минуту на одного Owner. Тысяча юзеров требует > часа сканирования и оставляет след в логах |
| Утечка чувствительных атрибутов | Возвращаем только `id/name/email/avatar/alreadyMember`. НЕ возвращаем `lastLoginAt`, `isSuperadmin`, `authProvider`, `loginCount`, `isActive` (фильтруем неактивных молча), `workspaceMemberships` |
| Утечка существования юзера через email-probe («есть ли user с этим email») | Запрос требует ≥ 2 символа — нельзя прозондировать конкретный email одним запросом. **TODO accepted_because**: точный email всё равно можно через `POST /invite` (404 vs 409). Это existing behaviour, отдельная задача |
| Каждый Owner видит весь instance | Принято в G1 как осознанный trade-off для пилота. Записано в SDD как known limitation |
| Авторизованный, но не-Owner пытается дёрнуть endpoint | `assertOwner` → 403 ещё до query к БД |
| Запрос с пустой строкой возвращает всех | Min length 2 после trim, иначе 400 |
| Запрос с SQL-инъекцией или wildcard | Prisma параметризует через `contains`/`mode: insensitive`, escape не нужен |
| Audit trail | Логируем в `audit_logs` каждый успешный search с `userId`, `workspaceId`, `q.length` (не сам q — могут быть PII), `resultCount`. Это даёт детектор аномалий «один Owner за час нагенерировал 1000 поисков» |

**Не митигируем (записано как accepted)**:
- Captcha — overkill для пилота.
- IP-based блокировка — за NAT/корпсетью даст ложные срабатывания.
- Server-side throttling по 429 с экспоненциальным backoff — оставляем плоский лимит.

## 6. Производительность

Запрос:
```sql
SELECT id, name, email, avatar FROM users
WHERE is_active = true
  AND (lower(name) LIKE lower(:q || '%') OR lower(email) LIKE lower(:q || '%')
       OR lower(name) LIKE lower('%' || :q || '%') OR lower(email) LIKE lower('%' || :q || '%'))
ORDER BY ... LIMIT 20;
```

**Индекс**: для пилота (десятки–сотни юзеров) — `LIKE 'q%'` отлично работает по простому btree на `lower(email)` и `lower(name)`. Полный contains-поиск без индекса сейчас приемлем при < 10k юзеров.

Миграция `add_user_search_indexes`:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_name_lower  ON users (lower(name));
```

**Future**: при > 10k юзеров переключиться на `pg_trgm` + `gin_trgm_ops` для contains-поиска. Зафиксировано как deferred follow-up.

## 7. UX & Accessibility

**Целевой WCAG-уровень**: AA.

### 7.1 Required UI states

В компоненте `MemberPicker` (одна input-плашка с dropdown):

- [x] **Idle** — empty input, placeholder «Имя или email пользователя».
- [x] **Hint (типинг < 2 chars)** — мелкий текст под полем «Введите минимум 2 символа».
- [x] **Loading** — spinner в правой части input + skeleton в dropdown (3 строки).
- [x] **Results** — список до 10 строк. Каждая: avatar + name + email справа + role selector inline + кнопка «Добавить».
- [x] **Already member** — строка с приглушённым стилем + бейдж «уже в воркспейсе», кнопка disabled. Не скрываем — пользователь поймёт что искал того же.
- [x] **Empty (results = 0)**:
  - Если query похож на email → CTA «Пригласить `<email>` по почте» (зовёт существующий `inviteByEmail`).
  - Иначе → текст «Пользователь не найден. Введите полный email чтобы пригласить нового».
- [x] **Error (network/500)** — inline error «Не удалось выполнить поиск» + кнопка «Повторить».
- [x] **Rate-limited (429)** — «Слишком много запросов. Попробуйте через `N` сек», disabled input на `Retry-After` секунд.

### 7.2 Keyboard

- Tab focus → input.
- Arrow Down → focus первый результат (если открыт dropdown).
- Arrow Up/Down → навигация по результатам, циклически.
- Enter на результате → открывает inline role-selector (`MEMBER` по умолчанию), второй Enter → добавляет.
- Esc → закрывает dropdown, возвращает фокус на input.
- Esc второй раз → закрывает модалку (если picker внутри модалки).
- Visible focus ring на input и на каждой строке dropdown (не `outline:none`).

### 7.3 Screen reader

- Input: `<input aria-autocomplete="list" aria-controls="member-picker-listbox" aria-expanded={isOpen}>`.
- Dropdown: `role="listbox"`, каждая строка `role="option"` с `aria-selected`.
- При появлении результатов: `aria-live="polite"` зона объявляет «Найдено N пользователей».
- Empty state и error state — тоже под `aria-live="polite"`.

### 7.4 Touch targets

- Input высота 40px (выше 44px tap-target за счёт padding container'а в строке формы).
- Каждая строка результата: высота 48px.
- Кнопка «Добавить» — 32×80px минимум, окружена padding'ом в строке.

### 7.5 Responsive

- Desktop ≥768px: dropdown шириной = input.
- Mobile <768px: dropdown полноэкранный (sheet снизу), input трансформируется в строку поиска с back-button.

### 7.6 Debounce + cancellation

- Debounce 250ms перед отправкой запроса.
- Каждый новый запрос отменяет предыдущий через `AbortController`.

## 8. Frontend архитектура

### 8.1 Новые модули

```
frontend/src/components/MemberPicker.tsx           // standalone компонент
frontend/src/api/workspaces.ts                     // +searchCandidates(wsId, q, limit?)
frontend/src/__tests__/MemberPicker.test.tsx       // unit (debounce, keyboard, states)
```

### 8.2 Контракт компонента

```ts
type MemberPickerProps = {
  workspaceId: string;
  onAdded: (member: WorkspaceMember) => void;       // refresh parent list
  onFallbackInvite?: (email: string) => Promise<void>; // вызывается из empty CTA
  defaultRole?: WorkspaceRole;                       // default 'MEMBER'
  theme: ThemeTokens;                                // dark/light tokens текущей страницы
};
```

### 8.3 Интеграция в Settings → Участники

Заменяем текущий блок (line 438–451 в `WorkspaceSettingsPage.tsx`):

```tsx
{showInviteForm && isOwner && (
  <MemberPicker
    workspaceId={workspace.id}
    onAdded={(m) => {
      setMembers(prev => [...prev, m]);
      setShowInviteForm(false);
      load();
      message.success('Участник добавлен');
    }}
    onFallbackInvite={async (email) => {
      await workspacesApi.inviteByEmail(workspace.id, email);
      const updated = await workspacesApi.listMembers(workspace.id);
      setMembers(updated);
      setShowInviteForm(false);
      load();
      message.success('Приглашение отправлено');
    }}
    theme={c}
  />
)}
```

Старый input для invite-email удаляется (его роль теперь играет fallback CTA внутри picker'а).

## 9. State machine модалки picker'а

```
idle
  │
  │ user types ≥ 2 chars
  ▼
loading ──(fetch fail)──> error ──(retry)──> loading
  │                                 ▲
  │ 200 OK                          │
  ▼                                 │
results ──(user types)─> loading ───┘
  │                                 │
  │ 200 OK & length=0               │
  ▼                                 │
empty                               │
  │ user clicks fallback CTA        │
  ▼                                 │
inviting ──(invite OK)──> idle (закрытие)
       └──(invite fail)──> empty + error toast

results ──(user clicks «Добавить»)──> adding
  ├──(409 already member)──> results (бейдж обновляется, toast «уже в воркспейсе»)
  ├──(403/404)──> error
  └──(201)──> idle (закрытие + onAdded callback)
```

## 10. Backend архитектура

### 10.1 Service layer

`backend/src/modules/workspaces/workspaces.service.ts` — добавить:

```ts
const CANDIDATE_LIMIT_MAX = 20;
const CANDIDATE_LIMIT_DEFAULT = 10;
const CANDIDATE_MIN_QUERY = 2;

export async function searchMemberCandidates(
  workspaceId: string,
  requesterId: string,
  q: string,
  limit: number,
) {
  await assertOwner(workspaceId, requesterId);

  const trimmed = q.trim();
  if (trimmed.length < CANDIDATE_MIN_QUERY) {
    throw new AppError(400, 'Query must be at least 2 characters');
  }
  const safeLimit = Math.min(Math.max(1, limit), CANDIDATE_LIMIT_MAX);

  // Existing membership map for alreadyMember flag.
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { name:  { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, avatar: true },
    take: safeLimit,
    orderBy: [{ name: 'asc' }],
  });

  if (candidates.length === 0) return [];

  const existing = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: candidates.map(c => c.id) } },
    select: { userId: true },
  });
  const memberSet = new Set(existing.map(m => m.userId));

  await auditLog({
    action: 'member.candidates.search',
    actorId: requesterId,
    workspaceId,
    meta: { queryLength: trimmed.length, resultCount: candidates.length },
  });

  return candidates.map(c => ({ ...c, alreadyMember: memberSet.has(c.id) }));
}
```

### 10.2 DTO

`backend/src/modules/workspaces/workspaces.dto.ts` — добавить:

```ts
export const candidateSearchQueryDto = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type CandidateSearchQueryDto = z.infer<typeof candidateSearchQueryDto>;
```

### 10.3 Router

```ts
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';

const memberSearchLimit = rateLimit({
  ...RATE_LIMITS.memberSearch,
  keyFn: (req) => (req as AuthRequest).user!.userId,
});

router.get('/:id/members/candidates',
  memberSearchLimit,
  authHandler(async (req, res) => {
    const parsed = candidateSearchQueryDto.parse(req.query);
    const result = await ws.searchMemberCandidates(
      String(req.params.id), req.user!.userId, parsed.q, parsed.limit,
    );
    res.json(result);
  }),
);
```

### 10.4 Rate limit constants

`shared/middleware/rate-limit.ts` — добавить:

```ts
export const RATE_LIMITS = {
  // ...existing...
  memberSearch: { scope: 'member-search', limit: 30, windowMs: 60_000 },
};
```

### 10.5 OpenAPI

`shared/openapi/routes/workspaces.ts` — добавить registry.registerPath с правильными responses (200/400/403/404/429).

### 10.6 Migration

`prisma/migrations/<timestamp>_add_user_search_indexes/migration.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_name_lower  ON users (lower(name));
```

Это additive миграция — не блокирует записи, безопасна.

## 11. Стыки (что меняем в существующих файлах)

| Файл | Изменение |
|------|-----------|
| `backend/src/modules/workspaces/workspaces.service.ts` | +функция `searchMemberCandidates` |
| `backend/src/modules/workspaces/workspaces.dto.ts` | +`candidateSearchQueryDto` |
| `backend/src/modules/workspaces/workspaces.router.ts` | +GET `/:id/members/candidates` route |
| `backend/src/shared/middleware/rate-limit.ts` | +`RATE_LIMITS.memberSearch` |
| `backend/src/shared/openapi/routes/workspaces.ts` | +registry.registerPath для `/members/candidates` |
| `backend/src/__tests__/workspaces.test.ts` | +describe «member candidates search» |
| `backend/src/prisma/migrations/<ts>_add_user_search_indexes/migration.sql` | new |
| `frontend/src/api/workspaces.ts` | +`searchCandidates(wsId, q, limit?)` |
| `frontend/src/components/MemberPicker.tsx` | new |
| `frontend/src/__tests__/MemberPicker.test.tsx` | new |
| `frontend/src/pages/WorkspaceSettingsPage.tsx` | заменить block invite form на `<MemberPicker>` |
| `specs/workspace-member-picker.feature` | new |
| `docs/design/workspace-member-picker.md` | this file |

## 12. Риски и blast radius

| Риск | Severity | Митигация / куда адресуется |
|------|----------|------------------------------|
| User enumeration через rate-limited перебор | MEDIUM | `addressed_in:` rate-limit 30/min + audit log + min 2 chars (см. секция 5) |
| Performance degradation на большой базе users | LOW | `addressed_in:` миграция с индексами на lower(name)/lower(email); deferred trigram для >10k |
| Дубликаты при гонке двух Owner'ов | LOW | Существующий 409 в `addMember` (unique constraint `workspaceId_userId`) |
| Owner добавляет себя | LOW | `addMember` отдаст 409 (он уже OWNER) — UX покажет «уже в воркспейсе» |
| Поломка существующего invite-by-email flow | LOW | `addressed_in:` fallback CTA внутри picker'а тестируется отдельным сценарием в BDD |
| UI race: пользователь добавляет → одновременно другой Owner удалил | LOW | `accepted_because:` 404 от backend, toast «Не найден». Refresh через onAdded callback |
| Тёмная/светлая темы — picker не учитывает | MEDIUM | `addressed_in:` props.theme передаётся, dark/light parity проверяется в smoke |
| Audit log spam (1 запись на каждый keystroke после debounce) | LOW | `accepted_because:` 30/min — приемлемый объём; useful для detection. Если станет шумно — потом агрегировать |
| Soft-deleted workspace — picker не должен работать | LOW | `addressed_in:` `assertOwner` уже проверяет `deletedAt: null` (через `assertMember` inside) |
| Удалённый из системы user (`isActive=false`) попадает в результаты | LOW | `addressed_in:` `where.isActive = true` |

## 13. Open questions

Ни одного. Все решения приняты в этом документе и G1 ответами пользователя.

## 14. Acceptance criteria

- [ ] Endpoint `GET /workspaces/:id/members/candidates` отвечает 200 с правильным shape для Owner'а.
- [ ] Endpoint отвечает 403 для не-Owner.
- [ ] Endpoint отвечает 400 при `q.length < 2`.
- [ ] Endpoint отвечает 429 после превышения 30 req/min.
- [ ] Endpoint возвращает `alreadyMember: true` для пользователей уже в workspace.
- [ ] Endpoint исключает `isActive: false` users.
- [ ] Endpoint логирует search в audit_logs.
- [ ] Migration `add_user_search_indexes` создаёт два btree-индекса.
- [ ] `MemberPicker` компонент покрывает 7 UI states из секции 7.1.
- [ ] Keyboard navigation работает (Tab/Arrow/Enter/Esc).
- [ ] Dark + Light темы выглядят одинаково корректно.
- [ ] Существующий invite-by-email flow доступен через fallback CTA в empty state.
- [ ] Coverage ≥ 80% для новой логики (unit + integration).
- [ ] code-reviewer + security-reviewer + ux-reviewer прошли без LOW (или все LOW зафикшены / задокументированы как deferred).
