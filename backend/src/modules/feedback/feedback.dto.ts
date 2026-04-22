import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const feedbackDto = z.object({
  title: stripHtml(z.string().min(3, 'Заголовок слишком короткий').max(200, 'Заголовок слишком длинный')),
  body: stripHtml(z.string().min(10, 'Описание слишком короткое').max(5000, 'Описание слишком длинное')),
  type: z.enum(['bug', 'idea'], { message: 'Тип должен быть bug или idea' }),
  device: z.object({
    tier: z.enum(['mobile', 'tablet', 'desktop']),
    screenWidth: z.number().int().positive(),
    screenHeight: z.number().int().positive(),
    userAgent: z.string().max(500),
  }).optional(),
});

export type FeedbackDto = z.infer<typeof feedbackDto>;
