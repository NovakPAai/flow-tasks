import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';
import { redisRateLimit } from '../redis.js';

// ─── In-memory fallback (single-instance only) ────────────────────────────────

interface Bucket { count: number; resetAt: number }
const fallbackStore = new Map<string, Bucket>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of fallbackStore) {
      if (bucket.resetAt < now) fallbackStore.delete(key);
    }
  }, 60_000).unref?.();
}

function fallbackCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = fallbackStore.get(key);
  if (!existing || existing.resetAt < now) {
    if (fallbackStore.size >= 100_000) {
      let evicted = 0;
      for (const [k] of fallbackStore) {
        fallbackStore.delete(k);
        if (++evicted >= 10_000) break;
      }
    }
    fallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  keyFn?: (req: Request) => string;
}

function defaultKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'anonymous';
}

// E2E tests fire many parallel logins (workers × spec files × beforeEach) which
// reliably hits the per-email limit. Unit tests exercise rate-limit itself so
// they need it enabled. Production always enforces it.
const RATE_LIMIT_DISABLED = process.env.NODE_ENV === 'e2e';

export function rateLimit(opts: RateLimitOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (RATE_LIMIT_DISABLED) return next();

    const identity = opts.keyFn ? opts.keyFn(req) : defaultKey(req);
    const key = `rl:${opts.scope}:${identity}`;

    try {
      const result = await redisRateLimit(key, opts.limit, opts.windowMs);
      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
        return next(new AppError(429, 'Too many requests', { retryAfter, scope: opts.scope }));
      }
      return next();
    } catch {
      // Redis unavailable — degrade gracefully to in-memory
      const allowed = fallbackCheck(key, opts.limit, opts.windowMs);
      if (!allowed) {
        return next(new AppError(429, 'Too many requests', { scope: opts.scope }));
      }
      return next();
    }
  };
}

export const RATE_LIMITS = {
  auth:     { scope: 'auth',     limit: 10, windowMs: 60_000 },
  invite:   { scope: 'invite',   limit: 20, windowMs: 60_000 },
  apiKey:   { scope: 'api-key',  limit: 20, windowMs: 60_000 },
  feedback: { scope: 'feedback', limit: 5,  windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitOptions>;
