import { Router } from 'express';
import type { Request } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { rateLimit, RATE_LIMITS } from '../../shared/middleware/rate-limit.js';
import { registerDto, loginDto, updateProfileDto, changePasswordDto, forgotPasswordDto, resetPasswordDto } from './auth.dto.js';
import * as authService from './auth.service.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { config } from '../../config.js';
import ssoRouter from './sso/sso.router.js';
import type { AuthRequest } from '../../shared/types/index.js';
import { extractClientMeta } from '../../shared/utils/audit-logger.js';

// Key by email so rotating X-Forwarded-For doesn't bypass the limit.
// Fall back to 'no-email' (single shared bucket) — not req.ip — so that
// malformed requests without a body can't escape the limit by spoofing the IP.
const authEmailKey = (req: Request): string =>
  (req.body?.email as string | undefined)?.trim().toLowerCase() ?? 'no-email';

const authLimit = rateLimit({ ...RATE_LIMITS.auth, keyFn: authEmailKey });

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

router.post('/register', authLimit, validate(registerDto), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimit, validate(loginDto), async (req, res, next) => {
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

router.patch('/profile', authenticate, validate(changePasswordDto), async (req: AuthRequest, res, next) => {
  try {
    const clientMeta = extractClientMeta(req);
    const result = await authService.changePassword(
      req.user!.userId,
      req.body.currentPassword,
      req.body.newPassword,
      clientMeta,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authLimit, validate(forgotPasswordDto), async (req, res, next) => {
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
