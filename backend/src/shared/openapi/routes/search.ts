import { registry } from '../registry.js';
import { searchQueryDto } from '../../../modules/search/search.dto.js';

registry.registerPath({
  method: 'get', path: '/search', tags: ['Search'], summary: 'Глобальный поиск задач (Cmd+K)',
  request: { query: searchQueryDto },
  responses: {
    200: { description: 'Массив задач (до 10). Rate-limit: 30 req/min' },
    429: { description: 'Rate limit exceeded' },
  },
});
