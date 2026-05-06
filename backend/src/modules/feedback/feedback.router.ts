import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';
import { feedbackDto, SCREENSHOT_MAX_BYTES, SCREENSHOT_ALLOWED_MIME } from './feedback.dto.js';
import * as feedbackService from './feedback.service.js';
import type { AuthRequest } from '../../shared/types/index.js';
import { AppError } from '../../shared/middleware/error-handler.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SCREENSHOT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((SCREENSHOT_ALLOWED_MIME as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Допустимые форматы: PNG, JPG, WEBP, GIF') as unknown as null, false);
    }
  },
});

const feedbackLimit = rateLimit({ ...RATE_LIMITS.feedback, keyFn: (req) => (req as AuthRequest).user!.userId });

router.post('/', authenticate, feedbackLimit, upload.single('screenshot'), validate(feedbackDto), async (req: AuthRequest, res, next) => {
  try {
    const result = await feedbackService.submitFeedback(req.body, {
      id: req.user!.userId,
      name: req.user!.name ?? req.user!.email,
      email: req.user!.email,
    }, req.file ?? undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
