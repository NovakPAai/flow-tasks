Создай новый API-эндпоинт по стандартам проекта. Аргументы: $ARGUMENTS

## Использование
```
/new-api attachments POST
/new-api workspaces/:wid/milestones CRUD
/new-api admin/reports GET
```

## Шаги

### 1. Разбери аргументы
- **Путь:** `tasks/:id/attachments` → модуль `attachments`
- **Методы:** `GET`, `POST`, `PATCH`, `DELETE` или `CRUD` (= GET список + POST + GET один + PATCH + DELETE)
- Если аргументы не указаны — спроси путь и методы

### 2. Impact analysis
```
gitnexus_impact({ target: "{смежный сервис или модуль}", direction: "upstream" })
```
Убедиться что новый эндпоинт не конфликтует с существующими маршрутами.

### 3. Создай Zod DTO

Файл: `backend/src/modules/{module}/{module}.dto.ts`

```typescript
import { z } from 'zod';
import { registry } from '../../shared/openapi/registry.js';

export const create{Entity}Dto = registry.register(
  'Create{Entity}',
  z.object({
    // обязательные поля — без .optional()
    name: z.string().min(1).max(255),
    // nullable поля из Prisma (Type?) — .nullable().optional()
    description: z.string().nullable().optional(),
    // FK-поля — .string().uuid()
    workspaceId: z.string().uuid(),
  })
);

export const update{Entity}Dto = registry.register(
  'Update{Entity}',
  // .partial() делает все поля .optional(), но не добавляет .nullable()
  // для nullable полей Prisma — добавь .nullable() явно
  z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
  })
);

export const {entity}FiltersDto = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type Create{Entity}Dto = z.infer<typeof create{Entity}Dto>;
export type Update{Entity}Dto = z.infer<typeof update{Entity}Dto>;
```

**Правила DTO:**
- Nullable в Prisma (`Type?`) → `.nullable().optional()` в Zod — всегда
- Update-схемы: все поля `.optional()`, nullable остаются `.nullable().optional()`
- ВСЕГДА оборачивать через `registry.register()` для OpenAPI генерации

### 4. Зарегистрируй пути в OpenAPI

Файл: `backend/src/shared/openapi/routes/{module}.ts` (создай если нет)

```typescript
import { registry } from '../registry.js';
import { create{Entity}Dto } from '../../modules/{module}/{module}.dto.js';

registry.registerPath({
  method: 'post',
  path: '/api/{path}',
  summary: 'Создать {сущность}',
  tags: ['{Module}'],
  request: {
    body: { content: { 'application/json': { schema: create{Entity}Dto } } },
  },
  responses: {
    201: { description: 'Создано' },
    400: { description: 'Ошибка валидации' },
    401: { description: 'Не авторизован' },
    403: { description: 'Нет прав' },
  },
});
```

Импортируй новый файл в `backend/src/shared/openapi/registry.ts`.

### 5. Создай роутер

Файл: `backend/src/modules/{module}/{module}.router.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';
import { create{Entity}Dto, {entity}FiltersDto } from './{module}.dto.js';
import * as service from './{module}.service.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', validate({entity}FiltersDto, 'query'), authHandler(async (req, res) => {
  res.json(await service.list{Entities}(req.user!.userId, req.query as never));
}));

router.post('/', validate(create{Entity}Dto), authHandler(async (req, res) => {
  res.status(201).json(await service.create{Entity}(req.user!.userId, req.body));
}));

export { router as {module}Router };
```

### 6. Смонтируй в app.ts
```typescript
import { {module}Router } from './modules/{module}/{module}.router.js';
app.use('/api/{path}', {module}Router);
```

### 7. Напиши тесты

Файл: `backend/src/__tests__/{module}.test.ts`

Минимальный набор сценариев:
- POST → 201 + тело ответа
- POST с невалидными данными → 400 + `details`
- GET список → 200 + массив
- GET несуществующего → 404
- Без токена → 401
- Без прав → 403 (если применимо)

### 8. Чеклист
- [ ] DTO зарегистрирован через `registry.register()`
- [ ] OpenAPI пути зарегистрированы в `routes/{module}.ts`
- [ ] Файл роутов импортирован в `registry.ts`
- [ ] Роутер смонтирован в `app.ts`
- [ ] Тесты написаны
- [ ] `npm run check:rbac` — зелёный
