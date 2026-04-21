import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createBoardDto, updateBoardDto } from './boards.dto.js';
import * as boards from './boards.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /workspaces/:wid/boards ──────────────────────────────────────────────────
export const workspaceBoardsRouter = Router({ mergeParams: true });
workspaceBoardsRouter.use(authenticate);

workspaceBoardsRouter.get('/', authHandler(async (req, res) => {
  res.json(await boards.listBoards(String(req.params.wid), req.user!.userId));
}));

workspaceBoardsRouter.post('/', validate(createBoardDto), authHandler(async (req, res) => {
  res.status(201).json(await boards.createBoard(String(req.params.wid), req.user!.userId, req.body));
}));

// ─── /boards/:id ─────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', authHandler(async (req, res) => {
  res.json(await boards.getBoard(String(req.params.id), req.user!.userId));
}));

router.patch('/:id', validate(updateBoardDto), authHandler(async (req, res) => {
  res.json(await boards.updateBoard(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await boards.deleteBoard(String(req.params.id), req.user!.userId);
  res.json({ message: 'Board deleted' });
}));

export default router;
