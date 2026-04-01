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
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /workspaces/:wid/workflows ───────────────────────────────────────────────
export const workspaceWorkflowsRouter = Router({ mergeParams: true });
workspaceWorkflowsRouter.use(authenticate);

workspaceWorkflowsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await wf.listWorkflows(String(req.params.wid), req.user!.userId));
  } catch (e) { next(e); }
});

workspaceWorkflowsRouter.post('/', validate(createWorkflowDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await wf.createWorkflow(String(req.params.wid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

// ─── /workflows/:id ───────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await wf.getWorkflow(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.patch('/:id', validate(updateWorkflowDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await wf.updateWorkflow(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await wf.deleteWorkflow(String(req.params.id), req.user!.userId);
    res.json({ message: 'Workflow deleted' });
  } catch (e) { next(e); }
});

router.post('/:id/statuses', validate(addStatusDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await wf.addStatus(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.patch('/:id/statuses/reorder', validate(reorderStatusesDto), async (req: AuthRequest, res, next) => {
  try {
    await wf.reorderStatuses(String(req.params.id), req.user!.userId, req.body.order);
    res.json({ message: 'Reordered' });
  } catch (e) { next(e); }
});

router.post('/:id/transitions', validate(addTransitionDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await wf.addTransition(String(req.params.id), req.user!.userId, req.body.fromStatusId, req.body.toStatusId));
  } catch (e) { next(e); }
});

router.post('/:id/regenerate-transitions', async (req: AuthRequest, res, next) => {
  try {
    res.json(await wf.regenerateTransitions(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

// ─── /workflow-statuses/:statusId ────────────────────────────────────────────
export const workflowStatusesRouter = Router();
workflowStatusesRouter.use(authenticate);

workflowStatusesRouter.patch('/:statusId', validate(updateStatusDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await wf.updateStatus(String(req.params.statusId), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

workflowStatusesRouter.delete('/:statusId', async (req: AuthRequest, res, next) => {
  try {
    await wf.deleteStatus(String(req.params.statusId), req.user!.userId);
    res.json({ message: 'Status deleted' });
  } catch (e) { next(e); }
});

// ─── /workflow-transitions/:transitionId ─────────────────────────────────────
export const workflowTransitionsRouter = Router();
workflowTransitionsRouter.use(authenticate);

workflowTransitionsRouter.delete('/:transitionId', async (req: AuthRequest, res, next) => {
  try {
    await wf.deleteTransition(String(req.params.transitionId), req.user!.userId);
    res.json({ message: 'Transition deleted' });
  } catch (e) { next(e); }
});

export default router;
