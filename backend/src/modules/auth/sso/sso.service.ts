import crypto from 'crypto';
import {
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
} from 'openid-client';
import { getOidcClient } from './sso.config.js';
import { mapClaims } from './claims-mapper.js';
import { jitProvision } from './jit-provision.js';
import { setCachedJson, getAndDeleteCachedJson, setUserSession } from '../../../shared/redis.js';
import { config } from '../../../config.js';
import { AppError } from '../../../shared/middleware/error-handler.js';
import { logger } from '../../../shared/utils/logger.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../prisma/client.js';
import { auditLog } from '../../../shared/utils/audit-logger.js';

const STATE_TTL_SECONDS = 300;
const MAX_SESSIONS = 5;

interface StatePayload {
  verifier: string;
  returnUrl: string;
}

function stateKey(state: string) {
  return `sso:state:${state}`;
}

export async function initiateSsoLogin(returnUrl: string): Promise<string> {
  const client = await getOidcClient();
  const verifier = randomPKCECodeVerifier();
  const challenge = await calculatePKCECodeChallenge(verifier);
  const state = crypto.randomBytes(16).toString('hex');

  const payload: StatePayload = { verifier, returnUrl };
  await setCachedJson(stateKey(state), payload, STATE_TTL_SECONDS);

  const authUrl = buildAuthorizationUrl(client, {
    redirect_uri: config.OIDC_REDIRECT_URI!,
    scope: config.OIDC_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return authUrl.href;
}

export interface SsoSession {
  // Raw refresh token — caller sets it as HttpOnly cookie.
  // Access token is NOT returned here; the frontend calls /auth/refresh to obtain it.
  refreshToken: string;
}

export async function handleSsoCallback(
  receivedState: string,
  callbackParams: URLSearchParams,
): Promise<SsoSession> {
  // Atomic get-and-delete — prevents state replay even under concurrent requests
  const statePayload = await getAndDeleteCachedJson<StatePayload>(stateKey(receivedState));
  if (!statePayload) throw new AppError(400, 'SSO state expired or invalid');

  const client = await getOidcClient();

  // Reconstruct callback URL from the registered redirect URI + received query params
  // so we never trust Host headers from the incoming request.
  const callbackUrl = new URL(config.OIDC_REDIRECT_URI!);
  callbackParams.forEach((v, k) => callbackUrl.searchParams.set(k, v));

  let tokens;
  try {
    tokens = await authorizationCodeGrant(client, callbackUrl, {
      pkceCodeVerifier: statePayload.verifier,
      expectedState: receivedState,
    });
  } catch (err) {
    logger.warn('SSO callback token exchange failed', { error: String(err) });
    void auditLog({
      actorId: null,
      action: 'auth.login.sso',
      result: 'FAIL',
      meta: { reason: String(err) },
    });
    throw new AppError(401, 'SSO authentication failed');
  }

  const rawClaims = tokens.claims();
  if (!rawClaims) throw new AppError(401, 'No claims in OIDC token response');

  const claims = mapClaims(rawClaims as Record<string, unknown>);
  const user = await jitProvision(claims);

  // Enforce per-user session cap — same LRU logic as local login
  await prisma.$transaction(async (tx) => {
    const all = await tx.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (all.length >= MAX_SESSIONS) {
      const toDelete = all.slice(0, all.length - MAX_SESSIONS + 1).map((t) => t.id);
      await tx.refreshToken.deleteMany({ where: { id: { in: toDelete } } });
    }
  });

  const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshTokenHash, expiresAt },
  });

  const nowIso = new Date().toISOString();
  await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: { loginCount: { increment: 1 }, lastLoginAt: new Date() },
    }),
    setUserSession(user.id, { email: user.email, createdAt: nowIso, lastSeenAt: nowIso, amr: claims.amr }),
  ]);

  void auditLog({
    actorId: user.id,
    action: 'auth.login.sso',
    result: 'SUCCESS',
    meta: { provider: 'oidc', ssoSubject: claims.sub, email: user.email },
  });

  return { refreshToken: refreshTokenRaw };
}
