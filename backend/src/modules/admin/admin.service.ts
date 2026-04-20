import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { config } from '../../config.js';
import type { CreateUserDto, ReviewRequestDto } from './admin.dto.js';

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      loginCount: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createUser(dto: CreateUserDto) {
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

  console.info(`[ADMIN] User created: ${user.email} — deliver generated password via secure channel`);
  return { user };
}

export async function listRegistrationRequests() {
  return prisma.registrationRequest.findMany({
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
  } else {
    await prisma.registrationRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedBy: reviewerUserId, reviewedAt: new Date() },
    });
  }
}
