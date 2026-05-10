import { z } from 'zod';
import { registry } from '../registry.js';
import {
  createTaskDto,
  updateTaskDto,
  bulkUpdateDto,
  bulkDeleteDto,
  reorderTasksDto,
  myTasksFiltersDto,
} from '../../../modules/tasks/tasks.dto.js';

const bidParam = z.object({ bid: z.string().uuid() });
const idParam = z.object({ id: z.string().uuid() });

// Simplified query schema without coerce/transform for OpenAPI compatibility
const taskFiltersQuery = z.object({
  statusId:   z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority:   z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  labelId:    z.string().uuid().optional(),
  search:     z.string().max(200).optional(),
  duePreset:  z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
  limit:      z.string().optional().describe('Default: 100, max: 500'),
  offset:     z.string().optional().describe('Default: 0'),
});

const myTasksQuery = z.object({
  priority:    z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  duePreset:   z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
  search:      z.string().max(200).optional(),
  workspaceId: z.string().uuid().optional(),
  limit:       z.string().optional(),
  offset:      z.string().optional(),
});

registry.registerPath({
  method: 'get', path: '/boards/{bid}/tasks', tags: ['Tasks'], summary: 'Задачи доски (с серверными фильтрами)',
  request: { params: bidParam, query: taskFiltersQuery },
  responses: { 200: { description: 'Массив задач' } },
});

registry.registerPath({
  method: 'post', path: '/boards/{bid}/tasks', tags: ['Tasks'], summary: 'Создать задачу',
  request: { params: bidParam, body: { content: { 'application/json': { schema: createTaskDto } } } },
  responses: { 201: { description: 'Создана' }, 400: { description: 'Ошибка валидации' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{bid}/tasks/reorder', tags: ['Tasks'], summary: 'Переупорядочить задачи (DnD)',
  request: { params: bidParam, body: { content: { 'application/json': { schema: reorderTasksDto } } } },
  responses: { 200: { description: 'OK' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{bid}/tasks/bulk', tags: ['Tasks'], summary: 'Массовое обновление (до 100)',
  request: { params: bidParam, body: { content: { 'application/json': { schema: bulkUpdateDto } } } },
  responses: { 200: { description: 'Обновлены' } },
});

registry.registerPath({
  method: 'post', path: '/boards/{bid}/tasks/bulk-delete', tags: ['Tasks'], summary: 'Массовое удаление (до 100)',
  request: { params: bidParam, body: { content: { 'application/json': { schema: bulkDeleteDto } } } },
  responses: { 200: { description: 'Удалены' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Получить задачу',
  request: { params: idParam },
  responses: { 200: { description: 'Задача' }, 404: { description: 'Не найдена' } },
});

registry.registerPath({
  method: 'patch', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Обновить задачу',
  request: { params: idParam, body: { content: { 'application/json': { schema: updateTaskDto } } } },
  responses: { 200: { description: 'Обновлена' } },
});

registry.registerPath({
  method: 'patch', path: '/tasks/{id}/move', tags: ['Tasks'], summary: 'Переместить в другой статус',
  request: { params: idParam },
  responses: { 200: { description: 'Перемещена' } },
});

registry.registerPath({
  method: 'delete', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Удалить задачу',
  request: { params: idParam },
  responses: { 204: { description: 'Удалена' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}/subtasks', tags: ['Tasks'], summary: 'Подзадачи (до 5 уровней)',
  request: { params: idParam },
  responses: { 200: { description: 'Массив подзадач' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}/history', tags: ['Tasks'], summary: 'История изменений задачи',
  request: { params: idParam },
  responses: { 200: { description: 'Массив событий' } },
});

registry.registerPath({
  method: 'get', path: '/my-tasks', tags: ['Tasks'], summary: 'Мои задачи',
  request: { query: myTasksQuery },
  responses: { 200: { description: 'Массив задач' } },
});
