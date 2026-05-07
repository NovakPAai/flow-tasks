---
id: gap-12-workflow-settings-unlocked
type: gap-fix
priority: P1
status: draft
---

# Spec: Workflow Settings — страница настроек заблокирована (ghost-lock)

## Intent
Страница `/settings?tab=workflows` отображается как заблокированная для OWNER'а воркспейса из-за silent `.catch(() => {})` при загрузке участников: ошибка API скрывается, `members` остаётся пустым, `isOwner` = false навсегда.

## Root Cause

```typescript
// WorkspaceSettingsPage.tsx:183–187
Promise.all([
  workspacesApi.listMembers(wsId),
  labelsApi.listLabels(wsId),
  wfApi.listWorkflows(wsId),
]).then(([m, l, wfs]) => { setMembers(m); setLabels(l); setWorkflows(wfs); })
  .catch(() => {}); // ← молчаливо проглатывает ошибку

// :190–191
const myRole = members.find((m) => m.userId === currentUser?.id)?.role;
const isOwner = myRole === 'OWNER';  // ← false когда members = []
```

При сетевой ошибке / 403 / 500 `members` остаётся `[]`.
`members.find(...)` возвращает `undefined` → `isOwner = false` → весь tab workflows рендерится read-only без единого сообщения об ошибке.

**Вторичная гипотеза:** `currentUser?.id` ещё не заполнен в момент render (AuthContext async). Если `currentUser` разрешается позже отдельным setState, `isOwner` фиксируется в `false` до следующего render цикла.

## BDD Scenarios

```gherkin
Feature: Workflow Settings — доступность управления для OWNER

  Background:
    Given я авторизован как пользователь с ролью OWNER в воркспейсе
    And я нахожусь на /w/<slug>/settings?tab=workflows

  Scenario: страница загружается успешно — кнопки активны
    When API /members, /labels, /workflows отвечают 200
    And данные загружены
    Then кнопка "Создать workflow" активна и кликабельна
    And у каждого workflow есть активные кнопки "Редактировать" и "Удалить"

  Scenario: страница в процессе загрузки — skeleton вместо заблокированных контролов
    When запросы к API ещё выполняются
    Then видны skeleton-индикаторы загрузки
    And кнопки управления отсутствуют (не показываются disabled)

  Scenario: сетевая ошибка или 500 — показывается сообщение с retry
    When API /members возвращает 500 или сетевую ошибку
    Then показывается сообщение "Не удалось загрузить данные — попробуйте обновить страницу"
    And кнопка "Обновить" перезапускает запрос
    And кнопок редактирования нет (не можем определить роль)

  Scenario: VIEWER открывает вкладку workflows
    Given я авторизован с ролью VIEWER в воркспейсе
    When страница загружена успешно
    Then кнопка "Создать workflow" отсутствует
    And у каждого workflow нет кнопок редактирования
    And показывается подсказка "Редактирование workflow доступно только владельцу воркспейса"

  Scenario: MEMBER открывает вкладку workflows
    Given я авторизован с ролью MEMBER в воркспейсе
    When страница загружена успешно
    Then кнопка "Создать workflow" отсутствует
    And у каждого workflow нет кнопок редактирования
    And показывается подсказка "Редактирование workflow доступно только владельцу воркспейса"

  Scenario: редактирование workflow работает end-to-end
    Given страница загружена и isOwner = true
    When я нажимаю "Редактировать" на workflow "Default"
    Then открывается WorkflowEditor
    And все поля доступны для ввода
    When я меняю название и сохраняю
    Then workflow обновляется в списке без перезагрузки страницы
```

## SDD Contracts

