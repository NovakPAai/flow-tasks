/**
 * Permission middleware factories.
 *
 * Spec: plan.md Step 1.5.
 *
 * Three families:
 *   - requirePermission(code)       — workspace-scoped check via isAllowed
 *   - featureGate(featureCode, scope) — short-circuit 404/403 before routing
 *   - requireBoardAccess()          — attach req.boardAccess, 403 BOARD_ACCESS_DENIED
 *   - requireBoardAction(perm)      — canAccessBoard + isAllowed(withRole)
 *
 * Phase 1: only used on new endpoints (admin permissions, workspace features,
 * board members). Phase 2 will swap existing assertOwner / role-string checks
 * inside services.
 */

import type { Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';
import type { AuthRequest } from '../types/index.js';
import {
  isAllowed,
  canAccessBoard,
  canActOnBoard,
  deriveFeatureCode,
  type PermissionCode,
  type BoardAccessResult,
} from '../utils/permissions.js';
import { getPermissionContext } from '../utils/permissions-cache.js';
import { prisma } from '../../prisma/client.js';

declare module 'express-serve-static-core' {
  interface Request {
    boardAccess?: BoardAccessResult;
  }
}

export interface RequirePermissionOptions {
  /** Name of the route param that holds the workspaceId. Default: 'workspaceId'. */
  workspaceParam?: string;
}

/**
 * Reject the request if the user lacks `permission` in the workspace
 * referenced by `req.params[opts.workspaceParam]`.
 */
export function requirePermission(
  permission: PermissionCode,
  opts: RequirePermissionOptions = {},
) {
  const param = opts.workspaceParam ?? 'workspaceId';

  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) return next(new AppError(401, 'Не авторизован'));

      const workspaceId = (req.params[param] as string | undefined) ?? null;
      const ok = await isAllowed(req.user.userId, workspaceId, permission);
      if (ok) return next();

      // Diagnose why: feature-disabled vs missing permission
      const ctx = await getPermissionContext(req.user.userId, workspaceId);
      const featureCode = deriveFeatureCode(permission);
      if (featureCode && ctx.systemFeatures[featureCode] === false) {
        return next(
          new AppError(
            403,
            'Функциональность отключена администратором',
            { feature: featureCode },
            'FEATURE_DISABLED',
          ),
        );
      }
      if (featureCode && workspaceId && ctx.workspaceFeatures[featureCode] === false) {
        return next(
          new AppError(
            403,
            'Функциональность отключена в этом пространстве',
            { feature: featureCode },
            'FEATURE_DISABLED',
          ),
        );
      }
      next(
        new AppError(
          403,
          'Недостаточно прав',
          { permission },
          'INSUFFICIENT_PERMISSION',
        ),
      );
    } catch (err) {
      next(err);
    }
  };
}

export type FeatureScope = 'system' | 'workspace';

/**
 * Short-circuits routes when a feature is disabled.
 *
 * - scope='system': returns 404 — endpoint behaves as if it doesn't exist.
 *   Queries the system_features table directly, no per-user context needed.
 *   Safe to mount before `authenticate`.
 * - scope='workspace': returns 403 FEATURE_DISABLED. Reads workspace_features
 *   for the workspaceId resolved from the request param. The check does NOT
 *   verify workspace membership — pair with `requirePermission`/route guards
 *   that already do (H1 fix, security-review.md).
 */
export function featureGate(
  featureCode: string,
  scope: FeatureScope,
  workspaceParam = 'workspaceId',
) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const systemRow = await prisma.systemFeature.findUnique({
        where: { code: featureCode },
        select: { enabled: true },
      });
      // Default-allow if the row is missing (feature not registered yet).
      if (systemRow && systemRow.enabled === false) {
        return next(new AppError(404, 'Не найдено'));
      }

      if (scope === 'workspace') {
        const workspaceId = (req.params[workspaceParam] as string | undefined) ?? null;
        if (!workspaceId) return next(); // route mounted on global path — workspace check N/A
        const wsRow = await prisma.workspaceFeature.findUnique({
          where: { workspaceId_code: { workspaceId, code: featureCode } },
          select: { enabled: true },
        });
        if (wsRow && wsRow.enabled === false) {
          return next(
            new AppError(
              403,
              'Функциональность отключена в этом пространстве',
              { feature: featureCode },
              'FEATURE_DISABLED',
            ),
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Attach req.boardAccess after running canAccessBoard. 403 if denied.
 */
export function requireBoardAccess(boardParam = 'boardId') {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) return next(new AppError(401, 'Не авторизован'));
      const boardId = req.params[boardParam] as string | undefined;
      if (!boardId) return next(new AppError(400, 'Не указан boardId'));

      const access = await canAccessBoard(req.user.userId, boardId);
      if (!access.allowed) {
        return next(new AppError(403, 'Нет доступа к доске', undefined, 'BOARD_ACCESS_DENIED'));
      }
      req.boardAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Combines requireBoardAccess + canActOnBoard. workspaceId is read from the
 * BoardAccessResult to avoid the second DB fetch / TOCTOU window
 * (H2, security-review.md).
 */
export function requireBoardAction(permission: PermissionCode, boardParam = 'boardId') {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) return next(new AppError(401, 'Не авторизован'));
      const boardId = req.params[boardParam] as string | undefined;
      if (!boardId) return next(new AppError(400, 'Не указан boardId'));

      const access = req.boardAccess ?? (await canAccessBoard(req.user.userId, boardId));
      if (!access.allowed || !access.workspaceId) {
        return next(new AppError(403, 'Нет доступа к доске', undefined, 'BOARD_ACCESS_DENIED'));
      }
      req.boardAccess = access;

      const ok = await canActOnBoard(req.user.userId, boardId, permission, access.workspaceId);
      if (!ok) {
        return next(
          new AppError(403, 'Недостаточно прав', { permission }, 'INSUFFICIENT_PERMISSION'),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
