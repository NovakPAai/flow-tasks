# Gherkin specs для per-board ACL и гостевого доступа
# Связанные SDD: docs/design/board-acl.md (G2-2, approved 2026-05-18)
# Покрытие: 5 flow × 6 категорий (happy/empty/loading/error/keyboard/edge-data)

# ─── Feature 1: Board access modal (owner / BOARD_MANAGE_ACL) ─────────────────

Feature: Owner управляет доступом к доске
  Как владелец workspace я хочу выдавать и забирать доступ к конкретной доске

  Background:
    Given workspace "Команда А" с 30 участниками
    And я owner
    And существует public board "DEV" в этом workspace

  # Happy
  Scenario: Открыть modal и увидеть все workspace members
    When я открываю board "DEV"
    And нажимаю кнопку "Доступ" в header
    Then modal "Доступ к доске" открывается
    And список содержит все 30 workspace members
    And для каждого виден badge источника:
      | Я (Owner)            | owner       |
      | Боб (system:member)  | workspace   |
      | Аня (BoardMember override system:viewer) | board-override |
      | Костя (BoardMember null) | board-denied |

  # Happy: апгрейд роли для участника
  Scenario: Дать Боре роль system:owner только на эту доску
    Given Боря — system:member в workspace
    When в modal я выбираю в dropdown Бори → "system:owner"
    Then POST /api/boards/DEV/members { userId:Боря, rolePresetId:system:owner.id } → 201
    And строка обновляется, badge меняется на "board-override"
    And optimistic UI отражает изменение мгновенно
    And aria-live polite "Роль Бори на доске изменена на Owner"

  # Happy: запрет доступа
  Scenario: Явно запретить Маше доступ
    Given Маша — system:member в workspace
    When я выбираю в её dropdown "Запретить доступ"
    Then POST /api/boards/DEV/members { userId:Маша, rolePresetId:null } → 201
    And badge меняется на "board-denied"
    And после refresh Маша больше не видит board "DEV" в sidebar

  # Empty
  Scenario: Свежая public доска без overrides
    Given у board "DEV" ноль записей в board_members
    When я открываю modal
    Then 30 строк показаны
    And у каждой источник="workspace"
    And баннер empty-info "Все участники видят доску по умолчанию. Добавьте override чтобы изменить роль или запретить доступ."

  # Loading
  Scenario: Skeleton при открытии modal
    Given медленная сеть
    When я кликаю "Доступ"
    Then modal открывается с 10 skeleton-строк
    And фокус trap активирован
    And dropdown-ы disabled

  # Error
  Scenario: Сохранение роли падает
    When я меняю роль у Бори
    And бэкенд возвращает 500
    Then dropdown откатывает selection
    And inline-toast "Не удалось сохранить роль для Бори"
    And строка не меняется в БД (никакой partial-state)

  # Keyboard
  Scenario: Полная клавиатурная навигация
    When я открываю modal
    Then фокус на input "Поиск"
    When я нажимаю Tab
    Then фокус переходит на dropdown первой строки
    When я нажимаю Enter
    Then dropdown открывается
    When я нажимаю Arrow Down 2 раза → Enter
    Then выбирается второй вариант
    When я нажимаю Escape
    Then если есть unsaved confirmation → modal "Закрыть без сохранения?"
    Then если нет — modal закрывается

  # Edge: 500+ участников
  Scenario: Виртуальный скролл и поиск
    Given workspace с 500 участниками
    When я открываю modal
    Then рендерится только видимое окно (react-window pattern)
    When я ввожу "ан" в поиск
    Then список фильтруется до участников с "ан" в name или email
    And пустой результат → empty-state "Никого не найдено"

  # Edge: owner нельзя забанить
  Scenario: Попытка denied для другого owner workspace
    Given Леша — second owner workspace
    When я выбираю в его dropdown "Запретить доступ"
    Then POST возвращает 409 c code="CANNOT_DENY_OWNER"
    And dropdown откатывает selection
    And toast "Owner workspace всегда имеет доступ"

