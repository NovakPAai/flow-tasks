import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { auditLog } from '../utils/audit-logger.js';

export function validate(schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        void auditLog({
          actorId: null,
          action: 'system.validation.error',
          result: 'FAIL',
          ip: req.ip ?? undefined,
          meta: {
            path: req.path,
            errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        res.status(400).json({
          error: 'Ошибка валидации',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
