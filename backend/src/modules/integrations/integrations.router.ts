import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { authHandler } from '../../shared/utils/async-handler.js';
import * as svc from './integrations.service.js';

const router = Router();
router.use(authenticate);

const createKeyDto = z.object({ label: z.string().min(1).max(100) });

// ─── API Keys management ──────────────────────────────────────────────────────

router.get('/api-keys', authHandler(async (req, res) => {
  res.json(await svc.listApiKeys(req.user!.userId));
}));

router.post('/api-keys', validate(createKeyDto), authHandler(async (req, res) => {
  res.status(201).json(await svc.createApiKey(req.user!.userId, req.body.label));
}));

router.delete('/api-keys/:id', authHandler(async (req, res) => {
  await svc.deleteApiKey(req.user!.userId, String(req.params.id));
  res.status(204).end();
}));

// ─── Integration discovery (used by Pulsar) ───────────────────────────────────

router.get('/workspaces', authHandler(async (req, res) => {
  res.json(await svc.getWorkspacesForIntegration(req.user!.userId));
}));

router.post('/tasks/:taskId/pulsar-label', authHandler(async (req, res) => {
  const { workspaceId } = req.body as { workspaceId?: string };
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
  await svc.attachPulsarLabel(String(req.params.taskId), workspaceId, req.user!.userId);
  res.status(204).end();
}));

router.get('/workspaces/:wid/boards', authHandler(async (req, res) => {
  res.json(await svc.getBoardsForIntegration(String(req.params.wid), req.user!.userId));
}));

export default router;
