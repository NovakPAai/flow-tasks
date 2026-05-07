# SDD — Информационная безопасность Flow Tasks

**Дата:** 2026-05-06  
**Репозиторий:** NovakPAai/flow-tasks  
**Источники требований:**
- Требования к информационной безопасности (§1.1–1.7)
- Требования по логированию (§1–4)
- Требования ИБ к ИС basic (§1–10)
- События для интеграции с SIEM ГОСТ 57580 (УЗП.22–28, РД-40–43, ИУ.7, ЦЗИ.28–30)
- Опросник по полноте логирования

---

## 1. Контекст системы

**Flow Tasks** — корпоративный таск-трекер. Стек: Node.js/Express + TypeScript, PostgreSQL/Prisma, Redis, React/Vite.

Роли пользователей в системе:
| Роль | Описание | Req |
|------|----------|-----|
| `isSuperadmin` | Полный доступ к системе | §1.5.3 |
| `OWNER` (workspace) | Управление воркспейсом и участниками | §1.5.2 |
| `MEMBER` (workspace) | Создание и редактирование задач | §1.5.1 |
| `VIEWER` (workspace) | Только чтение задач | §1.5.1 |

---

## 2. Статус реализации требований

### 2.1 Идентификация и аутентификация (ИАА / `iia`)

| ID | Требование | Статус | Файл / Комментарий |
|----|-----------|--------|--------------------|
| §1.2.5 | OIDC-интеграция с корпоративным IDP | ✅ | `auth/sso/` (openid-client, PKCE, state) |
| §1.6 | SSO с MFA для критичных операций | ⚠️ | SSO реализован; MFA только через IDP, нет enforcement для local-auth критичных операций |
| §1.1 | Защита от неправомерного доступа (CIA) | ✅ | JWT + refresh-token rotation, брут-форс защита |
| basic §1.2 | Уникальные учётные записи | ✅ | DB unique constraint на `users.email` |
| basic §1.10 | Шифрование канала (TLS) | ⚠️ | TLS на уровне infra (Nginx/Caddy); enforce в app не реализован |
| basic §1.12 | MFA | ⚠️ | Только через SSO-провайдер; TOTP для local-auth не реализован |
| ГОСТ РД-40 | Регистрация идентификации/аутентификации | ❌ | `AuditLog` не пишется при login/logout/fail |
| ГОСТ РД-41 | Регистрация авторизации и завершения сессии | ❌ | Logout не логируется |
| ГОСТ РД-42 | Регистрация запуска программных сервисов | ❌ | Нет `system.service.start` события |
| ГОСТ РД-43 | Регистрация изменений credential | ❌ | Смена пароля не пишется в `AuditLog` |

### 2.2 Управление правами доступа (RBAC)

| ID | Требование | Статус | Файл / Комментарий |
|----|-----------|--------|--------------------|
| §1.3.1 | Минимальные полномочия | ✅ | `workspace_members.role`, OWNER/MEMBER/VIEWER enforcement |
| §1.3.3 | Охват всех операций над данными | ✅ | `task-access.ts`, воркспейс-гейты в роутерах |
| §1.3.4 | API-доступ по индивидуальным аккаунтам | ✅ | API Keys (hashed, per-user) |
| §1.3.5 | Все объекты охвачены RBAC | ⚠️ | Задачи, доски, воркспейсы — да; labels/comments — частично |
| §1.4.1 | Роли по функциональной позиции | ✅ | OWNER/MEMBER/VIEWER с иерархией |
| §1.5 | Базовая ролевая модель (employee/manager/admin) | ✅ | WorkspaceRole + isSuperadmin |
| §1.7 | Role/Attribute/Record-based access | ⚠️ | Record-level есть (workspace isolation); field-level (до поля) — нет |
| ГОСТ УЗП.24 | Регистрация управления доступом | ⚠️ | `WorkspaceEvent` есть; `oldRole/newRole` в meta не всегда |
| ГОСТ УЗП.25 | Регистрация управления УЗ и правами | ⚠️ | Частично: member_added/removed есть; полноты нет |
| ГОСТ УЗП.26 | Регистрация управления MFA | ❌ | MFA-настройки не логируются |
| ГОСТ УЗП.27 | Регистрация изменений параметров ЗИ | ❌ | Нет endpoint для config-изменений + нет лога |
| ГОСТ УЗП.28 | Регистрация управления крипто-ключами | ❌ | JWT-ротация не логируется |
| — | `isActive` блокировка пользователя | ❌ | Поля `isActive` нет в схеме; blocked-user guard нет |

