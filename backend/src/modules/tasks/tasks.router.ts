import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  createTaskDto,
  updateTaskDto,
  moveTaskDto,
  reorderTasksDto,
  taskFiltersDto,
  myTasksFiltersDto,
} from './tasks.dto.js';
import * as tasks from './tasks.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

// ─── /boards/:bid/tasks ───────────────────────────────────────────────────────
export const boardTasksRouter = Router({ mergeParams: true });
boardTasksRouter.use(authenticate);

boardTasksRouter.get('/', validate(taskFiltersDto, 'query'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.listTasks(String(req.params.bid), req.user!.userId, req.query as never));
  } catch (e) { next(e); }
});

boardTasksRouter.post('/', validate(createTaskDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await tasks.createTask(String(req.params.bid), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

boardTasksRouter.patch('/reorder', validate(reorderTasksDto), async (req: AuthRequest, res, next) => {
  try {
    await tasks.reorderTasks(String(req.params.bid), req.user!.userId, req.body.updates);
    res.json({ message: 'Reordered' });
  } catch (e) { next(e); }
});

// ─── /tasks/:id ───────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.getTask(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.get('/:id/subtree', async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.getSubtree(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.patch('/:id', validate(updateTaskDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.updateTask(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.patch('/:id/move', validate(moveTaskDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.moveTask(String(req.params.id), req.user!.userId, req.body.statusId));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await tasks.deleteTask(String(req.params.id), req.user!.userId);
    res.json({ message: 'Task deleted' });
  } catch (e) { next(e); }
});

export default router;

// ─── /my-tasks ────────────────────────────────────────────────────────────────
export const myTasksRouter = Router();
myTasksRouter.use(authenticate);

myTasksRouter.get('/', validate(myTasksFiltersDto, 'query'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await tasks.listMyTasks(req.user!.userId, req.query as never));
  } catch (e) { next(e); }
});
