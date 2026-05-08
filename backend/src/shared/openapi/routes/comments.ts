import { registry } from '../registry.js';
import { createCommentDto, updateCommentDto } from '../../../modules/comments/comments.dto.js';

registry.registerPath({
  method: 'get', path: '/tasks/{tid}/comments', tags: ['Comments'], summary: 'Комментарии к задаче',
  request: { params: { type: 'object', properties: { tid: { type: 'string' } }, required: ['tid'] } as never },
  responses: { 200: { description: 'Массив комментариев с пагинацией' } },
});

registry.registerPath({
  method: 'post', path: '/tasks/{tid}/comments', tags: ['Comments'], summary: 'Добавить комментарий',
  request: {
    params: { type: 'object', properties: { tid: { type: 'string' } }, required: ['tid'] } as never,
    body: { content: { 'application/json': { schema: createCommentDto } } },
  },
  responses: { 201: { description: 'Создан' } },
});

registry.registerPath({
  method: 'patch', path: '/comments/{id}', tags: ['Comments'], summary: 'Обновить комментарий',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: updateCommentDto } } },
  },
  responses: { 200: { description: 'Обновлён' }, 403: { description: 'Не автор' } },
});

registry.registerPath({
  method: 'delete', path: '/comments/{id}', tags: ['Comments'], summary: 'Удалить комментарий',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 204: { description: 'Удалён' } },
});
