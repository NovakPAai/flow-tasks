import { z } from 'zod';

export const searchQueryDto = z.object({
  q: z.string().min(2, 'Минимум 2 символа').max(200, 'Максимум 200 символов'),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export type SearchQueryDto = z.infer<typeof searchQueryDto>;
