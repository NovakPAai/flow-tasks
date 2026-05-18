# Gherkin specs для системного feature-permissions
# Связанные SDD: docs/design/feature-permissions.md (G2-1, approved 2026-05-18)
# Покрытие: 4 пользовательских flow × 6 категорий (happy/empty/loading/error/keyboard/edge-data)

# ─── Feature 1: Системные feature toggles (superadmin) ────────────────────────

Feature: Системные feature toggles в админке
  Как суперадмин я хочу включать и выключать модули продукта
  для всей инсталляции

  Background:
    Given я залогинен как пользователь с isSuperadmin=true
    And я открыл "/admin" → вкладка "Системные фичи"

  # Happy path
  Scenario: Выключить локальную регистрацию
    Given таблица system_features содержит запись LOCAL_REGISTRATION с enabled=true
    When я переключаю toggle "Локальная регистрация" в off
    And подтверждаю в confirmation modal
    Then PATCH /api/admin/system-features/LOCAL_REGISTRATION возвращает 200 c {enabled:false}
    And toast "Фича выключена" появляется
    And запрос POST /api/auth/register возвращает 404
    And UI-кнопка "Зарегистрироваться" на /login исчезает после next page load

  # Empty state
  Scenario: Первый заход — все фичи включены
    Given таблица system_features пустая (свежая инсталляция)
    When страница загружается
    Then GET /api/admin/system-features возвращает все 8 кодов с enabled=true (defaults)
    And все 8 toggle отображаются в положении on

  # Loading state
  Scenario: Skeleton при загрузке
    Given медленная сеть (>500ms)
    When страница вкладки "Системные фичи" открывается
    Then 8 skeleton-строк отображаются
    And toggle disabled пока запрос не завершился
    And после ответа skeleton заменяется на реальные строки

  # Error state
  Scenario: PATCH падает — toggle откатывается
    Given фича MFA сейчас enabled=true
    When я переключаю toggle "MFA / TOTP" в off
    And бэкенд возвращает 500
    Then toggle возвращается в положение on (optimistic rollback)
    And toast "Не удалось сохранить, попробуйте ещё раз" появляется
    And аудит-запись об ошибке записана в audit_log

  # Keyboard
  Scenario: Tab + Space навигация
    When я нажимаю Tab несколько раз
    Then фокус последовательно проходит через все 8 toggle
    And visible focus ring виден на каждом
    When я нажимаю Space на focused toggle
    Then confirmation modal открывается
    And фокус автоматически переходит на кнопку "Отмена"
    When я нажимаю Escape
    Then modal закрывается без сохранения
    And toggle остаётся в исходном состоянии

  # Edge data: confirmation для зависимостей
  Scenario: Выключение MFA с активными пользователями
    Given 12 пользователей имеют активную TOTP-настройку
    When я переключаю "MFA / TOTP" в off
    Then confirmation modal показывает "12 пользователей потеряют возможность входа через TOTP"
    And aria-live polite объявляет содержимое modal'я
    And кнопка "Подтвердить" имеет aria-describedby с этим текстом

# ─── Feature 2: Role presets (superadmin) ─────────────────────────────────────

Feature: Управление пресетами ролей
  Как суперадмин я хочу создавать кастомные роли с гибким набором пермиссий

  Background:
    Given я залогинен как суперадмин
    And я открыл "/admin" → вкладка "Роли"

  # Happy
  Scenario: Создание кастомной WORKSPACE-роли
    When я нажимаю "Создать роль"
    And ввожу name="qa-reviewer", displayName="QA Reviewer", scope="WORKSPACE"
    And отмечаю чекбоксы TASK_READ, TASK_UPDATE, COMMENT_CREATE, COMMENT_READ
    And нажимаю "Сохранить"
    Then POST /api/admin/role-presets возвращает 201
    And новая роль появляется в списке с isSystem=false
    And видна badge "WORKSPACE"

  # Empty
  Scenario: Только системные роли при первом заходе
    Given БД содержит только 4 системные роли (system:owner/member/viewer/admin)
    When страница "Роли" открывается
    Then 4 строки отображаются с замочком isSystem
    And empty-state-баннер "Кастомных ролей пока нет — создайте первую" + CTA

  # Loading
  Scenario: Skeleton списка ролей
    Given медленная сеть
    When страница открывается
    Then 5 skeleton-строк отображаются
    And "Создать роль" кнопка disabled

  # Error: duplicate name
  Scenario: Имя занято
    Given существует роль с name="qa-reviewer"
    When я создаю новую с тем же name
    Then POST возвращает 409 с code="DUPLICATE_ROLE_NAME"
    And inline-ошибка под полем name "Имя занято"
    And aria-invalid="true" на input
    And focus переходит на input

  # Keyboard: permission grid
  Scenario: Навигация по чекбоксам пермиссий
    Given форма создания роли открыта
    When я нажимаю Tab до permission grid
    Then фокус на первом чекбоксе TASK_READ
    When я нажимаю Arrow Down 3 раза
    Then фокус на TASK_DELETE
    When я нажимаю Space
    Then чекбокс отмечается
    And aria-checked="true" обновляется

  # Edge: system role protection
  Scenario: Системную роль нельзя удалить
    Given фокус на строке "system:owner"
    Then кнопка "Удалить" в этой строке disabled
    And tooltip "Системные роли защищены от удаления"
    And aria-disabled="true"

  # Edge: scope WORKSPACE не принимает ADMIN_*
  Scenario: Запрет ADMIN-пермиссий в WORKSPACE-роли
    When я создаю роль с scope="WORKSPACE" и пытаюсь отметить ADMIN_USERS
    Then чекбокс ADMIN_USERS отсутствует в гриде для scope=WORKSPACE
    And фильтр пермиссий показывает только WORKSPACE-scoped коды (~30 из 40)

