import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { prisma } from '../../prisma/client.js';
import { getUserSession } from '../redis.js';
import { AppError } from './error-handler.js';

const MFA_AMR_VALUES = ['totp', 'otp', 'mfa', 'hwk', 'swk'];

export function workspaceMfaGuard(workspaceParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const workspaceId = String(req.params[workspaceParamName]);
    const userId = req.user!.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { requireMfa: true },
    });

    if (!workspace || !workspace.requireMfa) return next();

    // Local users have no IdP amr — MFA guard is SSO-only
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { authProvider: true },
    });
    if (!user || user.authProvider === 'local') return next();

    const session = await getUserSession(userId);
    const amr: string[] = session?.amr ?? [];
    if (amr.some((v) => MFA_AMR_VALUES.includes(v))) return next();

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    const graceUntil = member?.mfaGraceUntil ?? null;
    if (graceUntil && graceUntil > new Date()) {
      const daysLeft = Math.ceil((graceUntil.getTime() - Date.now()) / 86_400_000);
      res.setHeader('X-MFA-Grace-Days', String(daysLeft));
      return next();
    }

    throw new AppError(403, graceUntil ? 'MFA_GRACE_EXPIRED' : 'MFA_REQUIRED');
  };
}
