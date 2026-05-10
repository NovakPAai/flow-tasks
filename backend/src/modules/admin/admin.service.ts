import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config.js';
import { auditLog } from '../../shared/utils/audit-logger.js';
import type { CreateUserDto, ReviewRequestDto, UpdateConfigDto } from './admin.dto.js';

export async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      loginCount: true,
      lastLoginAt: true,
      createdAt: true,
      isSuperadmin: true,
      _count: {
        select: {
          createdWorkspaces: true,
          createdTasks: true,
        },
      },
      createdWorkspaces: {
        select: {
          _count: { select: { boards: true, members: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const superadminEmail = config.SUPERADMIN_EMAIL;

  return users.map(({ createdWorkspaces, _count, ...u }) => ({
    ...u,
    isSuperadmin: u.isSuperadmin || u.email === superadminEmail,
    isSuperadminLocked: u.email === superadminEmail,
    stats: {
      workspaces: _count.createdWorkspaces,
      boards: createdWorkspaces.reduce((s, ws) => s + ws._count.boards, 0),
      tasks: _count.createdTasks,
      members: createdWorkspaces.reduce((s, ws) => s + ws._count.members, 0),
    },
  }));
}

export async function setUserSuperadmin(actorId: string, userId: string, isSuperadmin: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Пользователь не найден');

  if (!isSuperadmin && user.email === config.SUPERADMIN_EMAIL) {
    throw new AppError(403, 'Нельзя снять роль суперадминистратора с резервного аккаунта');
  }
  if (!isSuperadmin && actorId === userId) {
    throw new AppError(403, 'Нельзя снять роль суперадминистратора с самого себя');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isSuperadmin },
    select: { id: true, email: true, name: true, isSuperadmin: true },
  });
  void auditLog({ actorId, action: 'admin.user.set_superadmin', targetId: userId, result: 'SUCCESS', meta: { isSuperadmin } });
  return updated;
}

export async function createUser(actorId: string, dto: CreateUserDto) {
  const email = `${dto.emailPrefix.toLowerCase()}@${config.REGISTRATION_DOMAIN}`;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Пользователь с таким email уже существует');
  }

  const generatedPassword = crypto.randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(generatedPassword);

  const user = await prisma.user.create({
    data: { email, password: passwordHash, name: dto.name },
    select: { id: true, email: true, name: true, avatar: true, loginCount: true, createdAt: true },
  });

  void auditLog({ actorId, action: 'admin.user.create', targetId: user.id, result: 'SUCCESS', meta: { email: user.email } });
  logger.info('admin_user_created', { userId: user.id, email: user.email });
  return { user, generatedPassword };
}

export async function listRegistrationRequests() {
  return prisma.registrationRequest.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function reviewRegistrationRequest(
  requestId: string,
  dto: ReviewRequestDto,
  reviewerUserId: string,
) {
  const request = await prisma.registrationRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new AppError(404, 'Заявка не найдена');
  }
  if (request.status !== 'PENDING') {
    throw new AppError(409, 'Заявка уже обработана');
  }

  if (dto.action === 'approve') {
    const existing = await prisma.user.findUnique({ where: { email: request.email } });
    if (existing) {
      throw new AppError(409, 'Пользователь с таким email уже существует');
    }

    await prisma.$transaction([
      prisma.user.create({
        data: { email: request.email, password: request.password, name: request.name },
      }),
      prisma.registrationRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedBy: reviewerUserId, reviewedAt: new Date() },
      }),
    ]);
    void auditLog({ actorId: reviewerUserId, action: 'request.approve', targetId: requestId, result: 'SUCCESS', meta: { email: request.email } });
  } else {
    await prisma.registrationRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedBy: reviewerUserId, reviewedAt: new Date() },
    });
    void auditLog({ actorId: reviewerUserId, action: 'request.reject', targetId: requestId, result: 'SUCCESS', meta: { email: request.email } });
  }
}

export async function listAuditLogs(limit = 100, offset = 0) {
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count(),
  ]);
  return { logs, total };
}

export async function updateConfig(actorId: string, dto: UpdateConfigDto) {
  const updated: string[] = [];
  for (const [setting, newValue] of Object.entries(dto)) {
    if (newValue === undefined) continue;
    // Map camelCase key → UPPER_SNAKE_CASE for config lookup
    const snakeKey = setting.replace(/([A-Z])/g, '_$1').toUpperCase() as keyof typeof config;
    const oldValue = String((config as Record<string, unknown>)[snakeKey] ?? '');
    void auditLog({
      actorId,
      action: 'admin.config.change',
      result: 'SUCCESS',
      meta: { setting, oldValue, newValue },
    });
    updated.push(setting);
  }
  return { updated };
}

export async function setUserActive(actorId: string, targetId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new AppError(404, 'Пользователь не найден');

  await prisma.user.update({ where: { id: targetId }, data: { isActive } });

  void auditLog({
    actorId,
    action: isActive ? 'admin.user.activate' : 'admin.user.deactivate',
    targetId,
    result: 'SUCCESS',
    meta: { email: user.email, isActive },
  });

  return { id: targetId, isActive };
}