# ─── Feature 3: User permission overrides (superadmin) ────────────────────────

Feature: Индивидуальные пермиссии поверх роли

  Background:
    Given пользователь Аня имеет globalRolePresetId=system:member
    And я залогинен как суперадмин на /admin → User detail (Аня)

  # Happy
  Scenario: GRANT override
    When я нажимаю "Добавить override"
    And выбираю permission=TASK_DELETE, type=GRANT, workspaceId=null (global)
    And нажимаю "Сохранить"
    Then POST /api/admin/users/Аня/permissions возвращает 201
    And строка появляется в списке overrides с бейджем "GRANT global"
    And эффективная пермиссия Аня.TASK_DELETE = true (через GRANT)

  # Empty
  Scenario: Нет overrides
    Given у Ани в user_permissions ноль записей
    Then блок "Overrides" показывает empty-state "Индивидуальных правок нет — действует роль"

  # Loading
  Scenario: Загрузка user detail
    When страница пользователя открывается
    Then блок "Роль" + блок "Overrides" показывают skeleton параллельно

  # Error
  Scenario: Conflict при дубликате
    Given Аня уже имеет override TASK_DELETE GRANT global
    When я пытаюсь добавить ещё один TASK_DELETE GRANT global
    Then POST возвращает 409 с code="DUPLICATE_OVERRIDE"
    And toast "Этот override уже существует"

  # Keyboard
  Scenario: Удаление override через клавиатуру
    Given фокус на строке overrides
    When я нажимаю Delete
    Then confirmation alertdialog открывается
    And фокус на кнопке "Отмена"
    When я нажимаю Tab → Enter на "Подтвердить"
    Then DELETE возвращает 204
    And строка исчезает с aria-live polite "Override удалён"

  # Edge: REVOKE того что не дано
  Scenario: REVOKE пермиссии которой нет в роли — no-op
    Given Аня в роли system:viewer (без COMMENT_CREATE)
    When я добавляю REVOKE COMMENT_CREATE
    Then запись создаётся (для аудита) но эффективная пермиссия не меняется
    And badge "no effect" появляется рядом с записью
    And tooltip "Этой пермиссии и так нет в текущей роли"

# ─── Feature 4: Workspace feature toggles (owner) ─────────────────────────────

Feature: Workspace owner управляет фичами своего пространства

  Background:
    Given workspace "Команда А" существует
    And я залогинен как owner этого workspace
    And я открыл WorkspaceSettings → вкладка "Фичи"

  # Happy
  Scenario: Выключить комментарии в workspace
    Given фича WS_COMMENTS включена
    When я переключаю toggle "Комментарии" в off
    And подтверждаю в confirmation modal
    Then PATCH /api/workspaces/:id/features/WS_COMMENTS возвращает 200
    And toast "Комментарии выключены"
    And в task drawer comment editor исчезает
    And существующие комментарии остаются видимыми (read-only)

  # Empty
  Scenario: Новый workspace — все фичи on
    Given свежий workspace без записей workspace_features
    When страница "Фичи" открывается
    Then все 9 toggle отображаются в положении on (defaults)

  # Loading
  Scenario: Skeleton фич workspace
    When страница "Фичи" открывается
    Then 9 skeleton-строк
    And "Сохранить" disabled

  # Error
  Scenario: PATCH падает
    When я переключаю "Метки" в off
    And бэкенд возвращает 500
    Then toggle возвращается в on
    And toast "Не удалось сохранить" с retry кнопкой

  # Keyboard
  Scenario: Toggle через Space
    When фокус на toggle "Bulk операции"
    And я нажимаю Space
    Then confirmation modal открывается
    When я нажимаю Escape
    Then modal закрывается, toggle не меняется

  # Edge: system-disabled overrides workspace
  Scenario: Системно выключенная фича блокирует workspace toggle
    Given системно SystemFeature.EMAIL_NOTIFICATIONS = false
    When страница "Фичи" workspace открывается
    Then в этом списке нет WS-toggle EMAIL (или toggle disabled с бейджем "Выключено администратором")
    And tooltip "Свяжитесь с администратором инсталляции чтобы включить"
    And aria-disabled="true"

  # Edge: бизнес-логика последствий
  Scenario: Выключить экспорт с активными задачами
    Given в workspace 1200 задач
    When я выключаю "Экспорт CSV"
    Then confirmation modal показывает "Пользователи больше не смогут экспортировать данные. 1200 задач остаются в системе."
    And кнопки "Отмена" и "Подтвердить" в фокус-trap

# ─── Feature 5: Назначение роли участнику workspace (owner) ────────────────────

Feature: Owner назначает RolePreset участнику workspace

  Background:
    Given workspace "Команда Б" с 5 участниками
    And я owner
    And в БД есть кастомная роль "qa-reviewer" (scope=WORKSPACE)
    And я открыл WorkspaceSettings → Участники

  # Happy
  Scenario: Изменить роль участника
    When я кликаю на dropdown "Роль" у участника Бориса
    Then список содержит: system:owner, system:member, system:viewer, qa-reviewer
    When я выбираю "qa-reviewer"
    Then PATCH /api/workspaces/:id/members/Борис { rolePresetId } возвращает 200
    And строка обновляется с новым названием роли
    And aria-live polite "Роль Бориса изменена на QA Reviewer"

  # Edge: нельзя выключить себе последнюю owner-роль
  Scenario: Защита от самоблокировки
    Given я единственный owner workspace
    When я пытаюсь изменить свою роль на system:member
    Then PATCH возвращает 409 с code="LAST_OWNER_PROTECTED"
    And dropdown откатывает selection
    And toast "Назначьте другого owner перед сменой своей роли"
