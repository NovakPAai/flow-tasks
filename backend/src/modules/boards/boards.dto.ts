import { z } from 'zod';

export const createBoardDto = z.object({
  name: z.string().min(1, 'Название доски обязательно').max(100, 'Название не должно превышать 100 символов'),
  prefix: z
    .string()
    .min(2, 'Префикс должен содержать минимум 2 символа')
    .max(8, 'Префикс не должен превышать 8 символов')
    .regex(/^[A-Z0-9]+$/, 'Префикс должен содержать только заглавные латинские буквы и цифры')
    .transform((v) => v.toUpperCase()),
  description: z.string().max(500, 'Описание не должно превышать 500 символов').optional(),
  workflowId: z.string().uuid('Некорректный ID workflow').optional(),
});

export const updateBoardDto = z.object({
  name: z.string().min(1, 'Название доски обязательно').max(100, 'Название не должно превышать 100 символов').optional(),
  description: z.string().max(500, 'Описание не должно превышать 500 символов').optional(),
  workflowId: z.string().uuid('Некорректный ID workflow').optional(),
});

export type CreateBoardDto = z.infer<typeof createBoardDto>;
export type UpdateBoardDto = z.infer<typeof updateBoardDto>;
