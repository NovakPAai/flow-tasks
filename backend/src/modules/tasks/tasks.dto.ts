import { z } from 'zod';

export const createTaskDto = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  statusId: z.string().uuid().optional(),   // defaults to first status in board workflow
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
});

export const updateTaskDto = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
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
  parentId: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
  duePreset: z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
});

export const myTasksFiltersDto = z.object({
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  duePreset: z.enum(['today', 'this_week', 'next_week', 'overdue', 'no_date']).optional(),
  search: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskDto>;
export type UpdateTaskDto = z.infer<typeof updateTaskDto>;
export type TaskFiltersDto = z.infer<typeof taskFiltersDto>;
export type MyTasksFiltersDto = z.infer<typeof myTasksFiltersDto>;
