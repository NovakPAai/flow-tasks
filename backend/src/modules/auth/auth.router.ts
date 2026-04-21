import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';
import { registerDto, loginDto, refreshDto, updateProfileDto, forgotPasswordDto, resetPasswordDto } from './auth.dto.js';
import * as authService from './auth.service.js';
import { config } from '../../config.js';
import { asyncHandler, authHandler } from '../../shared/utils/async-handler.js';

const router = Router();

router.get('/registration-domain', (_req, res) => {
  res.json({ domain: config.REGISTRATION_DOMAIN });
});

router.post('/register', rateLimit(RATE_LIMITS.auth), validate(registerDto), asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.json(result);
}));

router.post('/login', rateLimit(RATE_LIMITS.auth), validate(loginDto), asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
}));

router.post('/refresh', rateLimit(RATE_LIMITS.auth), validate(refreshDto), asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.json(result);
}));

router.post('/logout', rateLimit(RATE_LIMITS.auth), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  res.json({ message: 'Logged out' });
}));

router.get('/me', authenticate, authHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.userId);
  res.json(user);
}));

router.patch('/me', authenticate, validate(updateProfileDto), authHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user!.userId, req.body);
  res.json(user);
}));

router.post('/forgot-password', rateLimit(RATE_LIMITS.auth), validate(forgotPasswordDto), asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  res.json(result);
}));

router.post('/reset-password', rateLimit(RATE_LIMITS.auth), validate(resetPasswordDto), asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  res.json(result);
}));

export default router;
