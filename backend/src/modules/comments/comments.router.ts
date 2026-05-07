import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { taskMfaGuard } from '../../shared/middleware/workspace-mfa-guard.js';
import { createCommentDto, updateCommentDto } from './comments.dto.js';
import * as comments from './comments.service.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';

// ─── /tasks/:tid/comments ─────────────────────────────────────────────────────
export const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(authenticate);
taskCommentsRouter.use(asyncHandler(taskMfaGuard('tid')));

taskCommentsRouter.get('/', authHandler(async (req, res) => {
  const rawLimit  = parseInt(String(req.query.limit  ?? '50'), 10);
  const rawOffset = parseInt(String(req.query.offset ?? '0'),  10);
  const limit  = Math.min(Number.isNaN(rawLimit)  ? 50 : rawLimit,  200);
  const offset = Math.max(Number.isNaN(rawOffset) ? 0  : rawOffset, 0);
  res.json(await comments.listComments(String(req.params.tid), req.user!.userId, limit, offset));
}));

taskCommentsRouter.post('/', validate(createCommentDto), authHandler(async (req, res) => {
  res.status(201).json(await comments.createComment(String(req.params.tid), req.user!.userId, req.body));
}));

// ─── /comments/:id ────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.patch('/:id', validate(updateCommentDto), authHandler(async (req, res) => {
  res.json(await comments.updateComment(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await comments.deleteComment(String(req.params.id), req.user!.userId);
  res.json({ message: 'Comment deleted' });
}));

export default router;
