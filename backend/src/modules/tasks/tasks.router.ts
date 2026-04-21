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
import { authHandler } from '../../shared/utils/async-handler.js';

// ─── /boards/:bid/tasks ───────────────────────────────────────────────────────
export const boardTasksRouter = Router({ mergeParams: true });
boardTasksRouter.use(authenticate);

boardTasksRouter.get('/', validate(taskFiltersDto, 'query'), authHandler(async (req, res) => {
  res.json(await tasks.listTasks(String(req.params.bid), req.user!.userId, req.query as never));
}));

boardTasksRouter.post('/', validate(createTaskDto), authHandler(async (req, res) => {
  res.status(201).json(await tasks.createTask(String(req.params.bid), req.user!.userId, req.body));
}));

boardTasksRouter.patch('/reorder', validate(reorderTasksDto), authHandler(async (req, res) => {
  await tasks.reorderTasks(String(req.params.bid), req.user!.userId, req.body.updates);
  res.json({ message: 'Reordered' });
}));

// ─── /tasks/:id ───────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get('/:id', authHandler(async (req, res) => {
  res.json(await tasks.getTask(String(req.params.id), req.user!.userId));
}));

router.get('/:id/subtree', authHandler(async (req, res) => {
  res.json(await tasks.getSubtree(String(req.params.id), req.user!.userId));
}));

router.patch('/:id', validate(updateTaskDto), authHandler(async (req, res) => {
  res.json(await tasks.updateTask(String(req.params.id), req.user!.userId, req.body));
}));

router.patch('/:id/move', validate(moveTaskDto), authHandler(async (req, res) => {
  res.json(await tasks.moveTask(String(req.params.id), req.user!.userId, req.body.statusId));
}));

router.get('/:id/history', authHandler(async (req, res) => {
  res.json(await tasks.getTaskHistory(String(req.params.id), req.user!.userId));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await tasks.deleteTask(String(req.params.id), req.user!.userId);
  res.json({ message: 'Task deleted' });
}));

export default router;

// ─── /my-tasks ────────────────────────────────────────────────────────────────
export const myTasksRouter = Router();
myTasksRouter.use(authenticate);

myTasksRouter.get('/', validate(myTasksFiltersDto, 'query'), authHandler(async (req, res) => {
  res.json(await tasks.listMyTasks(req.user!.userId, req.query as never));
}));
