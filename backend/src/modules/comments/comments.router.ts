import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createCommentDto, updateCommentDto } from './comments.dto.js';
import * as comments from './comments.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /tasks/:tid/comments ─────────────────────────────────────────────────────
export const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(authenticate);

taskCommentsRouter.get('/', authHandler(async (req, res) => {
  res.json(await comments.listComments(String(req.params.tid), req.user!.userId));
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
