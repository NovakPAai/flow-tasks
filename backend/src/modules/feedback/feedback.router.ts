import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { feedbackDto } from './feedback.dto.js';
import * as feedbackService from './feedback.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

const router = Router();

router.post('/', authenticate, validate(feedbackDto), authHandler(async (req, res) => {
  const result = await feedbackService.submitFeedback(req.body, {
    name: req.user!.name ?? req.user!.email,
    email: req.user!.email,
  });
  res.json(result);
}));

export default router;
