---
id: gap-22-workspace-settings-always-accessible
type: gap-fix
priority: P2
status: draft
source: ux-review-2026-05-08
pr: —
---

# Spec: Кнопка «Настройки пространства» недоступна вне активного воркспейса

## Intent
Кнопка «Настройки workspace» в меню аватара отображается только при `current !== null`
(т.е. только на страницах `/w/:slug/*`). На страницах `/workspaces`, `/my-tasks`,
`/profile`, `/admin/users` кнопка скрыта — пользователь не может перейти
к настройкам без предварительной навигации в нужный воркспейс.

Дополнительно: метка «workspace» — англицизм, заменяем на «пространства».

## Root Cause
`AppLayout.tsx` — `UserMenu` получает `hasSettings={!!current}`.  
Кнопка условна на `hasSettings`, которая `false` вне воркспейс-роутов.

## Desired Behavior
1. **В воркспейсе** (`current` задан) — кнопка кликает прямо на
   `/w/{current.slug}/settings`.
2. **Вне воркспейса** (`current` не задан) — кнопка открывает встроенный
   пикер пространств, после выбора — навигация на `/w/{slug}/settings`.
3. Пикер — раскрывающийся подсписок внутри дропдауна меню аватара (без отдельного модала).
4. Кнопка переименована: «Настройки пространства» (вместо «Настройки workspace»).

## BDD Scenarios

```gherkin
Feature: Кнопка «Настройки пространства» в меню аватара

  Background:
    Given пользователь аутентифицирован
    And у пользователя есть пространства: "Разработка" (slug: dev), "Маркетинг" (slug: mkt)

  Scenario: Кнопка видна на странице пространства и ведёт на его настройки
    Given пользователь находится на странице /w/dev
    When пользователь нажимает на аватарку
    Then в меню отображается кнопка «Настройки пространства»
    When пользователь нажимает «Настройки пространства»
    Then пользователь перенаправляется на /w/dev/settings

  Scenario: Кнопка видна на странице списка пространств и открывает пикер
    Given пользователь находится на странице /workspaces
    When пользователь нажимает на аватарку
    Then в меню отображается кнопка «Настройки пространства»
    When пользователь нажимает «Настройки пространства»
    Then в дропдауне раскрывается список пространств пользователя
    When пользователь выбирает «Маркетинг»
    Then пользователь перенаправляется на /w/mkt/settings

  Scenario: Кнопка видна на /my-tasks и открывает пикер
    Given пользователь находится на странице /my-tasks
    When пользователь нажимает на аватарку
    Then в меню отображается кнопка «Настройки пространства»
    When пользователь нажимает «Настройки пространства»
    Then в дропдауне раскрывается список пространств пользователя

  Scenario: У пользователя нет пространств — кнопка скрыта
    Given у пользователя нет пространств
    When пользователь нажимает на аватарку
    Then кнопка «Настройки пространства» не отображается

  Scenario: Пикер недоступен пользователю с ролью ниже OWNER в выбранном пространстве
    Given пользователь является MEMBER (не OWNER) в пространстве "Разработка"
    And пользователь находится на странице /workspaces
    When пользователь нажимает «Настройки пространства» → выбирает «Разработка»
    Then пользователь перенаправляется на /w/dev/settings
    And WorkspaceSettingsPage отображает сообщение «Доступно только владельцу»
```

## SDD Contracts

```typescript
// AppLayout.tsx — UserMenu props (изменения)

// Добавляем: workspaces (для пикера), убираем: hasSettings
function UserMenu({
  user, onLogout, onProfile, onSettings, workspaces, current,
  onAdminUsers, isSuperadmin, navBg, border, textPrimary, textMuted, onClose
}: {
  // ...
  workspaces: Array<{ id: string; name: string; slug: string }>;
  current: { id: string; name: string; slug: string } | null;
  onSettings: (slug: string) => void;  // принимает slug выбранного ws
  // hasSettings: boolean;  ← удалить
  // ...
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasWorkspaces = workspaces.length > 0;

  function handleSettingsClick() {
    if (current) {
      onSettings(current.slug);    // прямая навигация
    } else {
      setPickerOpen(v => !v);      // раскрыть пикер
    }
  }
  // ...
  // Рендер кнопки (всегда, если hasWorkspaces):
  {hasWorkspaces && (
    <>
      <button onClick={handleSettingsClick}>Настройки пространства</button>
      {pickerOpen && !current && (
        <WorkspacePickerInline
          workspaces={workspaces}
          onSelect={(slug) => { onSettings(slug); onClose(); }}
        />
      )}
    </>
  )}
}

// AppLayout.tsx — вызов UserMenu
<UserMenu
  workspaces={workspaces}
  current={current}
  onSettings={(slug) => navigate(`/w/${slug}/settings`)}
  // hasSettings: удалить
  // ...
/>
```

## Scope
- `frontend/src/components/AppLayout.tsx` — `UserMenu` + вызов

## Out of Scope
- Создание нового пространства из меню
- Настройки пространства для MEMBER / VIEWER (редирект на существующую страницу — её дело)
- Мобильная версия (адаптация по существующим breakpoints)

## Acceptance Criteria
- [ ] Кнопка «Настройки пространства» отображается на всех приватных страницах, если у пользователя есть ≥1 пространство
- [ ] На воркспейс-странице — прямая навигация без пикера
- [ ] Вне воркспейса — раскрывается пикер, после выбора — навигация
- [ ] Лейбл «Настройки workspace» нигде не отображается (переименован)
- [ ] E2E: smoke тест на оба сценария (с current / без current)