### 2.3 Регистрация событий и аудит

| ID | Требование | Статус | Файл / Комментарий |
|----|-----------|--------|--------------------|
| §1.2.1 | Электронные журналы событий ИБ | ⚠️ | `AuditLog` есть только для admin-операций |
| §1.2.6 | Структурированные машиночитаемые логи | ✅ | JSON-логгер с redaction (`logger.ts`) |
| §1.2.7 | Параллельная отправка в несколько приёмников | ❌ | Только stdout/console |
| basic §3.1 | Наличие системы регистрации событий | ⚠️ | Частично (AuditLog для admin, TaskHistory для задач) |
| basic §3.2 | Перечень обязательных событий | ❌ | Из 13 типов покрыты ~4 (admin actions, workspace events) |
| basic §3.3 | Синхронизация времени | ⚠️ | Используется `new Date()` (системное время), NTP — infra |
| basic §3.4 | Обязательные поля события | ⚠️ | `createdAt`, `actorId`, `action` — есть; `forwarder`, `source`, `tech_segment`, `tags`, `session_id` — нет |
| basic §3.5 | Интеграция с SIEM | ❌ | Нет транспорта (syslog/HTTP/JDBC) |
| логирование §1 | Формат: forwarder, source, subject, object, resource, tech_segment, tag | ❌ | Не реализован |
| логирование §2.1 | Auth-события (web: ip, browser, ОС, регион) | ❌ | IP/UA не логируются в AuditLog |
| логирование §2.2 | Admin: создание/удаление/изменение аккаунтов | ⚠️ | Одобрение заявок логируется; user.create/delete — нет |
| логирование §2.3 | Admin audit: settings/audit changes | ❌ | Не реализован |
| логирование §2.4 | Privileged: экспорт данных, маскировка ПДн | ❌ | Экспорт не реализован; ПДн-маскировка нет |
| логирование §2.5 | User audit: потенциально деструктивные действия | ⚠️ | task.delete не логируется в AuditLog |
| логирование §2.6 | System: validation errors, process start/stop | ❌ | Нет |
| логирование §4 | SIEM-теги (5-уровневая схема) | ❌ | Не реализован |
| ГОСТ ИУ.7 | Создание/удаление ресурсов БД (workspace/board) | ⚠️ | `workspace_created` в WorkspaceEvent — есть; board/DB resources — нет |
| ГОСТ ЦЗИ.28 | Установка/обновление ПО | ❌ | Нет |
| ГОСТ ЦЗИ.30 | Запуск программных сервисов | ❌ | Нет |

### 2.4 Шифрование и защита каналов

| ID | Требование | Статус | Файл / Комментарий |
|----|-----------|--------|--------------------|
| §1.2.8 | TLS для внутренних каналов | ⚠️ | Infra-уровень; app не проверяет |
| basic §4.1 | Стойкие протоколы шифрования | ✅ | bcrypt + JWT HS256/RS256; TLS 1.2+ через Nginx |
| basic §4.2 | ГОСТ-алгоритмы | ❌ | Не реализованы; требуют специализированных libs |

### 2.5 Управление уязвимостями

| ID | Требование | Статус | Файл / Комментарий |
|----|-----------|--------|--------------------|
| basic §5.1 | Актуальные версии модулей | ⚠️ | Нет автоматической проверки CVE |
| basic §5.2 | Возможность применять security updates | ✅ | npm audit / Dependabot |

---

## 3. GAP-анализ и план реализации

