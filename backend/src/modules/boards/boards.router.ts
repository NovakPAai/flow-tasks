import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { workspaceMfaGuard, boardMfaGuard } from '../../shared/middleware/workspace-mfa-guard.js';
import { createBoardDto, updateBoardDto } from './boards.dto.js';
import * as boards from './boards.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /workspaces/:wid/boards ──────────────────────────────────────────────────
export const workspaceBoardsRouter = Router({ mergeParams: true });
workspaceBoardsRouter.use(authenticate);
workspaceBoardsRouter.use(authHandler(workspaceMfaGuard('wid')));

workspaceBoardsRouter.get('/', authHandler(async (req, res) => {
  res.json(await boards.listBoards(String(req.params.wid), req.user!.userId));
}));

workspaceBoardsRouter.post('/', validate(createBoardDto), authHandler(async (req, res) => {
  res.status(201).json(await boards.createBoard(String(req.params.wid), req.user!.userId, req.body));
}));

// ─── /boards/:id ─────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);
router.use('/:id', authHandler(boardMfaGuard()));

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/:id/roadmap', authHandler(async (req, res) => {
  const from = typeof req.query.from === 'string' && DATE_RE.test(req.query.from) ? req.query.from : undefined;
  const to   = typeof req.query.to   === 'string' && DATE_RE.test(req.query.to)   ? req.query.to   : undefined;
  res.json(await boards.getRoadmapTasks(String(req.params.id), req.user!.userId, from, to));
}));

export default router;
