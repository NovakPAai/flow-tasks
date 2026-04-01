import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  createWorkspaceDto,
  updateWorkspaceDto,
  addMemberDto,
  updateMemberRoleDto,
} from './workspaces.dto.js';
import * as ws from './workspaces.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json(await ws.listMyWorkspaces(req.user!.userId));
  } catch (e) { next(e); }
});

router.post('/', validate(createWorkspaceDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await ws.createWorkspace(req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await ws.getWorkspace(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.patch('/:id', validate(updateWorkspaceDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await ws.updateWorkspace(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await ws.deleteWorkspace(String(req.params.id), req.user!.userId);
    res.json({ message: 'Workspace deleted' });
  } catch (e) { next(e); }
});

router.get('/:id/members', async (req: AuthRequest, res, next) => {
  try {
    res.json(await ws.listMembers(String(req.params.id), req.user!.userId));
  } catch (e) { next(e); }
});

router.post('/:id/members', validate(addMemberDto), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await ws.addMember(String(req.params.id), req.user!.userId, req.body));
  } catch (e) { next(e); }
});

router.patch('/:id/members/:userId', validate(updateMemberRoleDto), async (req: AuthRequest, res, next) => {
  try {
    res.json(await ws.updateMemberRole(String(req.params.id), req.user!.userId, String(req.params.userId), req.body));
  } catch (e) { next(e); }
});

router.delete('/:id/members/:userId', async (req: AuthRequest, res, next) => {
  try {
    await ws.removeMember(String(req.params.id), req.user!.userId, String(req.params.userId));
    res.json({ message: 'Member removed' });
  } catch (e) { next(e); }
});

export default router;