### Приоритет 1 — Критично (ГОСТ 57580 обязательные меры)

#### GAP-1: Auth-события в AuditLog (РД-40, РД-41, РД-43)

**Описание:** При login/logout/fail/lockout/смене пароля не создаётся запись в `AuditLog`.

**Решение:** В `auth.service.ts` после каждого auth-события вызывать `auditLogger.log()`.

```typescript
// backend/src/shared/utils/audit-logger.ts (NEW)
interface AuditEvent {
  actorId: string | null;
  action: string;           // "auth.login", "auth.logout", ...
  targetId?: string;
  result: 'SUCCESS' | 'FAIL';
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  tech_segment: 'iia' | 'fpp' | 'up' | 'uo' | 'hi';
  tags: string[];           // ["flowtasks", type, segment, env, dc]
  meta?: Record<string, unknown>;
}

export async function auditLog(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: event.actorId ?? 'system',
      action: event.action,
      targetId: event.targetId,
      meta: {
        result: event.result,
        ip: event.ip,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        tech_segment: event.tech_segment,
        tags: event.tags,
        source: 'flow-tasks-backend',
        time: new Date().toISOString(),
        ...event.meta,
      },
    },
  });
}
```

**Места интеграции:**
- `auth.service.ts:login()` → `auditLog({ action: 'auth.login', result: 'SUCCESS'/'FAIL', ip, userAgent })`
- `auth.service.ts:logout()` → `auditLog({ action: 'auth.logout', reason: 'user_initiated' })`
- `auth.service.ts:checkBruteForce()` → `auditLog({ action: 'auth.lockout' })`
- `auth.service.ts:updateProfile()` при смене пароля → `auditLog({ action: 'auth.credential.change' })`
- `sso.service.ts:handleCallback()` → `auditLog({ action: 'auth.sso.login.success/fail' })`

**Схема БД — добавить поля в `AuditLog`:**

```prisma
model AuditLog {
  // существующие поля...
  ip         String?
  userAgent  String?
  sessionId  String?
  result     String?   // "SUCCESS" | "FAIL"
}
```

---

#### GAP-2: SIEM-тегирование (Req логирование §4)

**Описание:** Нет 5-уровневого SIEM-тега в событиях.

**Решение:** Константы тегов + хелпер:

```typescript
// backend/src/shared/utils/siem-tags.ts (NEW)
export const SIEM_SYSTEM = 'flowtasks';
export const SIEM_ENV = process.env.SIEM_ENV ?? 'DEV';       // PROD | UAT | DEV
export const SIEM_DC  = process.env.SIEM_DC  ?? 'unknown';   // m1 | dsp | nord

export type TechSegment = 'iia' | 'fpp' | 'up' | 'uo' | 'hi';
export type SiemEventType = 'auth' | 'admin_task' | 'admin_audit'
                          | 'power_users_audit' | 'users_audit' | 'system_audit';

export function siemTags(type: SiemEventType, segment: TechSegment): string[] {
  return [SIEM_SYSTEM, type, segment, SIEM_ENV, SIEM_DC];
}

// Соответствие action → (type, segment)
export const ACTION_TAGS: Record<string, [SiemEventType, TechSegment]> = {
  'auth.login':            ['auth',             'iia'],
  'auth.logout':           ['auth',             'iia'],
  'auth.lockout':          ['auth',             'iia'],
  'auth.sso.login':        ['auth',             'iia'],
  'auth.credential.change':['auth',             'iia'],
  'admin.user.create':     ['admin_task',        'iia'],
  'admin.user.deactivate': ['admin_task',        'iia'],
  'admin.config.change':   ['admin_audit',       'iia'],
  'admin.mfa.config.change':['admin_audit',      'iia'],
  'admin.crypto.key.rotate':['admin_audit',      'iia'],
  'task.create':           ['users_audit',       'fpp'],
  'task.update':           ['users_audit',       'fpp'],
  'task.delete':           ['users_audit',       'fpp'],
  'data.export':           ['power_users_audit', 'hi'],
  'workspace.created':     ['admin_task',        'uo'],
  'workspace.deleted':     ['admin_task',        'uo'],
  'workspace.member_added':['admin_task',        'iia'],
  'system.service.start':  ['system_audit',      'iia'],
  'system.update.install': ['system_audit',      'iia'],
};
```

