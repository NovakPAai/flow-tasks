import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

const passwordSchema = z.string().min(8).max(128)
  .refine((p) => /[A-Z]/.test(p), { message: 'Пароль должен содержать хотя бы одну заглавную букву' })
  .refine((p) => /\d/.test(p), { message: 'Пароль должен содержать хотя бы одну цифру' });

export const registerDto = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: stripHtml(z.string().min(1).max(255)),
});

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileDto = z.object({
  name: stripHtml(z.string().min(1).max(255)).optional(),
  email: z.string().email().optional(),
  emailNotifications: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.email !== undefined || d.emailNotifications !== undefined, {
  message: 'Укажите хотя бы одно поле для обновления',
});

export const forgotPasswordDto = z.object({
  email: z.string().email('Введите корректный email'),
});

export const resetPasswordDto = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type RegisterDto = z.infer<typeof registerDto>;
export type LoginDto = z.infer<typeof loginDto>;
export type UpdateProfileDto = z.infer<typeof updateProfileDto>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