# ─── Feature 2: Private board toggle ──────────────────────────────────────────

Feature: Переключение public/private

  Background:
    Given workspace с board "FIN"
    And я owner

  # Happy: public → private с подтверждением
  Scenario: Сделать доску приватной с подтверждением
    Given в FIN сейчас isPrivate=false и 50 workspace members имеют доступ
    And я добавил себя + 2 коллег в BoardMember (3 explicit member)
    When я переключаю toggle "Приватная доска" в modal "Доступ"
    Then confirmation alertdialog "47 участников потеряют доступ. Продолжить?"
    And фокус на кнопке "Отмена"
    When я подтверждаю
    Then PATCH /api/boards/FIN { isPrivate:true } → 200
    And после refresh у тех 47 board "FIN" исчезает из sidebar

  # Error: переключение в private без members
  Scenario: Private без BoardMember блокируется
    Given в FIN ноль board_members
    When я переключаю "Приватная доска" в on
    Then PATCH возвращает 409 c code="PRIVATE_BOARD_NEEDS_MEMBER"
    And toggle откатывается
    And toast "Сначала добавьте хотя бы одного участника"

  # Happy: создать сразу приватную через форму
  Scenario: Чекбокс "Приватная" при создании доски
    Given я открыл форму "Создать доску"
    When я отмечаю чекбокс "Приватная"
    And ввожу name="Секреты", prefix="SEC"
    And нажимаю "Создать"
    Then POST /api/workspaces/:id/boards { isPrivate:true, ... } → 201
    And в той же транзакции creator добавлен в board_members с rolePresetId=system:owner
    And остальные workspace members не видят "Секреты" в sidebar

  # Edge: переключение private→public
  Scenario: Снять приватность
    Given board "FIN" isPrivate=true с 3 board_members
    When я переключаю toggle в off
    Then PATCH возвращает 200
    And confirmation "Доска станет видна всем участникам workspace"
    And board_members остаются (для возможного возврата в private)

# ─── Feature 3: Гость к одной доске (auto-create WorkspaceMember) ─────────────

