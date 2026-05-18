# Spec: Quick edit of task due date (issue #167)
# Status: approved
# Design: docs/design/issue-167-quick-due-date.md

Feature: Быстрая правка срока задачи без открытия карточки

  Background:
    Given я авторизован как Member воркспейса demo
    And на доске "DEV" есть задача DEV-1 без срока
    And на доске "DEV" есть задача DEV-2 со сроком 2026-05-20

  # ── Happy ────────────────────────────────────────────────────────────────────

  Scenario: задаю срок на карточке без даты в Kanban
    Given я на /w/demo/boards/dev
    When я навожу курсор на карточку DEV-1
    Then на карточке появляется кнопка "+ срок"
    When я кликаю по "+ срок"
    Then открывается DatePicker-попап
    When я выбираю 2026-05-25
    Then попап закрывается
    And на карточке отображается "25 мая"
    And TaskDrawer НЕ открывается
    And PATCH /api/tasks/<DEV-1 id> отправлен с { dueDate: "2026-05-25T..." }

  Scenario: меняю существующий срок кликом по чипу
    Given я на /w/demo/boards/dev
    When я кликаю по чипу даты DEV-2 ("20 мая")
    Then открывается DatePicker с фокусом на 2026-05-20
    When я выбираю 2026-06-01
    Then чип обновляется на "1 июн"
    And TaskDrawer НЕ открывается

  Scenario: очищаю срок через кнопку "Очистить"
    Given я на /w/demo/boards/dev
    When я кликаю по чипу даты DEV-2
    And я нажимаю "Очистить" в попапе
    Then чип даты исчезает с карточки
    And PATCH /api/tasks/<DEV-2 id> отправлен с { dueDate: null }

  # ── Empty ────────────────────────────────────────────────────────────────────

  Scenario: задача без срока в List view — placeholder на hover
    Given я на /w/demo/boards/dev?view=list
    When я навожу на строку DEV-1
    Then в колонке "Срок" появляется кнопка "+ срок"
    When я ухожу курсором со строки
    Then кнопка "+ срок" пропадает

  # ── Loading ──────────────────────────────────────────────────────────────────

  Scenario: индикатор загрузки во время PATCH
    Given я на /w/demo/boards/dev
    When я выбираю дату в попапе на DEV-1
    Then чип кратковременно показывает spinner-индикатор
    When PATCH возвращает 200
    Then spinner исчезает, чип показывает новую дату

  # ── Error ────────────────────────────────────────────────────────────────────

  Scenario: API возвращает 500
    Given backend временно отвечает 500 на PATCH /api/tasks
    When я выбираю дату в попапе на DEV-2
    Then toast "Не удалось обновить срок" появляется
    And чип возвращается к "20 мая" (rollback)

  Scenario: сеть недоступна
    Given сеть offline
    When я выбираю дату в попапе на DEV-1
    Then toast "Не удалось обновить срок" появляется
    And чип "+ срок" возвращается (rollback)

  # ── Keyboard ─────────────────────────────────────────────────────────────────

  Scenario: клавиатурный сценарий
    Given фокус на чипе даты DEV-2
    When я нажимаю Enter
    Then открывается DatePicker с фокусом на текущей дате
    When я нажимаю Esc
    Then попап закрывается, значение не меняется
    And фокус возвращается на чип даты

  # ── Permission ───────────────────────────────────────────────────────────────

  Scenario: Viewer не может изменить срок
    Given я Viewer воркспейса demo
    When я открываю /w/demo/boards/dev
    Then чип даты DEV-2 отображается как обычный текст
    And клик по нему НЕ открывает попап
    And кнопка "+ срок" на DEV-1 НЕ появляется на hover

  # ── Edge data ────────────────────────────────────────────────────────────────

  Scenario: клик по дате не пробивает к карточке
    Given я на /w/demo/boards/dev
    When я кликаю по чипу даты DEV-2
    Then TaskDrawer НЕ открывается
    And открывается DatePicker

  Scenario: overdue-задача сохраняет красный цвет до и после правки
    Given DEV-2 имеет dueDate = вчера
    Then чип отображается красным
    When я кликаю и выбираю дату в будущем
    Then чип перекрашивается в обычный цвет
