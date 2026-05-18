import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { prisma } from '../../prisma/client.js';
import { getUserSession } from '../redis.js';
import { AppError } from './error-handler.js';
import { logger } from '../utils/logger.js';

const MFA_AMR_VALUES = ['totp', 'otp', 'mfa', 'hwk', 'swk'];

async function enforceMfa(workspaceId: string, req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { requireMfa: true, deletedAt: true },
  });

  // Soft-deleted workspaces: skip MFA gate; downstream handler will 404.
  if (!workspace || workspace.deletedAt !== null || !workspace.requireMfa) return next();

  const userId = req.user!.userId;

  // Local users have no IdP amr — MFA guard is SSO-only
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authProvider: true },
  });
  if (!user || user.authProvider === 'local') return next();

  const session = await getUserSession(userId);

  // Fail-closed: if Redis is unavailable for an SSO user in an MFA workspace, deny access.
  // This prevents a Redis outage from silently downgrading security.
  if (session === null) {
    logger.warn('mfa_guard_session_unavailable', { userId, workspaceId });
    throw new AppError(503, 'SESSION_UNAVAILABLE');
  }

  const amr: string[] = session.amr ?? [];
  const mfaOk = amr.some((v) => MFA_AMR_VALUES.includes(v));

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (mfaOk) {
    // Clear stale grace period so the frontend banner dismisses after first TOTP login.
    if (member?.mfaGraceUntil) {
      void prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { mfaGraceUntil: null },
      }).catch((err) => logger.warn('mfa_guard_grace_clear_failed', { userId, workspaceId, error: String(err) }));
    }
    return next();
  }

  const graceUntil = member?.mfaGraceUntil ?? null;
  if (graceUntil && graceUntil > new Date()) {
    const daysLeft = Math.ceil((graceUntil.getTime() - Date.now()) / 86_400_000);
    res.setHeader('X-MFA-Grace-Days', String(daysLeft));
    return next();
  }

  throw new AppError(403, graceUntil ? 'MFA_GRACE_EXPIRED' : 'MFA_REQUIRED');
}

export function workspaceMfaGuard(workspaceParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const workspaceId = String(req.params[workspaceParamName]);
    await enforceMfa(workspaceId, req, res, next);
  };
}

// For routes operating on a board ID — resolves workspaceId from the board.
export function boardMfaGuard(boardParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const boardId = String(req.params[boardParamName]);
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true },
    });
    if (!board) return next(); // board not found — let the route handler return 404
    await enforceMfa(board.workspaceId, req, res, next);
  };
}

// For routes operating on a task ID — resolves workspaceId via task → board.
export function taskMfaGuard(taskParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const taskId = String(req.params[taskParamName]);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { board: { select: { workspaceId: true } } },
    });
    if (!task) return next(); // not found — let the route handler return 404
    await enforceMfa(task.board.workspaceId, req, res, next);
  };
}

// For routes operating on a checklist ID — resolves workspaceId via checklist → task → board.
export function checklistMfaGuard(checklistParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const checklistId = String(req.params[checklistParamName]);
    const checklist = await prisma.checklist.findUnique({
      where: { id: checklistId },
      select: { task: { select: { board: { select: { workspaceId: true } } } } },
    });
    if (!checklist) return next();
    await enforceMfa(checklist.task.board.workspaceId, req, res, next);
  };
}

// For routes operating on a checklist item ID — resolves workspaceId via item → checklist → task → board.
export function checklistItemMfaGuard(itemParamName = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = String(req.params[itemParamName]);
    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklist: { select: { task: { select: { board: { select: { workspaceId: true } } } } } } },
    });
    if (!item) return next();
    await enforceMfa(item.checklist.task.board.workspaceId, req, res, next);
  };
}
