import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const feedbackDto = z.object({
  title: stripHtml(z.string().min(3, 'Заголовок слишком короткий').max(200, 'Заголовок слишком длинный')),
  body: stripHtml(z.string().min(10, 'Описание слишком короткое').max(5000, 'Описание слишком длинное')),
  type: z.enum(['bug', 'idea'], { message: 'Тип должен быть bug или idea' }),
  meta: z.object({
    ua:         z.string().max(500),
    screen:     z.string().max(50),
    viewport:   z.string().max(50),
    url:        z.string().max(500),
    language:   z.string().max(20),
    deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
    os:         z.string().max(50).optional(),
    browser:    z.string().max(50).optional(),
  }).optional(),
});

export type FeedbackDto = z.infer<typeof feedbackDto>;
