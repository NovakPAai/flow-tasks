import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { rateLimit } from '../../shared/middleware/rate-limit.js';
import { authHandler } from '../../shared/utils/async-handler.js';
import { globalSearch } from './search.service.js';
import { searchQueryDto } from './search.dto.js';
import type { AuthRequest } from '../../shared/types/index.js';

const searchRouter = Router();

const searchLimit = rateLimit({
  scope: 'search',
  limit: 60,
  windowMs: 60_000,
  keyFn: (req) => (req as AuthRequest).user?.userId ?? req.ip ?? 'anon',
});

searchRouter.get(
  '/',
  authenticate,
  searchLimit,
  validate(searchQueryDto, 'query'),
  authHandler(async (req, res) => {
    const userId = (req as AuthRequest).user!.userId;
    const { q, limit } = searchQueryDto.parse(req.query);
    res.json(await globalSearch(userId, q, limit));
  }),
);

export default searchRouter;
