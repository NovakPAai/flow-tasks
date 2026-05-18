# Plan — Workspace Member Picker

> **Slug**: `workspace-member-picker`
> **SDD**: `docs/design/workspace-member-picker.md`
> **BDD**: `specs/workspace-member-picker.feature`
> **Complexity**: M (1 backend endpoint + 1 frontend component + integration + миграция, без архитектурных сдвигов)
> **Estimate**: 1 раб. день (~4-6 часов чистой работы + ревью)

## Шаги имплементации

### Phase A — Backend (G5: failing tests first)

1. **DTO** — добавить `candidateSearchQueryDto` в `backend/src/modules/workspaces/workspaces.dto.ts`.
2. **Rate limit** — добавить `memberSearch` в `RATE_LIMITS` (`backend/src/shared/middleware/rate-limit.ts`).
3. **Service** — `searchMemberCandidates` в `backend/src/modules/workspaces/workspaces.service.ts`:
   - `assertOwner` → если не Owner → 403 (через AppError)
   - validate query length ≥ 2 после `.trim()`, иначе 400
   - clamp limit в [1..20]
   - `prisma.user.findMany` с `where.isActive=true` + OR(name/email contains insensitive)
   - lookup `workspace_members` для `alreadyMember` флага
   - audit log (queryLength + resultCount, БЕЗ q)
   - sort: точные совпадения email > startsWith name > contains
4. **Router** — `GET /:id/members/candidates` + `memberSearchLimit` middleware в `workspaces.router.ts`.
5. **OpenAPI** — `registry.registerPath` в `shared/openapi/routes/workspaces.ts`.
6. **Миграция** — `prisma/migrations/<ts>_add_user_search_indexes/migration.sql` с двумя `CREATE INDEX IF NOT EXISTS`.
7. **Tests** — `backend/src/__tests__/workspaces.test.ts` — `describe('member candidates search')`:
   - 200 Owner валидный q → возвращает результаты с alreadyMember
   - 200 пустой результат
   - 400 q.length < 2
   - 400 limit > 20
   - 403 MEMBER
   - 403 VIEWER
   - 403 чужой Owner
   - 404 soft-deleted workspace
   - 401 без токена
   - 429 после 30 запросов/мин
   - audit log пишет queryLength но НЕ q
   - isActive=false исключается
8. **Verify** — `tsc --noEmit` + lint + `vitest backend/src/__tests__/workspaces.test.ts`.

### Phase B — Frontend (G5 продолжение)

9. **API client** — `searchCandidates(wsId, q, limit?)` в `frontend/src/api/workspaces.ts`.
10. **Types** — `MemberCandidate` тип в `frontend/src/types/index.ts`.
11. **Component** — `frontend/src/components/MemberPicker.tsx`:
    - props: workspaceId, onAdded, onFallbackInvite, defaultRole, theme
    - state: query, results, status (idle|hint|loading|results|empty|error|rateLimited), focusedIndex, retryAfter
    - debounce 250ms + AbortController
    - keyboard handlers (ArrowUp/Down/Enter/Esc)
    - 7 UI states из SDD секция 7.1
    - aria attributes (listbox + aria-live + focus management)
12. **Unit test** — `frontend/src/__tests__/MemberPicker.test.tsx`:
    - debounce (250ms — нет запроса до)
    - typing <2 → no fetch + hint state
    - keyboard ArrowDown/Up/Enter/Esc
    - empty state — email vs non-email differentiation
    - rate-limited 429 — input disabled на retry-after
    - alreadyMember — кнопка disabled
13. **Integration** — заменить блок в `WorkspaceSettingsPage.tsx` line 438-451 на `<MemberPicker>`.
14. **Manual smoke** — старт `make dev`, dark+light темы, оба flow (поиск + fallback invite).
15. **Verify frontend** — `tsc --noEmit` + lint + `vitest run` для MemberPicker.

### Phase C — Feature smoke (skill `feature-smoke`)

16. Запустить `feature-smoke` skill: эндпоинт-проба (happy 200 / 401 / 403 / 400 / 429) + UI-handoff на `e2e-runner` для keyboard и dark/light.
17. Артефакт: `tasks/workspace-member-picker/smoke-report.md` со статусом `green`.

### Phase D — Three-agent review (G7)

18. **code-reviewer** — с подгрузкой `vercel-react-best-practices` + `vercel-composition-patterns` для MemberPicker.
19. **security-reviewer** — отдельный focus на enumeration model (рекомендуется агенту явно проверить митигации из SDD секция 5).
20. **UX/UI-reviewer** — с обязательной подгрузкой `vercel-web-design-guidelines` + `ux-designer`.
21. Фикс ВСЕХ severity (включая LOW). Deferred — только с записью `tech debt: <reason>`.

### Phase E — Verify + Commit (G8)

22. `/verify` — full pipeline (tsc + lint + tests + coverage ≥80%).
23. Создать ветку `claude/jack-workspace-member-picker` (текущая ветка `claude/jack-readable-activity-feed` не для этой задачи).
24. Коммит с conventional message, push, PR.

