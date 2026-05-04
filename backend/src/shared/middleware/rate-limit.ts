import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt < now) store.delete(key);
    }
  }, 60_000).unref?.();
}

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  // Optional: custom key extractor. Defaults to req.ip for unauthenticated routes.
  // Use keyFn to key by userId on authenticated routes to prevent IP-rotation bypass.
  keyFn?: (req: Request) => string;
}

// TRUST_PROXY: req.ip is resolved correctly when app.set('trust proxy', 1) is configured.
function defaultKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'anonymous';
}

export function rateLimit(opts: RateLimitOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `${opts.scope}:${opts.keyFn ? opts.keyFn(req) : defaultKey(req)}`;
    const now = Date.now();
    const existing = store.get(key);

    if (!existing || existing.resetAt < now) {
      if (store.size >= 100_000) {
        let evicted = 0;
        for (const [k] of store) {
          store.delete(k);
          if (++evicted >= 10_000) break;
        }
      }
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > opts.limit) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return next(new AppError(429, 'Too many requests', { retryAfter, scope: opts.scope }));
    }
    next();
  };
}

export const RATE_LIMITS = {
  auth:     { scope: 'auth',     limit: 10, windowMs: 60_000 },
  invite:   { scope: 'invite',   limit: 20, windowMs: 60_000 },
  apiKey:   { scope: 'api-key',  limit: 20, windowMs: 60_000 },
  feedback: { scope: 'feedback', limit: 5,  windowMs: 60 * 60_000 }, // 5 per hour
} as const satisfies Record<string, RateLimitOptions>;
