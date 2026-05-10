import { z } from 'zod';
import { registry } from '../registry.js';

const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get', path: '/notifications', tags: ['Notifications'], summary: 'Уведомления текущего пользователя',
  responses: { 200: { description: 'Массив уведомлений (непрочитанные первыми)' }, 401: { description: 'Не авторизован' } },
});

registry.registerPath({
  method: 'patch', path: '/notifications/{id}/read', tags: ['Notifications'], summary: 'Пометить прочитанным',
  request: { params: idParam },
  responses: { 200: { description: 'Помечено' } },
});

registry.registerPath({
  method: 'post', path: '/notifications/read-all', tags: ['Notifications'], summary: 'Пометить все прочитанными',
  responses: { 200: { description: 'Все помечены' } },
});
