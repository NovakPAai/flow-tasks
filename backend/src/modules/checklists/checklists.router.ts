import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createChecklistDto, createChecklistItemDto, updateChecklistItemDto } from './checklists.dto.js';
import * as checklists from './checklists.service.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';
import { taskMfaGuard, checklistMfaGuard, checklistItemMfaGuard } from '../../shared/middleware/workspace-mfa-guard.js';

// ─── /tasks/:tid/checklists ───────────────────────────────────────────────────
export const taskChecklistsRouter = Router({ mergeParams: true });
taskChecklistsRouter.use(authenticate);
taskChecklistsRouter.use(asyncHandler(taskMfaGuard('tid')));

taskChecklistsRouter.post('/', validate(createChecklistDto), authHandler(async (req, res) => {
  res.status(201).json(await checklists.createChecklist(String(req.params.tid), req.user!.userId, req.body));
}));

// ─── /checklists/:id ──────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);
router.use('/:id', asyncHandler(checklistMfaGuard()));

router.delete('/:id', authHandler(async (req, res) => {
  await checklists.deleteChecklist(String(req.params.id), req.user!.userId);
  res.json({ message: 'Checklist deleted' });
}));

router.post('/:id/items', validate(createChecklistItemDto), authHandler(async (req, res) => {
  res.status(201).json(await checklists.createChecklistItem(String(req.params.id), req.user!.userId, req.body));
}));

export default router;

// ─── /checklist-items/:id ─────────────────────────────────────────────────────
export const checklistItemsRouter = Router();
checklistItemsRouter.use(authenticate);
checklistItemsRouter.use('/:id', asyncHandler(checklistItemMfaGuard()));

checklistItemsRouter.patch('/:id', validate(updateChecklistItemDto), authHandler(async (req, res) => {
  res.json(await checklists.updateChecklistItem(String(req.params.id), req.user!.userId, req.body));
}));

checklistItemsRouter.delete('/:id', authHandler(async (req, res) => {
  await checklists.deleteChecklistItem(String(req.params.id), req.user!.userId);
  res.json({ message: 'Item deleted' });
}));
