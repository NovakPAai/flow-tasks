import { registry } from '../registry.js';
import { createLabelDto } from '../../../modules/labels/labels.dto.js';

registry.registerPath({
  method: 'get', path: '/workspaces/{wid}/labels', tags: ['Labels'], summary: 'Метки воркспейса',
  request: { params: { type: 'object', properties: { wid: { type: 'string' } }, required: ['wid'] } as never },
  responses: { 200: { description: 'Массив меток' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{wid}/labels', tags: ['Labels'], summary: 'Создать метку',
  request: {
    params: { type: 'object', properties: { wid: { type: 'string' } }, required: ['wid'] } as never,
    body: { content: { 'application/json': { schema: createLabelDto } } },
  },
  responses: { 201: { description: 'Создана' } },
});

registry.registerPath({
  method: 'post', path: '/tasks/{tid}/labels/{labelId}', tags: ['Labels'], summary: 'Добавить метку к задаче',
  request: { params: { type: 'object', properties: { tid: { type: 'string' }, labelId: { type: 'string' } }, required: ['tid', 'labelId'] } as never },
  responses: { 200: { description: 'Добавлена' }, 403: { description: 'Метка не принадлежит воркспейсу задачи' } },
});

registry.registerPath({
  method: 'delete', path: '/tasks/{tid}/labels/{labelId}', tags: ['Labels'], summary: 'Удалить метку с задачи',
  request: { params: { type: 'object', properties: { tid: { type: 'string' }, labelId: { type: 'string' } }, required: ['tid', 'labelId'] } as never },
  responses: { 204: { description: 'Удалена' } },
});
