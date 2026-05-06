import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import * as svc from './notifications.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    res.json(await svc.listNotifications(req.user!.userId, limit, offset));
  } catch (err) { next(err); }
});

router.patch('/read-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await svc.markAllRead(req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await svc.markRead(String(req.params.id), req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
