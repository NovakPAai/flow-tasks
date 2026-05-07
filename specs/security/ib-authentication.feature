# BDD: ИБ — Идентификация, Аутентификация, Авторизация (ИАА)
# Источник: Требования к ИБ §1.2.5, §1.6; Требования ИБ basic §1; ГОСТ 57580 РД-40..РД-43
# Tech segment: [ИАА] / iia

Feature: Идентификация, аутентификация и авторизация пользователей

  # ─── 1. Уникальные учётные записи ─────────────────────────────────────────

  Background:
    Given система Flow Tasks запущена
    And база данных содержит таблицу users с уникальным ограничением на email

  # Req 1.2 (basic §1.1, §1.2)
  Scenario: Уникальность учётных записей
    Given пользователь "alice@corp.ru" уже зарегистрирован
    When новый запрос на регистрацию с email "alice@corp.ru" отправлен
    Then система возвращает 409 Conflict
    And событие "auth.register.duplicate" записывается в AuditLog с полями:
      | field      | value             |
      | actorEmail | alice@corp.ru     |
      | action     | auth.register     |
      | result     | DUPLICATE         |
      | ip         | <request_ip>      |

  # ─── 2. Локальная аутентификация ───────────────────────────────────────────

  # Req ГОСТ 57580 РД-40
  Scenario: Успешная аутентификация — событие регистрируется
    Given пользователь "bob@corp.ru" существует в системе
    When POST /api/auth/login с корректными credentials
    Then статус ответа 200
    And событие "auth.login.success" записывается в AuditLog с полями:
      | field         | value            |
      | action        | auth.login       |
      | result        | SUCCESS          |
      | actorEmail    | bob@corp.ru      |
      | ip            | <request_ip>     |
      | userAgent     | <user_agent>     |
      | sessionId     | <generated_uuid> |
    And SIEM-тег содержит ["flowtasks","auth","iia","PROD","<dc>"]

  # Req ГОСТ 57580 РД-40; Требования по логированию §2.1
  Scenario: Неуспешная аутентификация — событие регистрируется
    Given пользователь "bob@corp.ru" существует в системе
    When POST /api/auth/login с неверным паролем
    Then статус ответа 401
    And событие "auth.login.fail" записывается в AuditLog с полями:
      | field      | value        |
      | action     | auth.login   |
      | result     | FAIL         |
      | ip         | <request_ip> |
      | userAgent  | <user_agent> |

  # Req Требования по логированию §2.1 (блокировка/разблокировка аккаунта)
  Scenario: Блокировка аккаунта после N неудачных попыток
    Given пользователь "charlie@corp.ru" существует
    And порог блокировки равен 5 попыткам за 15 минут
    When выполнено 5 POST /api/auth/login с неверным паролем подряд
    Then 6-й запрос возвращает 429 Too Many Requests
    And событие "auth.lockout" записывается в AuditLog с полями:
      | field      | value             |
      | action     | auth.lockout      |
      | result     | LOCKED            |
      | ip         | <request_ip>      |
      | attempts   | 5                 |

  # Req ГОСТ 57580 РД-41; Требования по логированию §2.1
  Scenario: Выход из системы — событие регистрируется
    Given пользователь аутентифицирован с активной сессией
    When POST /api/auth/logout
    Then статус 200
    And событие "auth.logout" записывается в AuditLog с полями:
      | field      | value          |
      | action     | auth.logout    |
      | result     | SUCCESS        |
      | sessionId  | <session_id>   |
      | reason     | user_initiated |

  # Req ГОСТ 57580 РД-41 (прерывание сессии)
  Scenario: Logout по истечению refresh-токена — регистрируется как прерывание
    Given пользователь имеет истёкший refresh-токен
    When POST /api/auth/refresh
    Then статус 401
    And событие "auth.session.expired" записывается в AuditLog

  # ─── 3. SSO / OIDC аутентификация ─────────────────────────────────────────

  # Req §1.2.5; basic §1.3, §1.11; ГОСТ 57580 РД-40
  Scenario: SSO-вход через корпоративный IDP — событие регистрируется
    Given OIDC-провайдер настроен и доступен
    When пользователь проходит SSO-аутентификацию через GET /api/auth/sso/callback
    Then статус 302 (редирект на frontend)
    And событие "auth.sso.login.success" записывается в AuditLog с полями:
      | field       | value           |
      | action      | auth.sso.login  |
      | provider    | <oidc_issuer>   |
      | ssoSubject  | <sub_claim>     |
      | ip          | <request_ip>    |
      | sessionId   | <session_id>    |

  Scenario: SSO-вход с некорректным state — отклоняется и логируется
    When GET /api/auth/sso/callback с невалидным state параметром
    Then статус 400
    And событие "auth.sso.login.fail" записывается в AuditLog

  # Req ГОСТ 57580 РД-43 (изменение аутентификационных данных)
  Scenario: Изменение пароля — регистрируется как смена credential
    Given аутентифицированный пользователь
    When PATCH /api/auth/profile с новым паролем
    Then статус 200
    And событие "auth.credential.change" записывается в AuditLog с полями:
      | field     | value                   |
      | action    | auth.credential.change  |
      | field     | password                |
      | actorId   | <user_id>               |

  # ─── 4. API Key аутентификация ─────────────────────────────────────────────

  # Req §1.3.4 (API с разграничением по индивидуальным учётным записям)
  Scenario: Использование API-ключа — успешная аутентификация логируется
    Given у пользователя есть активный API-ключ "ft_abc..."
    When запрос к GET /api/tasks с заголовком Authorization: Bearer ft_abc...
    Then статус 200
    And событие "auth.apikey.use" записывается в AuditLog с полями:
      | field      | value            |
      | action     | auth.apikey.use  |
      | keyPrefix  | ft_abc...        |
      | ip         | <request_ip>     |

  Scenario: Использование истёкшего API-ключа — отклоняется и логируется
    Given у пользователя есть API-ключ с expiresAt в прошлом
    When запрос с этим ключом
    Then статус 401
    And событие "auth.apikey.fail" записывается в AuditLog

  # ─── 5. MFA для критичных операций ────────────────────────────────────────

  # Req §1.6 (MFA для критичных операций)
  Scenario: Критичная операция требует MFA-подтверждения
    Given пользователь-администратор аутентифицирован без MFA
    When DELETE /api/admin/users/:id (критичная операция)
    Then статус 403 с телом {"code":"MFA_REQUIRED"}
    And событие "auth.mfa.required" записывается в AuditLog

  Scenario: Критичная операция выполнена с MFA
    Given администратор прошёл MFA-подтверждение
    When DELETE /api/admin/users/:id
    Then статус 200
    And событие "auth.mfa.verified" записывается в AuditLog

  # ─── 6. Клиентская подпись в событиях аутентификации ──────────────────────

  # Req Требования по логированию §2.1 (web: ip, browser version, регион, ОС)
  Scenario: Событие аутентификации содержит клиентскую подпись
    When POST /api/auth/login с заголовками:
      | User-Agent    | Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 |
      | X-Real-IP     | 10.0.0.42                                             |
      | CF-IPCountry  | RU                                                    |
    Then событие в AuditLog содержит:
      | field       | value                |
      | ip          | 10.0.0.42            |
      | userAgent   | Chrome/120 Windows   |
      | region      | RU                   |
      | osVersion   | Windows NT 10.0      |

  # ─── 7. Синхронизация системного времени ──────────────────────────────────

  # Req basic §3.3
  Scenario: Все события аудита содержат временну́ю метку в UTC+3 (мск)
    When любое событие записывается в AuditLog
    Then поле createdAt присутствует и парсируется как ISO-8601
    And поле timezone в мета-данных SIEM-события равно "Europe/Moscow"
