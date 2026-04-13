import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { setUserSession, deleteUserSession, getCachedJson, setCachedJson } from '../../shared/redis.js';
import { config } from '../../config.js';
import type { RegisterDto, LoginDto, UpdateProfileDto } from './auth.dto.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
let bruteForceWarningLogged = false;

async function checkBruteForce(email: string): Promise<void> {
  const key = `auth:fail:${email.toLowerCase()}`;
  const attempts = await getCachedJson<number>(key);
  if (attempts === null && !bruteForceWarningLogged) {
    bruteForceWarningLogged = true;
    console.warn('Brute force protection disabled: Redis not available.');
  }
  if (attempts !== null && attempts >= MAX_LOGIN_ATTEMPTS) {
    throw new AppError(429, 'Слишком много попыток. Попробуйте через 15 минут.');
  }
}

async function recordFailedAttempt(email: string): Promise<void> {
  const key = `auth:fail:${email.toLowerCase()}`;
  const current = (await getCachedJson<number>(key)) ?? 0;
  await setCachedJson(key, current + 1, LOCKOUT_SECONDS);
}

async function clearFailedAttempts(email: string): Promise<void> {
  const key = `auth:fail:${email.toLowerCase()}`;
  await setCachedJson(key, 0, 1);
}

function generateRefreshExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function register(dto: RegisterDto) {
  const localPart = dto.email.trim().toLowerCase().split('@')[0];
  const email = `${localPart}@${config.REGISTRATION_DOMAIN}`;

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.registrationRequest.findUnique({ where: { email } }),
  ]);

  if (existingUser) {
    throw new AppError(409, 'Email уже зарегистрирован');
  }
  if (existingRequest && existingRequest.status === 'PENDING') {
    throw new AppError(409, 'Заявка с этим email уже ожидает рассмотрения');
  }

  const passwordHash = await hashPassword(dto.password);

  if (existingRequest) {
    // Повторная заявка после отклонения — обновляем
    await prisma.registrationRequest.update({
      where: { email },
      data: { password: passwordHash, name: dto.name, status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
  } else {
    await prisma.registrationRequest.create({
      data: { email, password: passwordHash, name: dto.name },
    });
  }

  return { message: 'Заявка на регистрацию отправлена. Ожидайте подтверждения администратора.' };
}

export async function login(dto: LoginDto) {
  const normalizedEmail = dto.email.trim().toLowerCase();
  await checkBruteForce(normalizedEmail);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    await recordFailedAttempt(normalizedEmail);
    throw new AppError(401, 'Неверный email или пароль');
  }

  const valid = await comparePassword(dto.password, user.password);
  if (!valid) {
    await recordFailedAttempt(normalizedEmail);
    throw new AppError(401, 'Неверный email или пароль');
  }

  await clearFailedAttempts(normalizedEmail);

  const tokenPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({
    data: {
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      userId: user.id,
      expiresAt: generateRefreshExpiry(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { loginCount: { increment: 1 }, lastLoginAt: new Date() },
  });

  const nowIso = new Date().toISOString();
  void setUserSession(user.id, { email: user.email, createdAt: nowIso, lastSeenAt: nowIso });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Недействительный токен');
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Сессия истекла, войдите снова');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError(401, 'Пользователь не найден');
  }

  const deleteResult = await prisma.refreshToken.deleteMany({
    where: { id: stored.id, token: tokenHash },
  });
  if (deleteResult.count === 0) {
    throw new AppError(401, 'Сессия истекла, войдите снова');
  }

  const newPayload = { userId: user.id, email: user.email };
  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  await prisma.refreshToken.create({
    data: {
      token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
      userId: user.id,
      expiresAt: generateRefreshExpiry(),
    },
  });

  const nowIso = new Date().toISOString();
  void setUserSession(user.id, {
    email: user.email,
    createdAt: stored.createdAt.toISOString?.() ?? nowIso,
    lastSeenAt: nowIso,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });
  await prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
  if (stored?.userId) {
    void deleteUserSession(stored.userId);
  }
}

export async function updateProfile(userId: string, dto: UpdateProfileDto) {
  if (dto.email) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'Email уже используется другим пользователем');
    }
    dto = { ...dto, email: normalizedEmail };
  }

  const data: Record<string, string> = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.email !== undefined) data.email = dto.email;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, avatar: true, loginCount: true, createdAt: true },
  });
  return user;
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatar: true, loginCount: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'Пользователь не найден');
  const firstName = user.name.split(' ')[0] ?? user.name;
  return { ...user, firstName, isSuperadmin: user.email === config.SUPERADMIN_EMAIL };
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'Если аккаунт с таким email существует, вы получите ссылку для сброса пароля.' };
  }

  // Delete existing tokens for user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = `${config.CORS_ORIGIN}/reset-password?token=${token}`;
  console.info(`[PASSWORD RESET] Reset link for ${normalizedEmail}: ${resetUrl}`);

  return { message: 'Если аккаунт с таким email существует, вы получите ссылку для сброса пароля.' };
}

export async function resetPassword(token: string, password: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
    throw new AppError(400, 'Ссылка для сброса пароля недействительна или истекла');
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { password: passwordHash } }),
    prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  return { message: 'Пароль успешно изменён. Войдите с новым паролем.' };
}
