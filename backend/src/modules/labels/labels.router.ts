import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createLabelDto, updateLabelDto } from './labels.dto.js';
import * as labels from './labels.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /workspaces/:wid/labels ──────────────────────────────────────────────────
export const workspaceLabelsRouter = Router({ mergeParams: true });
workspaceLabelsRouter.use(authenticate);

workspaceLabelsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await labels.listLabels(String(req.params.wid), req.user!.userId));
  } catch (e) { next(e); }
});

workspaceLabelsRouter.post('/', validate(createLabelDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await labels.createLabel(String(req.params.wid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

// ─── /labels/:id ─────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.patch('/:id', validate(updateLabelDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await labels.updateLabel(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await labels.deleteLabel(String(req.params.id), req.user!.userId);
    res.json({ message: 'Label deleted' });
  } catch (e) { next(e); }
});

export default router;

// ─── /tasks/:tid/labels ───────────────────────────────────────────────────────
export const taskLabelsRouter = Router({ mergeParams: true });
taskLabelsRouter.use(authenticate);

taskLabelsRouter.post('/:labelId', async (req: AuthRequest, res, next) => {
  try {
    res.json(await labels.addLabelToTask(String(req.params.tid), String(req.params.labelId), req.user!.userId));
  } catch (e) { next(e); }
});

taskLabelsRouter.delete('/:labelId', async (req: AuthRequest, res, next) => {
  try {
    res.json(await labels.removeLabelFromTask(String(req.params.tid), String(req.params.labelId), req.user!.userId));
  } catch (e) { next(e); }
});
