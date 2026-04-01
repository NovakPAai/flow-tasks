import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createChecklistDto, createChecklistItemDto, updateChecklistItemDto } from './checklists.dto.js';
import * as checklists from './checklists.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /tasks/:tid/checklists ───────────────────────────────────────────────────
export const taskChecklistsRouter = Router({ mergeParams: true });
taskChecklistsRouter.use(authenticate);

taskChecklistsRouter.post('/', validate(createChecklistDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await checklists.createChecklist(String(req.params.tid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

// ─── /checklists/:id ──────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await checklists.deleteChecklist(String(req.params.id), req.user!.userId);
    res.json({ message: 'Checklist deleted' });
  } catch (e) { next(e); }
});

router.post('/:id/items', validate(createChecklistItemDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await checklists.createChecklistItem(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

export default router;

// ─── /checklist-items/:id ─────────────────────────────────────────────────────
export const checklistItemsRouter = Router();
checklistItemsRouter.use(authenticate);

checklistItemsRouter.patch('/:id', validate(updateChecklistItemDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await checklists.updateChecklistItem(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

checklistItemsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await checklists.deleteChecklistItem(String(req.params.id), req.user!.userId);
    res.json({ message: 'Item deleted' });
  } catch (e) { next(e); }
});
