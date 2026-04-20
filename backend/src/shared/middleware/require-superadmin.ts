import type { Response, NextFunction } from 'express';
import { prisma } from '../../prisma/client.js';
import { AppError } from './error-handler.js';
import type { AuthRequest } from '../types/index.js';

export async function requireSuperadmin(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user?.userId) return next(new AppError(403, 'Доступ запрещён'));
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isSuperadmin: true },
    });
    if (!user?.isSuperadmin) return next(new AppError(403, 'Доступ запрещён'));
    next();
  } catch (err) {
    next(err);
  }
}
