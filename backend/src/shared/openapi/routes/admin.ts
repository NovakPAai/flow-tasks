import { z } from 'zod';
import { registry } from '../registry.js';
import { createUserDto, reviewRequestDto, updateUserDto } from '../../../modules/admin/admin.dto.js';

const idParam = z.object({ id: z.string().uuid() });

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
  request: { params: idParam, body: { content: { 'application/json': { schema: updateUserDto } } } },
  responses: { 200: { description: 'Обновлён' } },
});

registry.registerPath({
  method: 'get', path: '/admin/users/{id}/stats', tags: ['Admin'], summary: 'Статистика пользователя',
  request: { params: idParam },
  responses: { 200: { description: 'Статистика: задачи, воркспейсы, активность' } },
});

registry.registerPath({
  method: 'get', path: '/admin/registration-requests', tags: ['Admin'], summary: 'Заявки на регистрацию',
  responses: { 200: { description: 'Массив заявок PENDING' } },
});

registry.registerPath({
  method: 'patch', path: '/admin/registration-requests/{id}', tags: ['Admin'], summary: 'Одобрить / отклонить заявку',
  request: { params: idParam, body: { content: { 'application/json': { schema: reviewRequestDto } } } },
  responses: { 200: { description: 'Заявка обработана' } },
});