Feature: Owner добавляет внешнего пользователя как гостя к одной доске

  Background:
    Given workspace "Команда А"
    And я owner
    And в системе уже есть user Лена с email="lena@external.com" но она НЕ в workspace
    And я открыл modal "Доступ" board "DEV"

  # Happy: добавление по email
  Scenario: Добавить гостя по email
    When я ввожу "lena@external.com" в поиск
    And нажимаю "Добавить как гостя" в результатах
    And выбираю роль "system:member"
    Then POST /api/boards/DEV/members { email:"lena@external.com", rolePresetId:system:member.id } → 201
    And в транзакции:
      | таблица            | действие                                       |
      | workspace_members  | INSERT (userId=Лена, isGuest=true)             |
      | board_members      | INSERT (boardId=DEV, userId=Лена, role=member) |
    And email-уведомление с приглашением отправлено Лене
    And строка появляется в списке с бейджем "Гость"

  # Happy: гость залогинился — видит только свою доску
  Scenario: Гость видит ограниченный workspace
    Given Лена залогинилась
    When она открывает приложение
    Then GET /api/workspaces возвращает workspace "Команда А" с пометкой isGuest=true
    And в sidebar Boards отображается только "DEV"
    And public boards "OPS", "QA" не видны
    And в topbar нет ссылки "Настройки workspace"
    And попытка прямого перехода на /workspaces/:id/settings → 403

  # Happy: My Tasks гостя
  Scenario: Гость в My Tasks
    Given Лена назначена исполнителем 3 задач на board "DEV"
    And ещё 5 задач назначено ей на boards к которым доступа нет (но в FIN gap случай — но раз она guest, она не должна быть assigneeId там — но если кто-то это сделал)
    When она открывает /my-tasks
    Then список содержит только 3 задачи с board "DEV"
    And задачи с других досок отфильтрованы серверным GET /api/tasks/my (через canAccessBoard)

  # Loading: skeleton sidebar гостя
  Scenario: Загрузка интерфейса гостя
    Given медленная сеть
    When Лена открывает приложение
    Then sidebar отображает 1 skeleton-строку (а не дефолтные 5 для обычного member)
    And после загрузки видна только "DEV"

  # Error: гость пытается зайти на закрытую доску по URL
  Scenario: Прямой URL на чужую доску
    When Лена открывает /boards/OPS-id
    Then GET /api/boards/OPS-id возвращает 403 c code="BOARD_ACCESS_DENIED"
    And UI показывает страницу "У вас нет доступа к этой доске"
    And ссылка "Вернуться к моей доске"

  # Keyboard: invite-flow
  Scenario: Owner добавляет гостя через клавиатуру
    Given фокус на input поиска в modal
    When я ввожу email и нажимаю Enter
    Then в dropdown появляется опция "Добавить как гостя — lena@external.com"
    When я нажимаю Tab → Enter
    Then открывается role-picker с фокусом на первой роли
    When я нажимаю Enter на system:member
    Then гость создан, фокус возвращается на input

  # Edge: активность гостя
  Scenario: Activity feed гостя ограничен
    Given Лена — guest на board "DEV"
    And в "Команда А" есть события на boards OPS, QA (за пределами доступа)
    When она открывает workspace activity feed
    Then GET /api/workspaces/:id/events?userId=Лена возвращает только события связанные с board "DEV"
    And события tasks/comments на других досках не приходят даже если она была упомянута

  # Edge: notification suppression
  Scenario: Mention в недоступной доске не создаёт notification
    Given Аня (member) пишет на board "OPS" комментарий "@Лена посмотри"
    Then create-notification проверяет canAccessBoard(Лена, OPS-id) = false
    And запись в notifications НЕ создаётся
    And email-уведомление НЕ отправляется
    And аудит-запись (security log) "skipped notification due to ACL" пишется

# ─── Feature 4: Жизненный цикл гостя ──────────────────────────────────────────

Feature: Повышение и удаление гостя

  Background:
    Given Лена — guest в workspace "Команда А" с BoardMember на board "DEV"
    And я owner

  # Happy: promote
  Scenario: Повысить гостя до полноценного участника
    Given в WorkspaceSettings → Участники → секция "Гости"
    When я нажимаю "Повысить до участника" у Лены
    And выбираю роль system:member в confirmation
    Then PATCH /api/workspaces/:id/members/Лена { isGuest:false, rolePresetId:system:member.id } → 200
    And Лена теперь видит все public boards workspace
    And её BoardMember на "DEV" остаётся (override продолжает действовать если другая роль)

  # Happy: повышение в owner снимает isGuest автоматически
  Scenario: Promote to owner auto-clears isGuest
    When я меняю Лене роль на system:owner
    Then isGuest автоматически = false
    And запись логируется в audit

  # Edge: удаление последнего BoardMember у гостя
  Scenario: Снятие последнего board-доступа удаляет гостя
    Given у Лены ровно одна BoardMember-запись (на "DEV")
    When я открываю modal "Доступ к DEV"
    And удаляю Лену через "Удалить override"
    Then DELETE /api/boards/DEV/members/Лена → 204
    And в той же транзакции:
      | таблица            | действие                                    |
      | board_members      | DELETE                                      |
      | workspace_members  | DELETE (т.к. isGuest=true и 0 BoardMember)  |
    And toast "Гость Лена удалена из workspace (доступа к доскам больше нет)"

  # Edge: удаление одного из нескольких BoardMember у гостя
  Scenario: Снятие промежуточного board-доступа гостя
    Given у Лены 3 BoardMember-записи (DEV, OPS, QA)
    When я удаляю её из "DEV"
    Then DELETE → 204
    And workspace_members остаётся (т.к. ещё 2 board-доступа)
    And в sidebar Лены остаются OPS и QA

  # Edge: history overrides при удалении не-guest
  Scenario: Удаление обычного member сохраняет историю BoardMember
    Given Боря — обычный member workspace (isGuest=false)
    And у него 2 BoardMember-overrides (DEV:viewer, FIN:owner)
    When owner удаляет Борю из workspace
    Then DELETE /api/workspaces/:id/members/Боря → 204
    And workspace_members DELETE
    And board_members записи Бори ОСТАЮТСЯ (история)
    And canAccessBoard для Бори теперь false (нет workspace membership)
    When owner добавляет Борю обратно с ролью system:viewer
    Then его BoardMember-overrides снова в силе
    And он сразу видит DEV как viewer и FIN как owner

