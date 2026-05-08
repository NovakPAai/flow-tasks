import { z } from 'zod';
import { registry } from '../registry.js';

const searchQuery = z.object({
  q:     z.string().min(2).max(200).describe('Поисковый запрос, минимум 2 символа'),
  limit: z.string().optional().describe('Максимум результатов, default: 5, max: 10'),
});

registry.registerPath({
  method: 'get', path: '/search', tags: ['Search'], summary: 'Глобальный поиск задач (Cmd+K)',
  request: { query: searchQuery },
  responses: {
    200: { description: 'Массив задач (до 10)' },
    429: { description: 'Rate limit: 30 req/min' },
  },
});