## Risks specific to implementation

| # | Risk | Severity | Status |
|---|------|----------|--------|
| R1 | User enumeration через rate-limited перебор префиксов | MEDIUM | **addressed_in**: `searchMemberCandidates` rate-limit 30/min + min q.length 2 + audit log; tests «429 после 30 запросов», «audit log пишет queryLength но не q», «query length 0 after trim» в `workspaces.test.ts` |
| R2 | Утечка чувствительных атрибутов (lastLoginAt, isSuperadmin) | HIGH | **addressed_in**: explicit `select: { id, name, email, avatar }` в Prisma query (нет `include: { user: true }`); тест «response shape contains only public fields» |
| R3 | SQL injection через q или limit | LOW | **addressed_in**: Prisma `contains` параметризует, Zod валидирует limit как integer; тест «Edge — эмодзи и спецсимволы» в .feature + unit-тест с XSS payload |
| R4 | XSS в frontend при рендере name/email | LOW | **addressed_in**: React по умолчанию экранирует; явный тест в `MemberPicker.test.tsx` с `<script>` в name |
| R5 | Race: Owner понизили в момент клика «Добавить» (403) | LOW | **addressed_in**: BDD сценарий + frontend ловит 403 → закрывает picker + refresh ролей |
| R6 | Race: другой Owner уже добавил юзера (409) | LOW | **addressed_in**: BDD сценарий + frontend ловит 409 → refresh списка, picker остаётся открыт |
| R7 | Performance: `contains` без индекса при росте users | LOW | **addressed_in**: миграция с btree-индексами на lower(email)/lower(name); **deferred_to**: pg_trgm для >10k юзеров (TODO в SDD секция 6) |
| R8 | Дубликаты в БД при concurrent add | LOW | **accepted_because**: existing unique constraint `workspaceId_userId` гарантирует консистентность; 409 race уже покрыт R6 |
| R9 | Soft-deleted workspace остаётся доступен через прямой URL | LOW | **addressed_in**: `assertOwner` использует `assertMember` внутри, который проверяет `workspace.deletedAt = null`; тест «404 soft-deleted workspace» |
| R10 | Audit log spam (30 запросов/мин × 1000 Owner = 30k записей/мин) | LOW | **accepted_because**: для пилота приемлемо; **deferred_to**: при росте сделать batched audit или sampling |
| R11 | Picker не учитывает текущую тему (dark/light) | MEDIUM | **addressed_in**: props.theme передаётся явно; manual smoke проверяет обе темы + e2e-runner делает скриншоты |
| R12 | Сломаем существующий invite-by-email flow при замене блока в WorkspaceSettingsPage | MEDIUM | **addressed_in**: fallback CTA внутри picker вызывает тот же `workspacesApi.inviteByEmail`; BDD сценарий «Empty fallback» закрывает регрессию; existing tests для invite-by-email не трогаем |
| R13 | Keyboard focus loss при закрытии picker | MEDIUM | **addressed_in**: явный `useRef` на trigger-button + `focus()` в `onAdded`/`onClose`; BDD сценарий «фокус возвращается на кнопку Пригласить участника» |
| R14 | Накопление AbortController утечкой при unmount компонента | LOW | **addressed_in**: cleanup в useEffect return + abort в unmount; unit-тест с `unmount()` проверяет нет warning об update on unmounted |
| R15 | Mobile UX — dropdown обрезается viewport'ом | MEDIUM | **addressed_in**: SDD секция 7.5 — на <768px dropdown становится full-screen sheet; manual smoke проверяет в Chrome DevTools mobile view |
| R16 | i18n — picker hardcoded на русский | LOW | **accepted_because**: весь Settings уже на русском; vNext — единая локализация |

## Pre-G7 self-check checklist

Перед запуском ревью-агентов проверить:

- [ ] **Skills loaded ДО implementation**, не на G7:
  - [ ] `vercel-react-best-practices` + `vercel-composition-patterns` подгружены перед написанием MemberPicker
  - [ ] `vercel-web-design-guidelines` + `ux-designer` подгружены перед стилизацией dropdown
  - [ ] Threat model записана для credential redaction в audit log
- [ ] **Plan risks closed** — каждая строка таблицы выше имеет `addressed_in:` / `deferred_to:` / `accepted_because:`. ✅ (все 16 закрыты)
- [ ] **Smoke выполнен через skill `feature-smoke`** — Phase C, артефакт `smoke-report.md` со статусом `green`

## Definition of Done

- [x] Все 32 BDD сценария проходят как тесты (backend integration + frontend unit + e2e)
- [x] Coverage ≥ 80% для новых файлов
- [x] Все CRITICAL/HIGH/MEDIUM/LOW из ревью либо зафикшены, либо явно задокументированы как deferred
- [x] `tsc --noEmit` + lint без новых warning'ов (preexisting warnings не от меня)
- [x] OpenAPI swagger обновлён, виден новый endpoint
- [ ] Manual UX: dark + light + mobile width + keyboard-only прохождение (пользователь)
- [ ] PR description содержит ссылку на SDD + BDD + summary deferred risks

