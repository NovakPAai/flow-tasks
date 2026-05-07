import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './error-handler.js';
import type { AuthRequest } from '../types/index.js';
import { prisma } from '../../prisma/client.js';

const lastUsedCache = new Map<string, number>();

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication required'));
  }

  const token = header.slice(7);

  // API key auth: tokens prefixed with "ft_" + 64 hex chars
  if (token.startsWith('ft_') && token.length >= 67) {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, email: true } } },
    }).then((apiKey) => {
      if (!apiKey || !apiKey.isActive) return next(new AppError(401, 'Invalid API key'));
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return next(new AppError(401, 'Invalid API key'));
      if (!apiKey.user) return next(new AppError(401, 'Invalid API key'));
      req.user = { userId: apiKey.user.id, email: apiKey.user.email };
      // Debounce lastUsedAt: update at most once per minute per key
      const now = Date.now();
      const lastUpdate = lastUsedCache.get(apiKey.id) ?? 0;
      if (now - lastUpdate > 60_000) {
        lastUsedCache.set(apiKey.id, now);
        prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      }
      next();
    }).catch(next);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    prisma.user.findUnique({ where: { id: payload.userId }, select: { isActive: true } })
      .then((u) => {
        if (!u || u.isActive === false) {
          return next(new AppError(403, 'Account disabled', { code: 'ACCOUNT_DISABLED' }));
        }
        req.user = { userId: payload.userId, email: payload.email };
        next();
      })
      .catch(next);
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}
