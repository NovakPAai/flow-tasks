import { z } from 'zod';

const passwordSchema = z.string().min(8).max(128)
  .refine((p) => /[A-Z]/.test(p), { message: 'Пароль должен содержать хотя бы одну заглавную букву' })
  .refine((p) => /\d/.test(p), { message: 'Пароль должен содержать хотя бы одну цифру' });

export const registerDto = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(255),
});

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileDto = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.name !== undefined || d.email !== undefined, {
  message: 'Укажите хотя бы одно поле для обновления',
});

export type RegisterDto = z.infer<typeof registerDto>;
export type LoginDto = z.infer<typeof loginDto>;
export type UpdateProfileDto = z.infer<typeof updateProfileDto>;
