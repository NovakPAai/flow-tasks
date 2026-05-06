import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

const metaSchema = z.object({
  ua:         z.string().max(500),
  screen:     z.string().max(50),
  viewport:   z.string().max(50),
  url:        z.string().max(500).url().optional().or(z.literal('')),
  language:   z.string().max(20),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  os:         z.string().max(50).optional(),
  browser:    z.string().max(50).optional(),
});

export const feedbackDto = z.object({
  title: stripHtml(z.string().min(3, 'Заголовок слишком короткий').max(200, 'Заголовок слишком длинный')),
  body: stripHtml(z.string().min(10, 'Описание слишком короткое').max(5000, 'Описание слишком длинное')),
  type: z.enum(['bug', 'idea'], { message: 'Тип должен быть bug или idea' }),
  // multipart sends meta as a JSON string; preprocess handles both cases
  meta: z.preprocess(
    (v) => (typeof v === 'string' ? JSON.parse(v) : v),
    metaSchema,
  ).optional(),
});

export type FeedbackDto = z.infer<typeof feedbackDto>;

export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SCREENSHOT_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
