import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { setUserSession, getUserSession, deleteUserSession, getCachedJson, setCachedJson, isRedisAvailable } from '../../shared/redis.js';
import { sendPasswordResetEmail } from '../../shared/utils/email.js';
import { config } from '../../config.js';
import type { RegisterDto, LoginDto, UpdateProfileDto } from './auth.dto.js';
import { auditLog, type ClientMeta } from '../../shared/utils/audit-logger.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

// Convention: name field stores "FirstName LastName". Takes first word.
function extractFirstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

async function checkBruteForce(email: string): Promise<void> {
  if (!await isRedisAvailable()) return; // brute-force protection degraded gracefully
  const key = `auth:fail:${email.toLowerCase()}`;
  const attempts = (await getCachedJson<number>(key)) ?? 0;
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    throw new AppError(429, 'Слишком много попыток. Попробуйте через 15 минут.');
  }
}

async function recordFailedAttempt(email: string): Promise<void> {
  if (!await isRedisAvailable()) return;
  const key = `auth:fail:${email.toLowerCase()}`;
  const current = (await getCachedJson<number>(key)) ?? 0;
  await setCachedJson(key, current + 1, LOCKOUT_SECONDS);
}

async function clearFailedAttempts(email: string): Promise<void> {
  if (!await isRedisAvailable()) return;
  const key = `auth:fail:${email.toLowerCase()}`;
  await setCachedJson(key, 0, 1);
}

function generateRefreshExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// Single response for all register outcomes — prevents email enumeration (gap-15).
const REGISTER_MSG = 'Если email доступен, заявка отправлена. Ожидайте подтверждения администратора.';