```typescript
// WorkspaceSettingsPage.tsx — изменения

// 1. Добавить состояние загрузки и ошибки
const [loadError, setLoadError] = useState<string | null>(null);
const [loadingData, setLoadingData] = useState(true);

// 2. Заменить .catch(() => {}) на явную обработку
useEffect(() => {
  if (!wsId) return;
  setLoadingData(true);
  setLoadError(null);
  Promise.all([
    workspacesApi.listMembers(wsId),
    labelsApi.listLabels(wsId),
    wfApi.listWorkflows(wsId),
  ])
    .then(([m, l, wfs]) => { setMembers(m); setLabels(l); setWorkflows(wfs); })
    .catch((err) => {
      const status = (err as { status?: number })?.status;
      // 403 — роль определена, прав нет; не показываем retry
      // 5xx / network — роль неизвестна, нужен retry
      setLoadError(status === 403 ? null : 'Не удалось загрузить данные — попробуйте обновить страницу');
      logger.warn('WorkspaceSettingsPage: load failed', { error: String(err), status });
    })
    .finally(() => setLoadingData(false));
}, [wsId]);

// 3. Вычислять isOwner только после загрузки
const myRole = loadingData ? undefined : members.find((m) => m.userId === currentUser?.id)?.role;
const isOwner = myRole === 'OWNER';

// 4. Guard в renderWorkflows() — три состояния
if (loadingData) return <WorkflowSettingsSkeleton />;
if (loadError)   return <ErrorRetry message={loadError} onRetry={reload} />;
// Успешно загружено, но не OWNER — показываем read-only + пояснение
if (!isOwner) return <WorkflowsReadOnly workflows={workflows} />;

// WorkflowEditor.tsx — без изменений (isOwner prop корректен)
```

```typescript
// WorkflowsReadOnly — список workflow без кнопок + подсказка для не-OWNER
function WorkflowsReadOnly({ workflows }: { workflows: Workflow[] }) {
  return (
    <div>
      <p style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>
        Редактирование workflow доступно только владельцу воркспейса
      </p>
      {workflows.map(wf => (
        <div key={wf.id} style={{ padding: '12px 0', borderBottom: `1px solid ${c.border}` }}>
          <span>{wf.name}</span>
          {wf.isDefault && <span style={{ color: c.muted, marginLeft: 8 }}>Default</span>}
        </div>
      ))}
    </div>
  );
}

// ErrorRetry — только для 5xx / network
function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: 24, color: c.muted, textAlign: 'center' }}>
      <p>{message}</p>
      <button onClick={onRetry}>Обновить</button>
    </div>
  );
}
```

## Scope
- `frontend/src/pages/WorkspaceSettingsPage.tsx` — заменить `.catch(() => {})`, добавить `loadingData` / `loadError` state, skeleton и ErrorRetry
- Убедиться, что `isOwner` вычисляется только после того, как `loadingData = false` И `currentUser` не null

## Out of Scope
- Изменение RBAC (MEMBER по-прежнему не может редактировать workflows)
- Новые API-эндпоинты
- WorkflowEditor.tsx — props не меняются

## Constraints
- `currentUser` берётся из `useAuth()` — нужно проверить, что AuthContext заполнен к моменту render или добавить проверку `!currentUser` в условие загрузки
- Существующие `handleCreateWorkflow` / `handleDeleteWorkflow` уже имеют свой `.catch` — не трогать
- `Promise.all` — если падает ANY запрос, показываем ошибку по всему блоку (не partial)

## Acceptance Criteria
- [ ] При успешной загрузке OWNER видит активные кнопки "Создать workflow" и "Редактировать"
- [ ] При загрузке показывается skeleton (не disabled-кнопки)
- [ ] При 5xx / сетевой ошибке — сообщение + кнопка "Обновить", не ghost-lock
- [ ] VIEWER / MEMBER видят список workflow + подсказку "Редактирование workflow доступно только владельцу воркспейса"
- [ ] Подсказка НЕ показывается при технической ошибке загрузки (не путать "нет прав" с "не загрузилось")
- [ ] E2E: `admin@flowtask.dev` → `/settings?tab=workflows` → кнопка "Создать workflow" `toBeEnabled()`
- [ ] E2E: `user@flowtask.dev` (MEMBER) → `/settings?tab=workflows` → кнопка "Создать workflow" отсутствует
