import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createBoardDto, updateBoardDto } from './boards.dto.js';
import * as boards from './boards.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /workspaces/:wid/boards ──────────────────────────────────────────────────
export const workspaceBoardsRouter = Router({ mergeParams: true });
workspaceBoardsRouter.use(authenticate);

workspaceBoardsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await boards.listBoards(String(req.params.wid), req.user!.userId));
  } catch (e) { next(e); }
});

workspaceBoardsRouter.post('/', validate(createBoardDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await boards.createBoard(String(req.params.wid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

// ─── /boards/:id ─────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await boards.getBoard(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.patch('/:id', validate(updateBoardDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await boards.updateBoard(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await boards.deleteBoard(String(req.params.id), req.user!.userId);
    res.json({ message: 'Board deleted' });
  } catch (e) { next(e); }
});

export default router;
