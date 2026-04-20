import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const createCommentDto = z.object({
  body: stripHtml(z.string().min(1).max(10000)),
});

export const updateCommentDto = z.object({
  body: stripHtml(z.string().min(1).max(10000)),
});

export type CreateCommentDto = z.infer<typeof createCommentDto>;
export type UpdateCommentDto = z.infer<typeof updateCommentDto>;
