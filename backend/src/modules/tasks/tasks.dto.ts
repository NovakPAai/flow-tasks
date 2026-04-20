import { z } from 'zod';

export const createTaskDto = z.object({
  title: z.string().min(1, 'Название задачи обязательно').max(500, 'Название не должно превышать 500 символов'),
  description: z.string().optional(),
  statusId: z.string().uuid('Некорректный ID статуса').optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW'], { message: 'Приоритет должен быть HIGH, MEDIUM или LOW' }).optional(),
  dueDate: z.string().datetime({ message: 'Введите корректную дату срока' }).optional(),
  startDate: z.string().datetime({ message: 'Введите корректную дату начала' }).optional(),
  assigneeId: z.string().uuid('Некорректный ID исполнителя').optional(),
  parentId: z.string().uuid('Некорректный ID родительской задачи').optional(),
});

export const updateTaskDto = z.object({
  title: z.string().min(1, 'Название задачи обязательно').max(500, 'Название не должно превышать 500 символов').optional(),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW'], { message: 'Приоритет должен быть HIGH, MEDIUM или LOW' }).nullable().optional(),
  dueDate: z.string().datetime({ message: 'Введите корректную дату срока' }).nullable().optional(),
  startDate: z.string().datetime({ message: 'Введите корректную дату начала' }).nullable().optional(),
  assigneeId: z.string().uuid('Некорректный ID исполнителя').nullable().optional(),
});

export const moveTaskDto = z.object({
  statusId: z.string().uuid(),
});

export const reorderTasksDto = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      statusId: z.string().uuid(),
      orderIndex: z.number().int().min(0),
    }),
  ).min(1),
});

export const taskFiltersDto = z.object({
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  labelId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  rootOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  search: z.string().max(200).optional(),
  duePreset: z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const myTasksFiltersDto = z.object({
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  duePreset: z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
  search: z.string().max(200).optional(),
  workspaceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskDto>;
export type UpdateTaskDto = z.infer<typeof updateTaskDto>;
export type TaskFiltersDto = z.infer<typeof taskFiltersDto>;
export type MyTasksFiltersDto = z.infer<typeof myTasksFiltersDto>;