---

#### GAP-3: SIEM-транспорт с multi-sink (Req §1.2.7, basic §3.5)

**Описание:** Логи уходят только в stdout. Нужны syslog и HTTP-sink с параллельной доставкой.

**Решение:** Фасад `SiemTransport` с async fan-out:

```typescript
// backend/src/shared/siem-transport.ts (NEW)
interface SiemSink {
  name: string;
  send(event: Record<string, unknown>): Promise<void>;
}

class SyslogSink implements SiemSink {
  name = 'syslog';
  async send(event: Record<string, unknown>) {
    // UDP/TCP syslog via 'syslog' npm package
  }
}

class HttpSink implements SiemSink {
  name = 'http';
  constructor(private url: string, private token: string) {}
  async send(event: Record<string, unknown>) {
    // fetch(this.url, { method: 'POST', body: JSON.stringify(event), headers: {...} })
  }
}

export class SiemTransport {
  private sinks: SiemSink[] = [];

  addSink(sink: SiemSink) { this.sinks.push(sink); }

  async emit(event: Record<string, unknown>): Promise<void> {
    await Promise.allSettled(
      this.sinks.map((sink) =>
        sink.send(event).catch((err) =>
          logger.error('siem.transport.error', { sink: sink.name, error: String(err) }),
        ),
      ),
    );
  }
}

export const siemTransport = new SiemTransport();
// Инициализация в server.ts: добавить sinks по env vars
```

**Буферизация при недоступном SIEM:**
- При ошибке отправки → пишем в `Redis LIST siem:buffer`
- Background worker (setInterval 30s) → flush буфера при восстановлении
- Если Redis недоступен → fallback в файловый appender

---

#### GAP-4: isActive блокировка пользователей (Req логирование §2.2)

**Описание:** Нет поля `isActive` в модели `User`; нет guard при login для заблокированных.

**Решение:**

```prisma
model User {
  // добавить:
  isActive  Boolean @default(true) @map("is_active")
}
```

В `auth.service.ts:login()`:
```typescript
if (!user.isActive) {
  await auditLog({ action: 'auth.login', result: 'FAIL', meta: { reason: 'ACCOUNT_DISABLED' } });
  throw new AppError(403, 'Account disabled', { code: 'ACCOUNT_DISABLED' });
}
```

В `admin.service.ts` — добавить endpoint `PATCH /api/admin/users/:id` с полем `isActive` + `auditLog`.

---

### Приоритет 2 — Важно (полнота аудита)

#### GAP-5: Клиентская подпись в auth-событиях (Req логирование §2.1)

IP и User-Agent уже доступны из `req`. Нужно передавать их в `auditLog()`:

```typescript
// В auth.router.ts — middleware extractClientMeta
export function extractClientMeta(req: Request): ClientMeta {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    region: req.headers['cf-ipcountry'] as string ?? req.headers['x-region'] as string,
  };
}
```

---

#### GAP-6: Системные события (Req логирование §2.6, ГОСТ ЦЗИ.30)

В `server.ts` после запуска:

```typescript
// server.ts — после app.listen()
siemTransport.emit({
  action: 'system.service.start',
  service: 'flow-tasks-backend',
  version: process.env.GIT_SHA ?? 'dev',
  pid: process.pid,
  tags: siemTags('system_audit', 'iia'),
  time: new Date().toISOString(),
});

process.on('SIGTERM', () => {
  siemTransport.emit({ action: 'system.service.stop', reason: 'SIGTERM' });
});
```

---

#### GAP-7: Маскировка ПДн в SIEM-событиях (Req логирование §2.4)

Перед отправкой в `SiemTransport.emit()` применять маскировку:

