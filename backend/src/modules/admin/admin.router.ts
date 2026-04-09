import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireSuperadmin } from '../../shared/middleware/require-superadmin.js';
import { validate } from '../../shared/middleware/validate.js';
import { createUserDto, reviewRequestDto } from './admin.dto.js';
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

router.post('/users', validate(createUserDto), async (req, res, next) => {
  try {
    const result = await adminService.createUser(req.body);
    res.status(201).json(result);
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

export default router;
