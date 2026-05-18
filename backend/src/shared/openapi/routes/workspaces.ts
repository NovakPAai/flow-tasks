import { z } from 'zod';
import { registry } from '../registry.js';
import {
  createWorkspaceDto,
  updateWorkspaceDto,
  updateMemberRoleDto,
  inviteByEmailDto,
  candidateSearchQueryDto,
} from '../../../modules/workspaces/workspaces.dto.js';

const idParam = z.object({ id: z.string().uuid() });
const memberParam = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

registry.registerPath({
  method: 'get', path: '/workspaces', tags: ['Workspaces'], summary: 'Список рабочих пространств пользователя',
  responses: { 200: { description: 'Массив воркспейсов' }, 401: { description: 'Не авторизован' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces', tags: ['Workspaces'], summary: 'Создать воркспейс',
  request: { body: { content: { 'application/json': { schema: createWorkspaceDto } } } },
  responses: { 201: { description: 'Создан' }, 400: { description: 'Ошибка валидации' }, 409: { description: 'Slug занят' } },
});

registry.registerPath({
  method: 'get', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Получить воркспейс',
  request: { params: idParam },
  responses: { 200: { description: 'Воркспейс' }, 404: { description: 'Не найден' } },
});

registry.registerPath({
  method: 'patch', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Обновить воркспейс',
  request: { params: idParam, body: { content: { 'application/json': { schema: updateWorkspaceDto } } } },
  responses: { 200: { description: 'Обновлён' }, 403: { description: 'Нет прав' } },
});

registry.registerPath({
  method: 'delete', path: '/workspaces/{id}', tags: ['Workspaces'], summary: 'Удалить воркспейс',
  request: { params: idParam },
  responses: { 204: { description: 'Удалён' }, 403: { description: 'Только Owner' } },
});

registry.registerPath({
  method: 'get', path: '/workspaces/{id}/members', tags: ['Workspaces'], summary: 'Участники воркспейса',
  request: { params: idParam },
  responses: { 200: { description: 'Массив участников с ролями' } },
});

registry.registerPath({
  method: 'get', path: '/workspaces/{id}/members/candidates', tags: ['Workspaces'],
  summary: 'Поиск кандидатов в участники (Owner-only, по всей User базе, rate-limited)',
  request: { params: idParam, query: candidateSearchQueryDto },
  responses: {
    200: { description: 'Массив кандидатов {id,name,email,avatar,alreadyMember}' },
    400: { description: 'Невалидные параметры (q<2 после trim или limit>20)' },
    403: { description: 'Только Owner текущего воркспейса' },
    404: { description: 'Workspace не найден или soft-deleted' },
    429: { description: 'Превышен лимит 30 запросов/минуту' },
  },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{id}/invite', tags: ['Workspaces'], summary: 'Пригласить участника по email',
  request: { params: idParam, body: { content: { 'application/json': { schema: inviteByEmailDto } } } },
  responses: { 200: { description: 'Участник добавлен' }, 404: { description: 'Пользователь не найден' } },
});

registry.registerPath({
  method: 'patch', path: '/workspaces/{id}/members/{userId}', tags: ['Workspaces'], summary: 'Изменить роль участника',
  request: { params: memberParam, body: { content: { 'application/json': { schema: updateMemberRoleDto } } } },
  responses: { 200: { description: 'Роль обновлена' }, 403: { description: 'Только Owner' } },
});

registry.registerPath({
  method: 'delete', path: '/workspaces/{id}/members/{userId}', tags: ['Workspaces'], summary: 'Удалить участника',
  request: { params: memberParam },
  responses: { 204: { description: 'Удалён' } },
});
