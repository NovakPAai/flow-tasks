import { z } from 'zod';
import { registry } from '../registry.js';
import { createCommentDto, updateCommentDto } from '../../../modules/comments/comments.dto.js';

const tidParam = z.object({ tid: z.string().uuid() });
const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get', path: '/tasks/{tid}/comments', tags: ['Comments'], summary: 'Комментарии к задаче',
  request: { params: tidParam },
  responses: { 200: { description: 'Массив комментариев с пагинацией' } },
});

registry.registerPath({
  method: 'post', path: '/tasks/{tid}/comments', tags: ['Comments'], summary: 'Добавить комментарий',
  request: { params: tidParam, body: { content: { 'application/json': { schema: createCommentDto } } } },
  responses: { 201: { description: 'Создан' } },
});

registry.registerPath({
  method: 'patch', path: '/comments/{id}', tags: ['Comments'], summary: 'Обновить комментарий',
  request: { params: idParam, body: { content: { 'application/json': { schema: updateCommentDto } } } },
  responses: { 200: { description: 'Обновлён' }, 403: { description: 'Не автор' } },
});

registry.registerPath({
  method: 'delete', path: '/comments/{id}', tags: ['Comments'], summary: 'Удалить комментарий',
  request: { params: idParam },
  responses: { 204: { description: 'Удалён' } },
});
