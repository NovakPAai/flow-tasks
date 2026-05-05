import { Router } from 'express';
import { initiateSsoLogin, handleSsoCallback } from './sso.service.js';
import { config } from '../../../config.js';
import { AppError } from '../../../shared/middleware/error-handler.js';
import { rateLimit } from '../../../shared/middleware/rate-limit.js';
import { logger } from '../../../shared/utils/logger.js';

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const ssoRateLimit = rateLimit({ scope: 'sso', limit: 20, windowMs: 60_000 });

const router = Router();

// GET /api/auth/sso/status — frontend polls this to decide whether to show SSO button
router.get('/status', (_req, res) => {
  res.json({
    enabled: config.SSO_ENABLED,
    provider: config.SSO_ENABLED ? config.OIDC_PROVIDER : null,
    ssoOnly: config.SSO_ONLY,
  });
});

// GET /api/auth/sso/login?returnUrl=/dashboard
router.get('/login', ssoRateLimit, async (req, res, next) => {
  try {
    if (!config.SSO_ENABLED) throw new AppError(404, 'SSO is not enabled');

    const raw = typeof req.query.returnUrl === 'string' ? req.query.returnUrl : '/';
    // Restrict to same-origin paths: must start with / but NOT // (protocol-relative open redirect)
    const safePath = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

    const authUrl = await initiateSsoLogin(safePath);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/sso/callback — OIDC provider redirects here after authentication
router.get('/callback', ssoRateLimit, async (req, res, next) => {
  try {
    if (!config.SSO_ENABLED) throw new AppError(404, 'SSO is not enabled');

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state) throw new AppError(400, 'Missing state parameter');

    // Build URLSearchParams from query so sso.service can reconstruct the validated callback URL
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') params.set(k, v);
    }

    const { refreshToken } = await handleSsoCallback(state, params);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    // Redirect to the SPA — no token in the URL.
    // The frontend detects sso_return=1, calls /auth/refresh to get the access token.
    res.redirect('/?sso_return=1');
  } catch (err) {
    logger.warn('SSO callback error', { error: String(err) });
    res.redirect('/?error=sso_failed');
  }
});

export default router;
