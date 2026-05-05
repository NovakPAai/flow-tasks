import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config.js';
import type { CreateUserDto, ReviewRequestDto } from './admin.dto.js';

function auditLog(
  actorId: string,
  action: string,
  targetId?: string,
  meta?: Prisma.InputJsonValue,
): void {
  prisma.auditLog
    .create({ data: { id: crypto.randomUUID(), actorId, action, targetId, meta } })
    .catch((err: unknown) => logger.error('audit_log_failed', { action, error: String(err) }));
}

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

  return users.map(({ createdWorkspaces, _count, ...u }) => ({
    ...u,
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
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isSuperadmin },
    select: { id: true, email: true, name: true, isSuperadmin: true },
  });
  auditLog(actorId, 'user.set_superadmin', userId, { isSuperadmin });
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

  auditLog(actorId, 'user.create', user.id, { email: user.email });
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
    auditLog(reviewerUserId, 'request.approve', requestId, { email: request.email });
  } else {
    await prisma.registrationRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedBy: reviewerUserId, reviewedAt: new Date() },
    });
    auditLog(reviewerUserId, 'request.reject', requestId, { email: request.email });
  }
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
