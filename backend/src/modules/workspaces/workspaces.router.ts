import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { workspaceMfaGuard } from '../../shared/middleware/workspace-mfa-guard.js';
import {
  createWorkspaceDto,
  updateWorkspaceDto,
  addMemberDto,
  updateMemberRoleDto,
  inviteByEmailDto,
} from './workspaces.dto.js';
import * as ws from './workspaces.service.js';
import * as boards from '../boards/boards.service.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';

const router = Router();
router.use(authenticate);

router.get('/', authHandler(async (req, res) => {
  res.json(await ws.listMyWorkspaces(req.user!.userId));
}));

// ─── Trash ────────────────────────────────────────────────────────────────────

router.get('/trash/list', authHandler(async (req, res) => {
  res.json(await ws.listTrash(req.user!.userId));
}));

router.get('/trash/count', authHandler(async (req, res) => {
  res.json({ count: await ws.countTrash(req.user!.userId) });
}));

router.post('/:id/restore', authHandler(async (req, res) => {
  await ws.restoreWorkspace(String(req.params.id), req.user!.userId);
  res.json({ message: 'Workspace restored' });
}));

router.delete('/:id/purge', authHandler(async (req, res) => {
  await ws.purgeWorkspace(String(req.params.id), req.user!.userId);
  res.json({ message: 'Workspace permanently deleted' });
}));

router.post('/', validate(createWorkspaceDto), authHandler(async (req, res) => {
  res.status(201).json(await ws.createWorkspace(req.user!.userId, req.body));
}));

router.get('/:id', authHandler(async (req, res) => {
  res.json(await ws.getWorkspace(String(req.params.id), req.user!.userId));
}));

router.patch('/:id', validate(updateWorkspaceDto), authHandler(async (req, res) => {
  res.json(await ws.updateWorkspace(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id', authHandler(async (req, res) => {
  await ws.deleteWorkspace(String(req.params.id), req.user!.userId);
  res.json({ message: 'Workspace deleted' });
}));

router.get('/:id/members/search', authHandler(async (req, res) => {
  const q = (req.query.q as string) ?? '';
  const users = await ws.searchMembers(String(req.params.id), q);
  res.json(users);
}));

router.get('/:id/members', authHandler(async (req, res) => {
  res.json(await ws.listMembers(String(req.params.id), req.user!.userId));
}));

router.post('/:id/members', validate(addMemberDto), authHandler(async (req, res) => {
  res.status(201).json(await ws.addMember(String(req.params.id), req.user!.userId, req.body));
}));

router.patch('/:id/members/:userId', validate(updateMemberRoleDto), authHandler(async (req, res) => {
  res.json(await ws.updateMemberRole(String(req.params.id), req.user!.userId, String(req.params.userId), req.body));
}));

router.post('/:id/invite', validate(inviteByEmailDto), authHandler(async (req, res) => {
  res.status(201).json(await ws.inviteByEmail(String(req.params.id), req.user!.userId, req.body));
}));

router.delete('/:id/members/:userId', authHandler(async (req, res) => {
  await ws.removeMember(String(req.params.id), req.user!.userId, String(req.params.userId));
  res.json({ message: 'Member removed' });
}));

router.get('/:id/boards/by-prefix/:prefix', asyncHandler(workspaceMfaGuard()), authHandler(async (req, res) => {
  res.json(await boards.getBoardByPrefix(String(req.params.id), String(req.params.prefix), req.user!.userId));
}));

router.get('/:id/history', asyncHandler(workspaceMfaGuard()), authHandler(async (req, res) => {
  const rawLimit  = parseInt(String(req.query.limit  ?? '50'), 10);
  const rawOffset = parseInt(String(req.query.offset ?? '0'),  10);
  const limit  = Math.min(Number.isNaN(rawLimit)  ? 50 : rawLimit,  200);
  const offset = Math.max(Number.isNaN(rawOffset) ? 0  : rawOffset, 0);
  res.json(await ws.getWorkspaceHistory(String(req.params.id), req.user!.userId, limit, offset));
}));

export default router;
