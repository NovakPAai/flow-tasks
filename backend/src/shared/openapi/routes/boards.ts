import { registry } from '../registry.js';
import { createBoardDto, updateBoardDto } from '../../../modules/boards/boards.dto.js';

registry.registerPath({
  method: 'get', path: '/workspaces/{wid}/boards', tags: ['Boards'], summary: 'Доски воркспейса',
  request: { params: { type: 'object', properties: { wid: { type: 'string' } }, required: ['wid'] } as never },
  responses: { 200: { description: 'Массив досок' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{wid}/boards', tags: ['Boards'], summary: 'Создать доску',
  request: {
    params: { type: 'object', properties: { wid: { type: 'string' } }, required: ['wid'] } as never,
    body: { content: { 'application/json': { schema: createBoardDto } } },
  },
  responses: { 201: { description: 'Создана' }, 400: { description: 'Ошибка валидации' }, 409: { description: 'Prefix уже занят' } },
});

registry.registerPath({
  method: 'get', path: '/boards/{id}', tags: ['Boards'], summary: 'Получить доску по ID или prefix',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Доска с workflow и статусами' }, 404: { description: 'Не найдена' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{id}', tags: ['Boards'], summary: 'Обновить доску',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: updateBoardDto } } },
  },
  responses: { 200: { description: 'Обновлена' }, 403: { description: 'Нет прав' } },
});

registry.registerPath({
  method: 'delete', path: '/boards/{id}', tags: ['Boards'], summary: 'Удалить доску',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 204: { description: 'Удалена' } },
});
