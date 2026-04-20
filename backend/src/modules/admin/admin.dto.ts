import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const createUserDto = z.object({
  name: stripHtml(z.string().min(1).max(255)),
  emailPrefix: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._+-]+$/, 'Недопустимые символы в email-префиксе'),
});

export const reviewRequestDto = z.object({
  action: z.enum(['approve', 'reject']),
});

export type CreateUserDto = z.infer<typeof createUserDto>;
export type ReviewRequestDto = z.infer<typeof reviewRequestDto>;