# ─── Feature 5: Эффективная роль — комбинации ────────────────────────────────

Feature: Алгоритм canAccessBoard покрывает все правила

  # Правило 1: workspace owner всегда видит
  Scenario: Owner с BoardMember null для себя — всё равно доступ
    Given Лёша — owner workspace
    And в БД board_members содержит запись (boardId=FIN, userId=Лёша, rolePresetId=null)
    When canAccessBoard(Лёша, FIN) вызывается
    Then возвращается { allowed:true, role:system:owner.id }
    And rule 1 срабатывает раньше rule 2 (denied)

  # Правило 2: explicit denied
  Scenario: Member с denied
    Given Маша — system:member workspace
    And board_members содержит (boardId=DEV, userId=Маша, rolePresetId=null)
    When canAccessBoard(Маша, DEV)
    Then { allowed:false }

  # Правило 3: override повышает
  Scenario: Viewer с board-override system:member
    Given Аня — system:viewer workspace
    And board_members содержит (boardId=DEV, userId=Аня, rolePresetId=system:member.id)
    Then canAccessBoard(Аня, DEV) = { allowed:true, role:system:member.id }
    And canActOnBoard(Аня, DEV, "TASK_CREATE") = true (т.к. member может создавать)

  # Правило 4: guest без BoardMember на public — нет доступа
  Scenario: Guest не видит public boards без явного BoardMember
    Given Лена — guest workspace (isGuest=true)
    And board "OPS" — public, ноль board_members для Лены
    Then canAccessBoard(Лена, OPS) = { allowed:false }
    And в её sidebar "OPS" не появляется

  # Правило 5: private без BoardMember — нет доступа
  Scenario: Обычный member и private board
    Given Боря — system:member workspace (isGuest=false)
    And board "FIN" — private, ноль board_members для Бори
    Then canAccessBoard(Боря, FIN) = { allowed:false }

  # Правило 6: public + workspace role
  Scenario: Обычный поток — member видит public board
    Given Боря — system:member workspace
    And board "DEV" — public, ноль board_members для Бори
    Then canAccessBoard(Боря, DEV) = { allowed:true, role:system:member.id }

  # Соблюдение каскада feature toggles
  Scenario: Workspace выключил WS_COMMENTS — write на доске не работает
    Given Аня имеет board-override system:member на DEV
    And workspace_features (workspace, WS_COMMENTS, enabled=false)
    When Аня пытается POST /api/tasks/:id/comments
    Then 403 с code="FEATURE_DISABLED"
    And алгоритм canActOnBoard сначала проходит проверку canAccessBoard (true), затем isAllowed находит выключение фичи

  # Cross-cutting: superadmin обходит всё
  Scenario: Superadmin видит private board без BoardMember
    Given Дима — User.isSuperadmin=true, не в workspace
    Then canAccessBoard(Дима, любой board) = { allowed:true, role:system:admin.id }
    And rule 0 срабатывает раньше всех остальных