export async function register(dto: RegisterDto) {
  const localPart = dto.email.trim().toLowerCase().split('@')[0];
  const email = `${localPart}@${config.REGISTRATION_DOMAIN}`;

  // hashPassword runs unconditionally to equalise response time (timing side-channel).
  const [existingUser, existingRequest, passwordHash] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.registrationRequest.findUnique({ where: { email } }),
    hashPassword(dto.password),
  ]);

  // Silent exit: don't reveal whether email is taken or pending.
  if (existingUser || existingRequest?.status === 'PENDING') {
    return { message: REGISTER_MSG };
  }

  if (existingRequest) {
    // Re-submission after rejection — reset to PENDING.
    await prisma.registrationRequest.update({
      where: { email },
      data: { password: passwordHash, name: dto.name, status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
  } else {
    await prisma.registrationRequest.create({
      data: { email, password: passwordHash, name: dto.name },
    });
  }

  return { message: REGISTER_MSG };
}

export async function login(dto: LoginDto, clientMeta?: ClientMeta) {
  const normalizedEmail = dto.email.trim().toLowerCase();

  // Inline brute-force check — log lockout before throwing so audit is emitted
  if (await isRedisAvailable()) {
    const key = `auth:fail:${normalizedEmail}`;
    const attempts = (await getCachedJson<number>(key)) ?? 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      void auditLog({
        actorId: null,
        action: 'auth.lockout',
        result: 'FAIL',
        ip: clientMeta?.ip,
        userAgent: clientMeta?.userAgent,
        meta: { email: normalizedEmail },
      });
      throw new AppError(429, 'Слишком много попыток. Попробуйте через 15 минут.');
    }
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    await recordFailedAttempt(normalizedEmail);
    void auditLog({
      actorId: null,
      action: 'auth.login',
      result: 'FAIL',
      ip: clientMeta?.ip,
      userAgent: clientMeta?.userAgent,
      meta: { email: normalizedEmail, reason: 'USER_NOT_FOUND' },
    });
    throw new AppError(401, 'Неверный email или пароль');
  }

  // Block local login for SSO-only users (except superadmins who always retain local access)
  if (user.ssoOnly && !user.isSuperadmin) {
    throw new AppError(403, 'Вход по паролю недоступен. Используйте SSO.');
  }

  const valid = await comparePassword(dto.password, user.password);
  if (!valid) {
    await recordFailedAttempt(normalizedEmail);
    void auditLog({
      actorId: user.id,
      action: 'auth.login',
      result: 'FAIL',
      ip: clientMeta?.ip,
      userAgent: clientMeta?.userAgent,
      meta: { email: normalizedEmail, reason: 'WRONG_PASSWORD' },
    });
    throw new AppError(401, 'Неверный email или пароль');
  }

  await clearFailedAttempts(normalizedEmail);

  const tokenPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: {
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      userId: user.id,
      expiresAt: generateRefreshExpiry(),
    },
  });

  // LRU session eviction (atomic): keep at most MAX_SESSIONS per user, drop oldest.
  // Done inside a transaction to prevent race conditions with concurrent logins.
  await prisma.$transaction(async (tx) => {
    const all = await tx.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (all.length > config.MAX_SESSIONS) {
      const toDelete = all.slice(0, all.length - config.MAX_SESSIONS).map((t) => t.id);
      await tx.refreshToken.deleteMany({ where: { id: { in: toDelete } } });
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { loginCount: { increment: 1 }, lastLoginAt: new Date() },
  });

  const nowIso = new Date().toISOString();
  void setUserSession(user.id, { email: user.email, createdAt: nowIso, lastSeenAt: nowIso });

  void auditLog({
    actorId: user.id,
    action: 'auth.login',
    result: 'SUCCESS',
    ip: clientMeta?.ip,
    userAgent: clientMeta?.userAgent,
    meta: { email: user.email, provider: 'local', region: clientMeta?.region },
  });

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
  const prevSession = await getUserSession(user.id);
  void setUserSession(user.id, {
    email: user.email,
    createdAt: stored.createdAt.toISOString?.() ?? nowIso,
    lastSeenAt: nowIso,
    amr: prevSession?.amr,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string, clientMeta?: ClientMeta) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });
  await prisma.refreshToken.deleteMany({ where: { token: tokenHash } });
  if (stored?.userId) {
    void deleteUserSession(stored.userId);
    void auditLog({
      actorId: stored.userId,
      action: 'auth.logout',
      result: 'SUCCESS',
      ip: clientMeta?.ip,
      userAgent: clientMeta?.userAgent,
      meta: { reason: 'user_initiated' },
    });
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

  const data: Record<string, unknown> = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.email !== undefined) data.email = dto.email;
  if (dto.emailNotifications !== undefined) data.emailNotifications = dto.emailNotifications;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, avatar: true, loginCount: true, createdAt: true, emailNotifications: true },
  });
  const firstName = extractFirstName(user.name);
  return { ...user, firstName };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatar: true, loginCount: true, createdAt: true, isSuperadmin: true, emailNotifications: true },
  });
  if (!user) throw new AppError(404, 'Пользователь не найден');
  const firstName = extractFirstName(user.name);
  // SUPERADMIN_EMAIL always has superadmin access even if DB flag not set
  const isSuperadmin = user.isSuperadmin || user.email === config.SUPERADMIN_EMAIL;
  return { ...user, isSuperadmin, firstName };
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
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store only the hash — raw token is sent via email and never persisted
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  void sendPasswordResetEmail(normalizedEmail, token).catch(() => {
    // Email failure is non-fatal: token hash is in DB, admin can resend manually
  });

  return { message: 'Если аккаунт с таким email существует, вы получите ссылку для сброса пароля.' };
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
    throw new AppError(400, 'Ссылка для сброса пароля недействительна или истекла');
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { password: passwordHash } }),
    prisma.passwordResetToken.update({ where: { tokenHash }, data: { usedAt: new Date() } }),
    prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  void auditLog({
    actorId: resetToken.userId,
    action: 'auth.credential.change',
    result: 'SUCCESS',
    meta: { field: 'password', method: 'reset' },
  });

  return { message: 'Пароль успешно изменён. Войдите с новым паролем.' };
}
