import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createCommentDto, updateCommentDto } from './comments.dto.js';
import * as comments from './comments.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /tasks/:tid/comments ─────────────────────────────────────────────────────
export const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(authenticate);

taskCommentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await comments.listComments(String(req.params.tid), req.user!.userId));
  } catch (e) { next(e); }
});

taskCommentsRouter.post('/', validate(createCommentDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await comments.createComment(String(req.params.tid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

// ─── /comments/:id ────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.patch('/:id', validate(updateCommentDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await comments.updateComment(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await comments.deleteComment(String(req.params.id), req.user!.userId);
    res.json({ message: 'Comment deleted' });
  } catch (e) { next(e); }
});

export default router;
