import { z } from 'zod';

export const createLabelDto = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
});

export const updateLabelDto = createLabelDto.partial();

export type CreateLabelDto = z.infer<typeof createLabelDto>;
export type UpdateLabelDto = z.infer<typeof updateLabelDto>;
