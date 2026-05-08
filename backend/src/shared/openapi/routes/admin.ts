import { registry } from '../registry.js';
import { createUserDto, reviewRequestDto, updateUserDto } from '../../../modules/admin/admin.dto.js';

registry.registerPath({
  method: 'get', path: '/admin/users', tags: ['Admin'], summary: 'Все пользователи (superadmin)',
  responses: { 200: { description: 'Массив пользователей' }, 403: { description: 'Только superadmin' } },
});

registry.registerPath({
  method: 'post', path: '/admin/users', tags: ['Admin'], summary: 'Создать пользователя (superadmin)',
  request: { body: { content: { 'application/json': { schema: createUserDto } } } },
  responses: { 201: { description: 'Создан' }, 403: { description: 'Только superadmin' } },
});

registry.registerPath({
  method: 'patch', path: '/admin/users/{id}', tags: ['Admin'], summary: 'Обновить пользователя (superadmin)',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: updateUserDto } } },
  },
  responses: { 200: { description: 'Обновлён' }, 403: { description: 'Только superadmin' } },
});

registry.registerPath({
  method: 'get', path: '/admin/users/{id}/stats', tags: ['Admin'], summary: 'Статистика пользователя (superadmin)',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Статистика: задачи, воркспейсы, активность' } },
});

registry.registerPath({
  method: 'get', path: '/admin/registration-requests', tags: ['Admin'], summary: 'Заявки на регистрацию (superadmin)',
  responses: { 200: { description: 'Массив заявок со статусом PENDING' } },
});

registry.registerPath({
  method: 'patch', path: '/admin/registration-requests/{id}', tags: ['Admin'], summary: 'Одобрить или отклонить заявку',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: reviewRequestDto } } },
  },
  responses: { 200: { description: 'Заявка обработана' } },
});
