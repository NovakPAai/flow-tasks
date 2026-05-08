import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const createUserDto = z.object({
  name: stripHtml(z.string().min(1).max(255)),
  emailPrefix: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._+-]+$/, 'Недопустимые символы в email-префиксе'),
});

export const reviewRequestDto = z.object({
  action: z.enum(['approve', 'reject']),
});

export const updateUserDto = z.object({
  isSuperadmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine((d) => d.isSuperadmin !== undefined || d.isActive !== undefined, {
  message: 'Укажите isSuperadmin или isActive',
});

export const SetUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export const updateConfigDto = z.object({
  registrationDomain: z.string().min(1).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Укажите хотя бы одну настройку',
});

export type CreateUserDto = z.infer<typeof createUserDto>;
export type ReviewRequestDto = z.infer<typeof reviewRequestDto>;
export type UpdateUserDto = z.infer<typeof updateUserDto>;
export type SetUserActiveDto = z.infer<typeof SetUserActiveSchema>;
export type UpdateConfigDto = z.infer<typeof updateConfigDto>;
