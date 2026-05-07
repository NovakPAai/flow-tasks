import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { registerDto, loginDto, updateProfileDto, forgotPasswordDto, resetPasswordDto } from './auth.dto.js';
import * as authService from './auth.service.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { config } from '../../config.js';
import ssoRouter from './sso/sso.router.js';
import type { AuthRequest } from '../../shared/types/index.js';
import { extractClientMeta } from '../../shared/utils/audit-logger.js';

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const router = Router();

router.get('/registration-domain', (_req, res) => {
  res.json({ domain: config.REGISTRATION_DOMAIN });
});

router.post('/register', validate(registerDto), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginDto), async (req, res, next) => {
  try {
    const clientMeta = extractClientMeta(req);
    const { user, accessToken, refreshToken } = await authService.login(req.body, clientMeta);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ user, accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) throw new AppError(401, 'Токен обновления не найден');
    const { accessToken, refreshToken } = await authService.refresh(token);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    const clientMeta = extractClientMeta(req);
    if (token) await authService.logout(token, clientMeta);
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, validate(updateProfileDto), async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', validate(forgotPasswordDto), async (req, res, next) => {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validate(resetPasswordDto), async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.use('/sso', ssoRouter);

export default router;
