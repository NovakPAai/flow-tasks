import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const createChecklistDto = z.object({
  title: stripHtml(z.string().min(1).max(200)),
});

export const createChecklistItemDto = z.object({
  title: stripHtml(z.string().min(1).max(500)),
});

export const updateChecklistItemDto = z.object({
  title: stripHtml(z.string().min(1).max(500)).optional(),
  isDone: z.boolean().optional(),
});

export type CreateChecklistDto = z.infer<typeof createChecklistDto>;
export type CreateChecklistItemDto = z.infer<typeof createChecklistItemDto>;
export type UpdateChecklistItemDto = z.infer<typeof updateChecklistItemDto>;
