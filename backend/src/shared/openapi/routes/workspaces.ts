import { registry } from '../registry.js';
import {
  createWorkspaceDto,
  updateWorkspaceDto,
  addMemberDto,
  updateMemberRoleDto,
  inviteByEmailDto,
} from '../../../modules/workspaces/workspaces.dto.js';

registry.registerPath({
  method: 'get', path: '/workspaces', tags: ['Workspaces'], summary: 'Список рабочих пространств пользователя',
  responses: { 200: { description: 'Массив воркспейсов' }, 401: { description: 'Не авторизован' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces', tags: ['Workspaces'], summary: 'Создать воркспейс',
  request: { body: { content: { 'application/json': { schema: createWorkspaceDto } } } },
  responses: { 201: { description: 'Создан' }, 400: { description: 'Ошибка валидации' }, 409: { description: 'Slug уже занят' } },
});

registry.registerPath({
  method: 'get', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Получить воркспейс',
  request: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Воркспейс' }, 404: { description: 'Не найден' } },
});

registry.registerPath({
  method: 'patch', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Обновить воркспейс',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: updateWorkspaceDto } } },
  },
  responses: { 200: { description: 'Обновлён' }, 403: { description: 'Нет прав' } },
});

registry.registerPath({
  method: 'delete', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Удалить воркспейс',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 204: { description: 'Удалён' }, 403: { description: 'Только Owner' } },
});

registry.registerPath({
  method: 'get', path: '/workspaces/{id}/members', tags: ['Workspaces'], summary: 'Участники воркспейса',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Массив участников с ролями' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{id}/invite', tags: ['Workspaces'], summary: 'Пригласить участника по email',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: inviteByEmailDto } } },
  },
  responses: { 200: { description: 'Участник добавлен' }, 404: { description: 'Пользователь не найден' } },
});

registry.registerPath({
  method: 'patch', path: '/workspaces/{id}/members/{userId}', tags: ['Workspaces'], summary: 'Изменить роль участника',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' }, userId: { type: 'string' } }, required: ['id', 'userId'] } as never,
    body: { content: { 'application/json': { schema: updateMemberRoleDto } } },
  },
  responses: { 200: { description: 'Роль обновлена' }, 403: { description: 'Только Owner' } },
});

registry.registerPath({
  method: 'delete', path: '/workspaces/{id}/members/{userId}', tags: ['Workspaces'], summary: 'Удалить участника',
  request: { params: { type: 'object', properties: { id: { type: 'string' }, userId: { type: 'string' } }, required: ['id', 'userId'] } as never },
  responses: { 204: { description: 'Удалён' } },
});