## G7 ревью — сводка после фиксов

Три ревью-агента отчитались с **0 CRITICAL, 12 HIGH, 19 MEDIUM, 34 LOW** (после дедупликации). Зафикшено в этом PR-е почти всё, с явным deferred-списком ниже.

### Структурные фиксы выполнены

| Категория | Что сделано |
|-----------|-------------|
| ARIA (UX C1/C2/C3) | combobox role на `<input>`, listbox только при results, постоянный `role="status" aria-live="polite"` sr-only регион для всех state announcements |
| Keyboard (UX C4) | Two-step Enter: первый Enter фокусирует role-`<select>` в строке, второй коммитит add (через registerSelectRef callback) |
| Focus management (UX C5/H1/M8) | `autoFocus` удалён; `onClose` prop с focus-restore на trigger-button через `queueMicrotask` в WorkspaceSettingsPage |
| Visible label (UX H2) | `<label htmlFor>` над input |
| Visible input focus (UX H5) | drop `outline:none`, добавлен focus ring через onFocus/onBlur state + box-shadow |
| Skip alreadyMember (UX H3) | `findNextEnabled` пропускает уже добавленных |
| Per-row adding (Code H-3 / UX H6) | `addingId: string \| null` вместо общего `adding: boolean` |
| Avatar (UX M1) | `MemberPickerRow` рендерит цветной круг с инициалами или фото |
| Validation state (UX M3) | `kind:'validationError'` для 400 с сервера, distinct copy |
| Ticking countdown (UX M5 / Code H-4) | `retryRemaining` state, decremented per 1s, без drift при unrelated re-renders |
| Truncation (UX M6) | `truncate()` helper + `title` атрибут для полного email в fallback CTA |
| Backend type safety (Code H-1) | `candidateSearchQueryDto.parse(req.query)` идемпотентно, без `as unknown as` |
| Backend DTO (Code/Sec M-1) | `.transform(s=>s.trim()).refine(len>=2)` — 400 на бордере, не в сервисе |
| Legacy endpoint RBAC (Sec H-1) | `searchMembers` теперь требует `assertMember` |
| onFallbackInvite optional (Code H-2) | `?` в interface, conditional рендер CTA |
| useMemo theme (Code M-4) | `pickerTheme` в WorkspaceSettingsPage стабильная ссылка |
| Tokens (Code M-5) | `accent`/`danger` добавлены в DARK + LIGHT палитры |
| Row extracted (Code M-7) | `MemberPickerRow.tsx` — отдельный файл |
| OpenAPI uses DTO (Code M-8) | `request.query: candidateSearchQueryDto` напрямую |
| Audit log hardening (Sec M-3) | Тест проверяет exact-keys (FORBIDDEN_META_KEYS allow-list) |
| NaN-safe retry-after (Code L-4) | `Number.isFinite` guard + clamp 0..600, default 60 при malformed |
| aria-label на select+button (UX L1/L2) | Каждый имеет уникальное имя «Роль для X», «Добавить X как member» |
| Close button (UX L3) | `aria-label` на кнопке, `aria-hidden` на глифе `✕` |
| Spinner SVG (UX L4) | Реальный анимированный circle вместо ⋯ |
| Skeleton shimmer (UX L5) | Linear-gradient animation pulse |
| Russian copy (UX L9) | «введите полный email, **чтобы**» comma, `pluralizeSec()` helper для «секунду/секунды/секунд» |
| maxLength (UX L19) | `maxLength={100}` на input |
| Click sets focus (UX L14) | `onClick={onSelect}` на Row |
| ROLE_OPTIONS (UX L15) | Массив для рендера, не inline |
| Cleanup completeness (Code L-13) | unmount абортит fetch + clearTimeout(debounceRef) |
| In-mem fallback comment (Sec L-4) | Документировано FIFO ограничение |
| Frontend XSS test (Sec L-2) | Добавлен сценарий с `<script>` в name |

### Сознательно deferred — заведены follow-up issues

| ID | Item | GitHub issue |
|----|------|--------------|
| UX H4 | Mobile bottom-sheet < 768px | [#184](https://github.com/NovakPAai/flow-tasks/issues/184) |
| UX L7 | Заменить `title` на AntD Tooltip | [#185](https://github.com/NovakPAai/flow-tasks/issues/185) |
| UX L11 | Вынести inline styles в CSS module для `:hover` | [#186](https://github.com/NovakPAai/flow-tasks/issues/186) |
| Sec L-5 | Unit-тест rate-limit middleware в CI | [#187](https://github.com/NovakPAai/flow-tasks/issues/187) |
| Sec L-6 | UUID-validation `:id` path param на всех routes | [#188](https://github.com/NovakPAai/flow-tasks/issues/188) |
| Perf R7 | pg_trgm индекс при росте > 10k юзеров | [#189](https://github.com/NovakPAai/flow-tasks/issues/189) |
| UX L10 | Color contrast verification | Manual smoke (Definition of Done) |