```typescript
const PII_MASK_RE = /^(email|phone|passport|card_number|inn)$/i;

function maskPii(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      PII_MASK_RE.test(k) ? maskValue(String(v)) : v,
    ]),
  );
}

function maskValue(value: string): string {
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return value.slice(0, 2) + '*'.repeat(Math.max(0, value.length - 4)) + value.slice(-2);
}
```

---

#### GAP-8: Полнота покрытия событий basic §3.2

Список не покрытых событий из чеклиста (basic §3.2) с маппингом:

| Событие | Endpoint / Hook | Action |
|---------|----------------|--------|
| Неуспешный логический доступ | `authenticate()` middleware | `auth.unauthorized` |
| Создание/удаление учётной записи | `admin.service` | `admin.user.create/delete` |
| Изменение прав пользователей | `workspaces.service` | `workspace.member_role_changed` |
| Изменение ID/auth данных | `auth.service:updateProfile` | `auth.credential.change` |
| Запуск и остановка сервисов | `server.ts` lifecycle | `system.service.start/stop` |
| Системные ошибки | `error-handler.ts` | `system.error` (5xx only) |
| Изменение параметров аудита | `/api/admin/audit-settings` | `admin.audit.settings.change` |

---

### Приоритет 3 — Перспектива

#### GAP-9: ГОСТ-алгоритмы шифрования (basic §4.2)

Требует использования `node-gost` или специализированного HSM. Актуально при получении лицензии ФСТЭК.

#### GAP-10: MFA для local-аккаунтов (Req §1.6, basic §1.12)

TOTP через `otplib` npm package:
- Endpoint `POST /api/auth/mfa/enable` → генерирует TOTP secret, возвращает QR-код
- Middleware `requireMfa()` для критичных endpoints (superadmin actions)
- `AuditLog` при изменении MFA-настроек (ГОСТ УЗП.26)

#### GAP-11: Field-level access control (Req §1.7)

Скрывать отдельные поля задачи в зависимости от роли VIEWER:
- `description` и `comments` — скрывать для VIEWER если board.isPrivate

---

## 4. Схема SIEM-события (эталон)

```json
{
  "time": "2026-05-06T12:00:00.000+03:00",
  "forwarder": "flow-tasks-backend-01",
  "source": "flow-tasks-backend",
  "action": "auth.login",
  "result": "SUCCESS",
  "subject": {
    "id": "uuid-user",
    "email": "al***@corp.ru",
    "session_id": "uuid-session"
  },
  "object": {
    "type": "session",
    "id": "uuid-session"
  },
  "resource": "POST /api/auth/login",
  "ip": "10.0.0.42",
  "userAgent": "Chrome/120 Windows NT 10.0",
  "region": "RU",
  "tech_segment": "iia",
  "tags": ["flowtasks", "auth", "iia", "PROD", "m1"],
  "env": "PROD",
  "version": "abc1234"
}
```

---

## 5. Приоритизированный бэклог

| # | Gap | Req | Приоритет | Оценка | Тест-файл |
|---|-----|-----|-----------|--------|-----------|
| 1 | Auth-события в AuditLog (login/logout/fail/lockout) | РД-40, РД-41 | P0 | M | `ib-authentication.test.ts` |
| 2 | `isActive` блокировка + guard | §2.2 логирование | P0 | S | `ib-access-control.test.ts` |
| 3 | SIEM-теги (5-уровневая схема) | §4 логирование | P0 | S | `ib-audit-logging.test.ts` |
| 4 | Клиентская подпись в auth-событиях (IP/UA/region) | §2.1 логирование | P1 | S | `ib-authentication.test.ts` |
| 5 | Обязательные SIEM-поля (forwarder/source/subject/object) | §1 логирование | P1 | M | `ib-audit-logging.test.ts` |
| 6 | SIEM-транспорт (syslog + HTTP multi-sink) | §1.2.7, §3.5 basic | P1 | L | — |
| 7 | Системные события (service start/stop/update) | РД-42, ЦЗИ.28–30 | P1 | S | `ib-audit-logging.test.ts` |
| 8 | Маскировка ПДн в SIEM-событиях | §2.4 логирование | P1 | S | `ib-audit-logging.test.ts` |
| 9 | Полнота AuditLog для admin-операций (user CRUD, config) | §2.3 логирование, УЗП.22 | P2 | M | `ib-audit-logging.test.ts` |
| 10 | oldRole/newRole в WorkspaceEvent.meta | УЗП.24 | P2 | S | `ib-access-control.test.ts` |
| 11 | Буферизация SIEM при недоступном транспорте | §1 логирование | P2 | M | — |
| 12 | Смена credential → AuditLog | РД-43 | P2 | S | `ib-authentication.test.ts` |
| 13 | Ошибки валидации → system.validation.error | §2.6 логирование | P3 | S | `ib-audit-logging.test.ts` |
| 14 | MFA для local-аккаунтов (TOTP) | §1.6, basic §1.12 | P3 | L | — |
| 15 | ГОСТ-алгоритмы шифрования | basic §4.2 | P3 | XL | — |
| 16 | Field-level access control | §1.7 | P3 | XL | — |

