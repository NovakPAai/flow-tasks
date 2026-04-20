import type { Response, NextFunction } from 'express';
import { prisma } from '../../prisma/client.js';
import { AppError } from './error-handler.js';
import { config } from '../../config.js';
import type { AuthRequest } from '../types/index.js';

export async function requireSuperadmin(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user?.userId) return next(new AppError(403, 'Доступ запрещён'));
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isSuperadmin: true, email: true },
    });
    const allowed = user?.isSuperadmin || user?.email === config.SUPERADMIN_EMAIL;
    if (!allowed) return next(new AppError(403, 'Доступ запрещён'));
    next();
  } catch (err) {
    next(err);
  }
}
