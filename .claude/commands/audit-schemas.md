Аудит Zod-схем (DTO) на соответствие Prisma-модели. Аргументы: $ARGUMENTS

## Контекст

Частая проблема: поле в Prisma nullable (`String?`), а в Zod Create-схеме только `.optional()` без `.nullable()`. Это приводит к ошибке валидации, когда клиент отправляет `null`.

Обратная проблема: поле required в Prisma (без `?` и без `@default`), но в Zod помечено `.optional()` — Prisma упадёт при INSERT с неясной ошибкой.

## Шаги

### 1. Определи проект
Prisma схема: `backend/src/prisma/schema.prisma`. DTO: `backend/src/modules/**/*.dto.ts`.

### 2. Прочитай Prisma-схему
Для каждой модели составь карту полей:
- **Nullable:** `Type?` → поле nullable
- **Required:** `Type` без `@default` → поле обязательно при INSERT
- **Default:** `@default(...)` → поле необязательно при INSERT
- **Relation:** `@relation(...)` → пропустить

### 3. Прочитай все DTO-файлы
Для каждой Create/Update схемы проверь каждое поле:

**Категория 1 — Prisma nullable, Zod не nullable:**
Поле `Type?` в Prisma, но в Zod только `.optional()` без `.nullable()`.
Клиент может отправить `null`, Zod отклонит → 400 Bad Request.
Фикс: заменить `.optional()` на `.nullable().optional()`.

**Категория 2 — Prisma required, Zod optional:**
Поле обязательно в БД (`Type` без `?` и без `@default`), но Zod пропускает `undefined`.
Риск: Prisma упадёт при INSERT.
Фикс: убрать `.optional()` или добавить `.default()`.

**Категория 3 — Update-схемы:**
В Update-схемах все поля `.optional()`.
Nullable в Prisma → `.nullable().optional()` (`.partial()` не добавляет `.nullable()` автоматически).

### 4. Составь отчёт

Для каждого нарушения:
```
Файл: backend/src/modules/tasks/tasks.dto.ts
Схема: createTaskDto
Поле: assigneeId
Prisma: String? (nullable)
Zod: z.string().uuid().optional()  ← НАРУШЕНИЕ категория 1
Фикс: z.string().uuid().nullable().optional()
```

Если нарушений нет — сообщить "Все схемы соответствуют Prisma-модели ✅".

### 5. Примени фиксы
Исправь все нарушения категорий 1 и 2.
Для nullable полей: всегда `.nullable()` стоит ПЕРЕД `.optional()`.
