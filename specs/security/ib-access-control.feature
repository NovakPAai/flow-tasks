# BDD: ИБ — Управление правами доступа (RBAC / ABAC / Record-level)
# Источник: Требования к ИБ §1.2.2–1.5, §1.7; Требования ИБ basic §2; ГОСТ 57580 УЗП.24–25
# Tech segment: [ИАА] / iia

Feature: Ролевое разграничение прав доступа

  Background:
    Given система Flow Tasks запущена
    And существуют пользователи:
      | email              | role              |
      | admin@corp.ru      | superadmin        |
      | owner@corp.ru      | workspace OWNER   |
      | member@corp.ru     | workspace MEMBER  |
      | viewer@corp.ru     | workspace VIEWER  |
      | outsider@corp.ru   | нет доступа к WS  |

  # ─── 1. Принцип минимальных полномочий ─────────────────────────────────────

  # Req §1.3.1, §1.4.1
  Scenario: VIEWER не может создавать задачи
    Given viewer@corp.ru аутентифицирован
    When POST /api/boards/:id/tasks с корректным телом запроса
    Then статус 403 Forbidden
    And тело ответа содержит {"code":"INSUFFICIENT_PERMISSIONS"}

  Scenario: MEMBER не может удалять воркспейс
    Given member@corp.ru аутентифицирован
    When DELETE /api/workspaces/:id
    Then статус 403 Forbidden

  Scenario: OWNER может изменить роль участника
    Given owner@corp.ru аутентифицирован
    When PATCH /api/workspaces/:id/members/:userId с {"role":"VIEWER"}
    Then статус 200
    And событие "workspace.member_role_changed" записывается в AuditLog/WorkspaceEvent

  # ─── 2. Изоляция по воркспейсу (Record-level access control) ───────────────

  # Req §1.3.3, §1.3.5, §1.7
  Scenario: Пользователь без членства не видит задачи чужого воркспейса
    Given outsider@corp.ru аутентифицирован
    And задача task-123 принадлежит воркспейсу WS-1
    And outsider@corp.ru НЕ является участником WS-1
    When GET /api/tasks/task-123
    Then статус 404 (или 403)
    And тело ответа НЕ содержит данных задачи

  Scenario: VIEWER видит только задачи своего воркспейса
    Given viewer@corp.ru является участником WS-1, но не WS-2
    When GET /api/boards/:board_in_ws2/tasks
    Then статус 403 или 404
    And данные задач WS-2 не раскрываются

  Scenario: Assignee видит свою задачу даже в приватном воркспейсе
    Given member@corp.ru назначен исполнителем задачи task-private
    And task-private находится в приватном board
    When GET /api/tasks/task-private с токеном member@corp.ru
    Then статус 200
    And ответ содержит данные task-private

  # ─── 3. API-доступ с разграничением по операциям ───────────────────────────

  # Req §1.3.4 (чтение и запись обязательно, по объектам — опционально)
  Scenario Outline: API-ключ с readonly scope не может выполнять запись
    Given пользователь имеет API-ключ с scope="read"
    When <method> <endpoint> с API-ключом
    Then статус 403

    Examples:
      | method | endpoint              |
      | POST   | /api/boards/:id/tasks |
      | PATCH  | /api/tasks/:id        |
      | DELETE | /api/tasks/:id        |

  # ─── 4. Admin — полный набор полномочий ────────────────────────────────────

  # Req §1.5.3
  Scenario: Superadmin может просматривать всех пользователей
    Given admin@corp.ru имеет флаг isSuperadmin=true
    When GET /api/admin/users с токеном admin@corp.ru
    Then статус 200
    And ответ содержит список всех пользователей

  Scenario: Superadmin может изменить роль пользователя в любом воркспейсе
    Given admin@corp.ru аутентифицирован
    When POST /api/admin/users/:id/set-superadmin с {"isSuperadmin":true}
    Then статус 200
    And событие "admin.user.set_superadmin" записывается в AuditLog

  # ─── 5. Управление ролевой моделью ─────────────────────────────────────────

  # Req §1.4; ГОСТ 57580 УЗП.25
  Scenario: Добавление участника в воркспейс логируется
    Given owner@corp.ru аутентифицирован
    When POST /api/workspaces/:id/members с {"userId":"...","role":"MEMBER"}
    Then статус 201
    And событие "workspace.member_added" записывается в AuditLog/WorkspaceEvent с полями:
      | field       | value          |
      | actorId     | owner_user_id  |
      | targetId    | new_member_id  |
      | role        | MEMBER         |

  Scenario: Удаление участника из воркспейса логируется
    Given owner@corp.ru аутентифицирован
    When DELETE /api/workspaces/:id/members/:userId
    Then статус 200
    And событие "workspace.member_removed" записывается в AuditLog/WorkspaceEvent

  # Req ГОСТ 57580 УЗП.24 (действия с правами управления доступом)
  Scenario: Все изменения прав пишутся в AuditLog с полями "было-стало"
    Given member@corp.ru имеет роль MEMBER в WS-1
    When owner@corp.ru меняет роль member@corp.ru на VIEWER
    Then WorkspaceEvent содержит:
      | field    | value   |
      | action   | member_role_changed |
      | oldValue | MEMBER  |
      | newValue | VIEWER  |

  # ─── 6. Доступ к журналам аудита ─────────────────────────────────────────

  # Req basic §3.2 (любой доступ к записям о событиях логируется)
  Scenario: Просмотр AuditLog администратором сам логируется
    Given admin@corp.ru аутентифицирован
    When GET /api/admin/audit-logs
    Then статус 200
    And создаётся AuditLog-запись "admin.auditlog.read" с actorId=admin_id

  # ─── 7. Ролевая модель в отчётах ──────────────────────────────────────────

  # Req §1.4.3 (отчёты с учётом RBAC)
  Scenario: Export данных содержит только объекты, доступные пользователю
    Given member@corp.ru является участником WS-1
    And в системе есть WS-2, к которому member не имеет доступа
    When GET /api/tasks?export=csv с токеном member@corp.ru
    Then ответ содержит только задачи из WS-1
    And событие "data.export" записывается в AuditLog с указанием scope

  # ─── 8. Блокировка/разблокировка пользователя администратором ─────────────

  # Req Требования по логированию §2.2
  Scenario: Администратор блокирует пользователя — событие логируется
    Given admin@corp.ru аутентифицирован
    When PATCH /api/admin/users/:id с {"isActive":false}
    Then статус 200
    And событие "admin.user.deactivate" записывается в AuditLog с полями:
      | field    | value           |
      | action   | admin.user.deactivate |
      | targetId | <blocked_user_id> |
      | actorId  | admin_user_id   |

  Scenario: Заблокированный пользователь не может войти в систему
    Given пользователь "blocked@corp.ru" имеет isActive=false
    When POST /api/auth/login с корректными credentials
    Then статус 403 с телом {"code":"ACCOUNT_DISABLED"}
    And событие "auth.login.fail" содержит reason="ACCOUNT_DISABLED"
