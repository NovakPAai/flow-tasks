import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireSuperadmin } from '../../shared/middleware/require-superadmin.js';
import { validate } from '../../shared/middleware/validate.js';
import { createUserDto, reviewRequestDto, updateUserDto } from './admin.dto.js';
import * as adminService from './admin.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();

router.use(authenticate, requireSuperadmin);

router.get('/users', async (_req, res, next) => {
  try {
    const users = await adminService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post('/users', validate(createUserDto), async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.createUser(req.user!.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', validate(updateUserDto), async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.setUserSuperadmin(
      req.user!.userId,
      req.params.id as string,
      req.body.isSuperadmin,
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.get('/registration-requests', async (_req, res, next) => {
  try {
    const requests = await adminService.listRegistrationRequests();
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

router.patch('/registration-requests/:id', validate(reviewRequestDto), async (req: AuthRequest, res, next) => {
  try {
    await adminService.reviewRegistrationRequest(req.params.id as string, req.body, req.user!.userId);
    res.json({ message: 'Заявка обработана' });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isNaN(rawLimit) ? 100 : Math.min(rawLimit, 500);
    const logs = await adminService.listAuditLogs(limit);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
