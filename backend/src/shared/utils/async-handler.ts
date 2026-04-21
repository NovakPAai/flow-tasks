import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuthRequest } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

type AsyncFn<R extends Request = Request> = (req: R, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route handler so thrown errors are forwarded to next() instead of crashing. */
export function asyncHandler<R extends Request = Request>(fn: AsyncFn<R>): RequestHandler {
  return (req, res, next) => {
    (fn as AsyncFn)(req, res, next).catch(next);
  };
}

/** Typed variant for authenticated routes (req.user is available). */
export function authHandler(fn: AsyncFn<AuthRequest>): RequestHandler {
  return asyncHandler<AuthRequest>(async (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    return fn(req as AuthRequest, res, next);
  });
}
