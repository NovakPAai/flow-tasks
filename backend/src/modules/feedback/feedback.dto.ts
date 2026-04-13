import { z } from 'zod';

export const feedbackDto = z.object({
  title: z.string().min(3, 'Заголовок слишком короткий').max(200, 'Заголовок слишком длинный'),
  body: z.string().min(10, 'Описание слишком короткое').max(5000, 'Описание слишком длинное'),
  type: z.enum(['bug', 'idea'], { message: 'Тип должен быть bug или idea' }),
});

export type FeedbackDto = z.infer<typeof feedbackDto>;
