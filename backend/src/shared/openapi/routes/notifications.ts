import { registry } from '../registry.js';

registry.registerPath({
  method: 'get', path: '/notifications', tags: ['Notifications'], summary: 'Уведомления текущего пользователя',
  responses: { 200: { description: 'Массив уведомлений (непрочитанные первыми)' } },
});

registry.registerPath({
  method: 'patch', path: '/notifications/{id}/read', tags: ['Notifications'], summary: 'Пометить уведомление прочитанным',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Помечено' } },
});

registry.registerPath({
  method: 'post', path: '/notifications/read-all', tags: ['Notifications'], summary: 'Пометить все уведомления прочитанными',
  responses: { 200: { description: 'Все помечены' } },
});