**Легенда размеров:** S = 1-2 дня, M = 3-5 дней, L = 1-2 недели, XL = 2+ недели

---

## 6. Маппинг на BDD feature-файлы

| Feature-файл | Покрытые требования |
|-------------|---------------------|
| `specs/security/ib-authentication.feature` | §1.2.5, §1.6, ГОСТ РД-40–43, §2.1 логирования |
| `specs/security/ib-access-control.feature` | §1.3–1.5, §1.7, ГОСТ УЗП.24–25, §2.2 логирования |
| `specs/security/ib-audit-logging.feature` | §1.2.6–1.2.7, basic §3, §1–4 логирования, ГОСТ УЗП.22–28, РД-40–43, ИУ.7, ЦЗИ.28–30 |

---

## 7. Опросник полноты логирования — статус (Checklist)

| Тип события | Применимо | Реализовано | Gap |
|-------------|-----------|-------------|-----|
| **1.1 Аутентификация** | | | |
| Аутентификация (login/sso) | Да | ❌ | GAP-1 |
| Блокировка/разблокировка аккаунта | Да | ⚠️ Redis-only | GAP-1, GAP-4 |
| Выход из системы | Да | ❌ | GAP-1 |
| **1.2 События администрирования** | | | |
| Создание/удаление/изменение аккаунта | Да | ⚠️ approve-only | GAP-9 |
| Блокировка/разблокировка пользователем-admin | Да | ❌ | GAP-4 |
| Добавление/удаление прав/ролей | Да | ⚠️ WorkspaceEvent | GAP-8 |
| Изменение ролевой модели | Да | ⚠️ частично | GAP-10 |
| **1.3 Аудит действий администраторов** | | | |
| Изменение настроек сервера/БД | Да | ❌ | GAP-9 |
| Изменение настроек аудита | Да | ❌ | GAP-8 |
| Запуск/остановка сервисов | Да | ❌ | GAP-6 |
| Изменение крипто-настроек | Да | ❌ | УЗП.28 |
| Изменение политик аутентификации | Да | ❌ | — |
| Выгрузка данных | Да | ❌ | GAP-5 (data.export) |
| Загрузка данных | Н/А | — | — |
| **1.4 Привилегированные пользователи** | | | |
| Операции над финансовыми инструментами | Н/А | — | — |
| Выгрузка данных | Да | ❌ | GAP-5 |
| **1.5 Аудит действий пользователей** | | | |
| Потенциально деструктивные действия | Да | ❌ | GAP-8 |
| Выгрузка данных пользователями | Да | ❌ | GAP-5 |
| **1.6 Системные события** | | | |
| Ошибки валидации | Да | ❌ | GAP-8 |
| Запуск/остановка процессов | Да | ❌ | GAP-6 |
| Реагирование на сбой журналирования | Да | ❌ | GAP-3 |
| Установка/удаление обновлений | Да | ❌ | GAP-6 |
