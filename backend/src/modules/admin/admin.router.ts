import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireSuperadmin } from '../../shared/middleware/require-superadmin.js';
import { validate } from '../../shared/middleware/validate.js';
import { createUserDto, reviewRequestDto } from './admin.dto.js';
import * as adminService from './admin.service.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';

const router = Router();

router.use(authenticate, requireSuperadmin);

router.get('/users', asyncHandler(async (_req, res) => {
  const users = await adminService.listUsers();
  res.json(users);
}));

router.post('/users', validate(createUserDto), asyncHandler(async (req, res) => {
  const result = await adminService.createUser(req.body);
  res.status(201).json(result);
}));

router.get('/registration-requests', asyncHandler(async (_req, res) => {
  const requests = await adminService.listRegistrationRequests();
  res.json(requests);
}));

router.patch('/registration-requests/:id', validate(reviewRequestDto), authHandler(async (req, res) => {
  await adminService.reviewRegistrationRequest(req.params.id as string, req.body, req.user!.userId);
  res.json({ message: 'Заявка обработана' });
}));

export default router;
