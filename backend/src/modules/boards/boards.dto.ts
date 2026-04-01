import { z } from 'zod';

export const createBoardDto = z.object({
  name: z.string().min(1).max(100),
  prefix: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, 'Prefix must be uppercase letters and numbers only')
    .transform((v) => v.toUpperCase()),
  description: z.string().max(500).optional(),
  workflowId: z.string().uuid().optional(), // defaults to workspace default workflow
});

export const updateBoardDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  workflowId: z.string().uuid().optional(),
});

export type CreateBoardDto = z.infer<typeof createBoardDto>;
export type UpdateBoardDto = z.infer<typeof updateBoardDto>;
