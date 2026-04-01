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
import tasksRouter, { boardTasksRouter } from './modules/tasks/tasks.router.js';

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

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
