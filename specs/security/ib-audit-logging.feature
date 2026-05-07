# BDD: ИБ — Регистрация событий и аудит
# Источник: Требования по логированию.docx; Требования ИБ basic §3; ГОСТ 57580 УЗП.22–28, РД-40–43, ЦЗИ.28–30
# Tech segments: [ИАА]=iia, [ФПП]=fpp, [УП]=up, [ОУ]=uo, [ХИ]=hi

Feature: Регистрация событий безопасности и интеграция с SIEM

  Background:
    Given система Flow Tasks запущена
    And логирование включено
    And SIEM-транспорт настроен

  # ─── 1. Формат SIEM-события ────────────────────────────────────────────────

  # Req Требования по логированию §1 (обязательные поля)
  Scenario: Каждое событие безопасности содержит обязательные поля
    When генерируется любое событие ИБ
    Then JSON-запись события содержит все обязательные поля:
      | field         | description                          |
      | time          | ISO-8601, UTC+3 (мск)                |
      | forwarder     | идентификатор форвардера/прокси      |
      | source        | источник события (hostname/service)  |
      | subject       | субъект воздействия (userId/apiKey)  |
      | object        | объект воздействия (resourceId)      |
      | resource      | уровень приложения (endpoint/entity) |
      | tech_segment  | код технологического участка         |
      | tags          | массив SIEM-тегов                    |
      | session_id    | идентификатор сессии                 |
      | result        | SUCCESS / FAIL                       |

  # Req Требования по логированию §4 (схема тегирования)
  Scenario: SIEM-тег формируется по схеме 5 уровней
    When событие аутентификации генерируется в production-контуре
    Then поле tags содержит массив ["flowtasks","auth","iia","PROD","<dc>"]
    And порядок тегов соответствует схеме: system_name, event_type, tech_segment, env, datacenter

  Scenario: Тег технологического участка соответствует типу события
    Given таблица соответствия событий и сегментов:
      | event_type          | tech_segment |
      | auth.login          | iia          |
      | auth.logout         | iia          |
      | admin.user.create   | iia          |
      | task.create         | fpp          |
      | task.export         | hi           |
      | workspace.created   | uo           |
    When событие каждого типа генерируется
    Then поле tech_segment соответствует таблице

  # ─── 2. Изменения в формате "было-стало" ───────────────────────────────────

  # Req Требования по логированию §1 (изменения представляются в виде "было-стало")
  Scenario: Событие изменения задачи содержит oldValue и newValue
    Given задача task-1 имеет priority=HIGH
    When PATCH /api/tasks/task-1 с {"priority":"LOW"}
    Then TaskHistory-запись содержит:
      | field    | value  |
      | field    | priority |
      | oldValue | HIGH   |
      | newValue | LOW    |
    And SIEM-событие "task.update" содержит те же поля

  Scenario: Изменение роли пользователя содержит "было-стало"
    Given member@corp.ru имеет роль MEMBER
    When PATCH /api/workspaces/:id/members/:userId с {"role":"VIEWER"}
    Then AuditLog/WorkspaceEvent содержит:
      | field    | value   |
      | oldRole  | MEMBER  |
      | newRole  | VIEWER  |

  # ─── 3. Аудит действий администраторов ────────────────────────────────────

  # Req Требования по логированию §2.3; ГОСТ 57580 УЗП.22, УЗП.27
  Scenario: Создание пользователя администратором логируется
    Given superadmin аутентифицирован
    When POST /api/admin/users (создание аккаунта)
    Then событие "admin.user.create" записывается в AuditLog с полями:
      | field     | value              |
      | actorId   | superadmin_id      |
      | targetId  | new_user_id        |
      | action    | admin.user.create  |
      | tech_segment | iia             |

  Scenario: Удаление пользователя администратором логируется
    Given superadmin аутентифицирован
    When DELETE /api/admin/users/:id
    Then событие "admin.user.delete" записывается в AuditLog

  Scenario: Изменение настроек системы логируется (ГОСТ 57580 УЗП.27)
    Given superadmin меняет конфигурационный параметр
    When PATCH /api/admin/config с {"registrationDomain":"newdomain.ru"}
    Then событие "admin.config.change" записывается в AuditLog с полями:
      | field    | value                  |
      | action   | admin.config.change    |
      | setting  | registrationDomain     |
      | oldValue | olddomain.ru           |
      | newValue | newdomain.ru           |

  # Req Требования по логированию §2.3 (изменение настроек аудита)
  Scenario: Изменение настроек аудита само логируется
    Given superadmin меняет уровень логирования
    When PATCH /api/admin/audit-settings с {"logLevel":"error"}
    Then событие "admin.audit.settings.change" записывается в AuditLog ПЕРЕД применением изменения
    And событие содержит oldValue="info" и newValue="error"

  # ─── 4. Действия привилегированных пользователей ──────────────────────────

  # Req Требования по логированию §2.4; ГОСТ 57580 УЗП.23
  Scenario: Экспорт данных привилегированным пользователем логируется
    Given owner@corp.ru (привилегированная роль в воркспейсе) аутентифицирован
    When GET /api/tasks?export=csv&workspace=WS-1
    Then событие "data.export" записывается в AuditLog с полями:
      | field       | value           |
      | action      | data.export     |
      | actorId     | owner_user_id   |
      | scope       | workspace=WS-1  |
      | format      | csv             |
      | recordCount | <N>             |
      | tech_segment | hi             |

  # Req §2.4 (ПДн маскируются при попадании в SIEM)
  Scenario: ПДн-поля маскируются в SIEM-событиях
    Given событие содержит поле email пользователя
    When событие отправляется в SIEM
    Then поле email заменено на хэш или маску вида "al***@corp.ru"
    And поле phone (если есть) заменено на "***"

  # ─── 5. Аудит действий обычных пользователей ──────────────────────────────

  # Req Требования по логированию §2.5
  Scenario: Удаление задачи пользователем логируется
    Given member@corp.ru аутентифицирован
    When DELETE /api/tasks/:id
    Then событие "task.delete" записывается в AuditLog с полями:
      | field    | value         |
      | action   | task.delete   |
      | actorId  | member_id     |
      | targetId | task_id       |

  # ─── 6. Системные события ──────────────────────────────────────────────────

  # Req Требования по логированию §2.6; ГОСТ 57580 ЦЗИ.30
  Scenario: Запуск сервиса логируется как системное событие
    When Node.js-процесс сервера стартует
    Then в лог-транспорт отправляется событие "system.service.start" с полями:
      | field    | value                  |
      | action   | system.service.start   |
      | service  | flow-tasks-backend     |
      | version  | <GIT_SHA>              |
      | pid      | <process_pid>          |

  # Req ГОСТ 57580 ЦЗИ.28
  Scenario: Установка обновления системы логируется
    When выполняется деплой новой версии приложения
    Then событие "system.update.install" записывается с полями:
      | field      | value                   |
      | action     | system.update.install   |
      | fromVersion | <old_sha>              |
      | toVersion   | <new_sha>              |

  # Req Требования по логированию §2.6 (реагирование на невозможность создать событие)
  Scenario: Ошибка записи в журнал сама регистрируется
    Given SIEM-транспорт недоступен
    When попытка записать событие в SIEM не удаётся
    Then событие "system.log.transport.error" пишется в fallback-транспорт (stdout/stderr)
    And алерт отправляется администратору (email или PagerDuty)

  # Req §2.6 (ошибки валидации)
  Scenario: Ошибки валидации входных данных логируются как системные события
    When POST /api/tasks с невалидным телом (напр., title: "")
    Then статус 400
    And событие "system.validation.error" логируется с полями:
      | field     | value                    |
      | endpoint  | POST /api/tasks          |
      | errors    | ["title: required"]      |
      | ip        | <request_ip>             |

  # ─── 7. Интеграция с SIEM ─────────────────────────────────────────────────

  # Req §1.2.6, §1.2.7; basic §3.5
  Scenario: События доставляются в несколько SIEM-приёмников параллельно
    Given настроены два транспорта: syslog и HTTP-sink
    When событие безопасности генерируется
    Then событие доставляется в syslog-транспорт
    And событие ТАКЖЕ доставляется в HTTP-sink транспорт
    And доставка в оба транспорта происходит асинхронно, не блокируя основной поток

  Scenario: Недоступность одного транспорта не останавливает запись в другой
    Given HTTP-sink транспорт недоступен
    When событие безопасности генерируется
    Then событие записывается в syslog-транспорт
    And ошибка HTTP-sink логируется отдельно
    And основной запрос пользователя не прерывается

  # Req §1.2.6 (машинный разбор)
  Scenario: Все события имеют строгую JSON-схему для машинного разбора
    When 100 случайных событий безопасности генерируются
    Then каждое событие проходит валидацию по JSON-схеме AuditEventSchema
    And ни одно событие не содержит unparseable characters или нарушений структуры

  # Req Требования по логированию §1 (гарантированная доставка)
  Scenario: Гарантированная доставка событий при кратковременном сбое SIEM
    Given SIEM-транспорт недоступен в течение 30 секунд
    When 10 событий безопасности генерируются в этот период
    Then события буферизуются локально
    And после восстановления SIEM все 10 событий доставляются в корректном порядке

  # ─── 8. ГОСТ 57580 — специфичные меры ────────────────────────────────────

  # ГОСТ 57580 УЗП.26 (управление MFA)
  Scenario: Настройка MFA-метода администратором логируется (УЗП.26)
    Given superadmin настраивает MFA для пользователя
    When PATCH /api/admin/users/:id/mfa с {"enabled":true,"method":"totp"}
    Then событие "admin.mfa.config.change" записывается в AuditLog с полями:
      | field    | value                   |
      | action   | admin.mfa.config.change |
      | targetId | user_id                 |
      | method   | totp                    |

  # ГОСТ 57580 УЗП.28 (управление криптографическими ключами)
  Scenario: Ротация JWT-секрета логируется (УЗП.28)
    Given superadmin выполняет ротацию JWT signing secret
    When POST /api/admin/security/rotate-jwt-secret
    Then событие "admin.crypto.key.rotate" записывается в AuditLog

  # ГОСТ 57580 ИУ.7 (создание/удаление ресурсов БД)
  Scenario: Создание воркспейса (ресурс БД) логируется (ИУ.7)
    When POST /api/workspaces
    Then событие "workspace.created" записывается с полями:
      | field        | value          |
      | action       | workspace.created |
      | tech_segment | hi             |
      | actorId      | creator_id     |

  Scenario: Удаление воркспейса (ресурс БД) логируется (ИУ.7)
    When DELETE /api/workspaces/:id
    Then событие "workspace.deleted" записывается с полями:
      | field        | value             |
      | action       | workspace.deleted |
      | tech_segment | hi                |
