import { registry } from '../registry.js';
import {
  createTaskDto,
  updateTaskDto,
  taskFiltersDto,
  bulkUpdateDto,
  bulkDeleteDto,
  reorderTasksDto,
  myTasksFiltersDto,
} from '../../../modules/tasks/tasks.dto.js';

registry.registerPath({
  method: 'get', path: '/boards/{bid}/tasks', tags: ['Tasks'], summary: 'Задачи доски (с фильтрами)',
  request: {
    params: { type: 'object', properties: { bid: { type: 'string' } }, required: ['bid'] } as never,
    query: taskFiltersDto,
  },
  responses: { 200: { description: 'Массив задач' } },
});

registry.registerPath({
  method: 'post', path: '/boards/{bid}/tasks', tags: ['Tasks'], summary: 'Создать задачу',
  request: {
    params: { type: 'object', properties: { bid: { type: 'string' } }, required: ['bid'] } as never,
    body: { content: { 'application/json': { schema: createTaskDto } } },
  },
  responses: { 201: { description: 'Создана' }, 400: { description: 'Ошибка валидации' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{bid}/tasks/reorder', tags: ['Tasks'], summary: 'Переупорядочить задачи (DnD)',
  request: {
    params: { type: 'object', properties: { bid: { type: 'string' } }, required: ['bid'] } as never,
    body: { content: { 'application/json': { schema: reorderTasksDto } } },
  },
  responses: { 200: { description: 'OK' } },
});

registry.registerPath({
  method: 'patch', path: '/boards/{bid}/tasks/bulk', tags: ['Tasks'], summary: 'Массовое обновление задач (до 100)',
  request: {
    params: { type: 'object', properties: { bid: { type: 'string' } }, required: ['bid'] } as never,
    body: { content: { 'application/json': { schema: bulkUpdateDto } } },
  },
  responses: { 200: { description: 'Обновлены' }, 400: { description: 'Ошибка валидации' } },
});

registry.registerPath({
  method: 'post', path: '/boards/{bid}/tasks/bulk-delete', tags: ['Tasks'], summary: 'Массовое удаление задач (до 100)',
  request: {
    params: { type: 'object', properties: { bid: { type: 'string' } }, required: ['bid'] } as never,
    body: { content: { 'application/json': { schema: bulkDeleteDto } } },
  },
  responses: { 200: { description: 'Удалены' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Получить задачу по ID',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Задача' }, 404: { description: 'Не найдена' } },
});

registry.registerPath({
  method: 'patch', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Обновить задачу',
  request: {
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never,
    body: { content: { 'application/json': { schema: updateTaskDto } } },
  },
  responses: { 200: { description: 'Обновлена' } },
});

registry.registerPath({
  method: 'patch', path: '/tasks/{id}/move', tags: ['Tasks'], summary: 'Переместить задачу в другой статус',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Перемещена' } },
});

registry.registerPath({
  method: 'delete', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Удалить задачу',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 204: { description: 'Удалена' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}/subtasks', tags: ['Tasks'], summary: 'Подзадачи (до 5 уровней)',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Массив подзадач' } },
});

registry.registerPath({
  method: 'get', path: '/tasks/{id}/history', tags: ['Tasks'], summary: 'История изменений задачи',
  request: { params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as never },
  responses: { 200: { description: 'Массив событий истории' } },
});

registry.registerPath({
  method: 'get', path: '/my-tasks', tags: ['Tasks'], summary: 'Задачи назначенные текущему пользователю',
  request: { query: myTasksFiltersDto },
  responses: { 200: { description: 'Массив задач' } },
});
