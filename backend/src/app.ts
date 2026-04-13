import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from './shared/middleware/error-handler.js';
import authRouter from './modules/auth/auth.router.js';
import workspacesRouter from './modules/workspaces/workspaces.router.js';
import workflowsRouter, {
  workspaceWorkflowsRouter,
  workflowStatusesRouter,
  workflowTransitionsRouter,
} from './modules/workflows/workflows.router.js';
import boardsRouter, { workspaceBoardsRouter } from './modules/boards/boards.router.js';
import tasksRouter, { boardTasksRouter, myTasksRouter } from './modules/tasks/tasks.router.js';
import labelsRouter, { workspaceLabelsRouter, taskLabelsRouter } from './modules/labels/labels.router.js';
import commentsRouter, { taskCommentsRouter } from './modules/comments/comments.router.js';
import checklistsRouter, { taskChecklistsRouter, checklistItemsRouter } from './modules/checklists/checklists.router.js';
import adminRouter from './modules/admin/admin.router.js';
import feedbackRouter from './modules/feedback/feedback.router.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5174';
  app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.GIT_SHA || 'dev',
    });
  });

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces/:wid/workflows', workspaceWorkflowsRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/workflow-statuses', workflowStatusesRouter);
  app.use('/api/workflow-transitions', workflowTransitionsRouter);
  app.use('/api/workspaces/:wid/boards', workspaceBoardsRouter);
  app.use('/api/boards', boardsRouter);
  app.use('/api/boards/:bid/tasks', boardTasksRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/my-tasks', myTasksRouter);
  app.use('/api/workspaces/:wid/labels', workspaceLabelsRouter);
  app.use('/api/labels', labelsRouter);
  app.use('/api/tasks/:tid/labels', taskLabelsRouter);
  app.use('/api/tasks/:tid/comments', taskCommentsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/tasks/:tid/checklists', taskChecklistsRouter);
  app.use('/api/checklists', checklistsRouter);
  app.use('/api/checklist-items', checklistItemsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/feedback', feedbackRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
