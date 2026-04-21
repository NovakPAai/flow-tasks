import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  createWorkflowDto,
  updateWorkflowDto,
  addStatusDto,
  updateStatusDto,
  reorderStatusesDto,
  addTransitionDto,
} from './workflows.dto.js';
import * as wf from './workflows.service.js';
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /workspaces/:wid/workflows ───────────────────────────────────────────────
export const workspaceWorkflowsRouter = Router({ mergeParams: true });
workspaceWorkflowsRouter.use(authenticate);

workspaceWorkflowsRouter.get('/', authHandler(async (req, res) => {
  res.json(await wf.listWorkflows(String(req.params.wid), req.user!.userId));
}));

workspaceWorkflowsRouter.post('/', validate(createWorkflowDto), authHandler(async (req, res) => {
  res.status(201).json(await wf.createWorkflow(String(req.params.wid), req.user!.userId, req.body));
}));

// ─── /workflows/:id ───────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', authHandler(async (req, res) => {
  res.json(await wf.getWorkflow(String(req.params.id), req.user!.userId));
}));

router.patch('/:id', validate(updateWorkflowDto), authHandler(async (req, res) => {
  res.json(await wf.updateWorkflow(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await wf.deleteWorkflow(String(req.params.id), req.user!.userId);
  res.json({ message: 'Workflow deleted' });
}));

router.post('/:id/statuses', validate(addStatusDto), authHandler(async (req, res) => {
  res.status(201).json(await wf.addStatus(String(req.params.id), req.user!.userId, req.body));
}));

router.patch('/:id/statuses/reorder', validate(reorderStatusesDto), authHandler(async (req, res) => {
  await wf.reorderStatuses(String(req.params.id), req.user!.userId, req.body.order);
  res.json({ message: 'Reordered' });
}));

router.post('/:id/transitions', validate(addTransitionDto), authHandler(async (req, res) => {
  res.status(201).json(await wf.addTransition(String(req.params.id), req.user!.userId, req.body.fromStatusId, req.body.toStatusId));
}));

router.post('/:id/regenerate-transitions', authHandler(async (req, res) => {
  res.json(await wf.regenerateTransitions(String(req.params.id), req.user!.userId));
}));

// ─── /workflow-statuses/:statusId ────────────────────────────────────────────
export const workflowStatusesRouter = Router();
workflowStatusesRouter.use(authenticate);

workflowStatusesRouter.patch('/:statusId', validate(updateStatusDto), authHandler(async (req, res) => {
  res.json(await wf.updateStatus(String(req.params.statusId), req.user!.userId, req.body));
}));

workflowStatusesRouter.delete('/:statusId', authHandler(async (req, res) => {
  await wf.deleteStatus(String(req.params.statusId), req.user!.userId);
  res.json({ message: 'Status deleted' });
}));

// ─── /workflow-transitions/:transitionId ─────────────────────────────────────
export const workflowTransitionsRouter = Router();
workflowTransitionsRouter.use(authenticate);

workflowTransitionsRouter.delete('/:transitionId', authHandler(async (req, res) => {
  await wf.deleteTransition(String(req.params.transitionId), req.user!.userId);
  res.json({ message: 'Transition deleted' });
}));

export default router;
