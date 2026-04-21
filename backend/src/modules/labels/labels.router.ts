import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createLabelDto, updateLabelDto } from './labels.dto.js';
import * as labels from './labels.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /workspaces/:wid/labels ──────────────────────────────────────────────────
export const workspaceLabelsRouter = Router({ mergeParams: true });
workspaceLabelsRouter.use(authenticate);

workspaceLabelsRouter.get('/', authHandler(async (req, res) => {
  res.json(await labels.listLabels(String(req.params.wid), req.user!.userId));
}));

workspaceLabelsRouter.post('/', validate(createLabelDto), authHandler(async (req, res) => {
  res.status(201).json(await labels.createLabel(String(req.params.wid), req.user!.userId, req.body));
}));

// ─── /labels/:id ─────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.patch('/:id', validate(updateLabelDto), authHandler(async (req, res) => {
  res.json(await labels.updateLabel(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await labels.deleteLabel(String(req.params.id), req.user!.userId);
  res.json({ message: 'Label deleted' });
}));

export default router;

// ─── /tasks/:tid/labels ───────────────────────────────────────────────────────
export const taskLabelsRouter = Router({ mergeParams: true });
taskLabelsRouter.use(authenticate);

taskLabelsRouter.post('/:labelId', authHandler(async (req, res) => {
  res.json(await labels.addLabelToTask(String(req.params.tid), String(req.params.labelId), req.user!.userId));
}));

taskLabelsRouter.delete('/:labelId', authHandler(async (req, res) => {
  res.json(await labels.removeLabelFromTask(String(req.params.tid), String(req.params.labelId), req.user!.userId));
}));
