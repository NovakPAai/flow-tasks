import type { Response, NextFunction } from 'express';
import { config } from '../../config.js';
import { AppError } from './error-handler.js';
import type { AuthRequest } from '../types/index.js';

export function requireSuperadmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.email !== config.SUPERADMIN_EMAIL) {
    return next(new AppError(403, 'Доступ запрещён'));
  }
  next();
}
