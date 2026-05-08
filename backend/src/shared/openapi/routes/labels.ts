import { z } from 'zod';
import { registry } from '../registry.js';
import { createLabelDto } from '../../../modules/labels/labels.dto.js';

const widParam = z.object({ wid: z.string().uuid() });
const tidLabelParam = z.object({ tid: z.string().uuid(), labelId: z.string().uuid() });

registry.registerPath({
  method: 'get', path: '/workspaces/{wid}/labels', tags: ['Labels'], summary: 'Метки воркспейса',
  request: { params: widParam },
  responses: { 200: { description: 'Массив меток' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{wid}/labels', tags: ['Labels'], summary: 'Создать метку',
  request: { params: widParam, body: { content: { 'application/json': { schema: createLabelDto } } } },
  responses: { 201: { description: 'Создана' } },
});

registry.registerPath({
  method: 'post', path: '/tasks/{tid}/labels/{labelId}', tags: ['Labels'], summary: 'Добавить метку к задаче',
  request: { params: tidLabelParam },
  responses: { 200: { description: 'Добавлена' }, 403: { description: 'Метка не из этого воркспейса' } },
});

registry.registerPath({
  method: 'delete', path: '/tasks/{tid}/labels/{labelId}', tags: ['Labels'], summary: 'Убрать метку с задачи',
  request: { params: tidLabelParam },
  responses: { 204: { description: 'Убрана' } },
});
