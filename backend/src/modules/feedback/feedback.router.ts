import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';
import { feedbackDto } from './feedback.dto.js';
import * as feedbackService from './feedback.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();

const feedbackLimit = rateLimit({ ...RATE_LIMITS.feedback, keyFn: (req) => (req as AuthRequest).user!.userId });

router.post('/', authenticate, feedbackLimit, validate(feedbackDto), async (req: AuthRequest, res, next) => {
  try {
    const result = await feedbackService.submitFeedback(req.body, {
      id: req.user!.userId,
      name: req.user!.name ?? req.user!.email,
      email: req.user!.email,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
