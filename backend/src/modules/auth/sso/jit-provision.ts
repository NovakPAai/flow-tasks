import { prisma } from '../../../prisma/client.js';
import { config } from '../../../config.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/middleware/error-handler.js';
import type { MappedClaims } from './claims-mapper.js';
import { buildSsoSubjectId } from './claims-mapper.js';

export interface ProvisionedUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  ssoOnly: boolean;
}

const SELECT = { id: true, email: true, name: true, isSuperadmin: true, ssoOnly: true } as const;

export async function jitProvision(claims: MappedClaims): Promise<ProvisionedUser> {
  const ssoSubjectId = buildSsoSubjectId(claims.sub);
  const provider = config.OIDC_PROVIDER ?? 'oidc';

  // 1. Fastest path: returning SSO user
  const existing = await prisma.user.findUnique({ where: { ssoSubjectId }, select: SELECT });
  if (existing) return existing;

  // 2. Email fallback: link existing local account to this SSO identity.
  //    Guard: only link when the IdP has verified the email address, otherwise an
  //    attacker could register with someone else's email on an IdP without verification
  //    and take over an existing FlowTask account.
  const byEmail = await prisma.user.findUnique({ where: { email: claims.email }, select: SELECT });
  if (byEmail) {
    if (!claims.emailVerified) {
      throw new AppError(403, 'Email не подтверждён провайдером идентификации. Обратитесь к администратору.');
    }
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { ssoSubjectId, authProvider: provider },
    });
    logger.info('SSO: linked existing account', { userId: byEmail.id, provider });
    return byEmail;
  }

  // 3. Create new user — SSO-provisioned, no local password hash.
  //    Handle concurrent JIT provisions for the same user (double callback, parallel tabs)
  //    by catching the unique constraint violation and falling back to a lookup.
  try {
    const created = await prisma.user.create({
      data: {
        email: claims.email,
        name: claims.name,
        password: '',
        ssoSubjectId,
        authProvider: provider,
        ssoOnly: config.SSO_ONLY,
      },
      select: SELECT,
    });
    logger.info('SSO: provisioned new user', { userId: created.id, provider });
    return created;
  } catch (err: unknown) {
    const isPrismaUniqueViolation =
      err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002';
    if (!isPrismaUniqueViolation) throw err;

    // Lost the race — the other request already created the user
    const raceWinner = await prisma.user.findUnique({ where: { ssoSubjectId }, select: SELECT });
    if (!raceWinner) throw new AppError(500, 'SSO provisioning conflict — please retry');
    return raceWinner;
  }
}
