import { z } from 'zod';
import { registry } from '../registry.js';
import { createBoardDto, updateBoardDto } from '../../../modules/boards/boards.dto.js';

const widParam = z.object({ wid: z.string().uuid() });
const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get', path: '/workspaces/{wid}/boards', tags: ['Boards'], summary: 'Доски воркспейса',
  request: { params: widParam },
  responses: { 200: { description: 'Массив досок' } },
});

registry.registerPath({
  method: 'post', path: '/workspaces/{wid}/boards', tags: ['Boards'], summary: 'Создать доску',
  request: { params: widParam, body: { content: { 'application/json': { schema: createBoardDto } } } },
  responses: { 201: { description: 'Создана' }, 409: { description: 'Prefix занят' } },
});

registry.registerPath({
  method: 'get', path: '/boards/{id}', tags: ['Boards'], summary: 'Получить доску по ID или prefix',
  request: { params: idParam },
  responses: { 200: { description: 'Доска с workflow и статусами' }, 404: { description: 'Не найдена' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{id}', tags: ['Boards'], summary: 'Обновить доску',
  request: { params: idParam, body: { content: { 'application/json': { schema: updateBoardDto } } } },
  responses: { 200: { description: 'Обновлена' } },
});

registry.registerPath({
  method: 'delete', path: '/boards/{id}', tags: ['Boards'], summary: 'Удалить доску',
  request: { params: idParam },
  responses: { 204: { description: 'Удалена' } },
});
