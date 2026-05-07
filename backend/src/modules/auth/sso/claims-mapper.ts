import { z } from 'zod';
import { config } from '../../../config.js';

export interface MappedClaims {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
  amr: string[];
}

const emailSchema = z.string().email();

// Both Keycloak and Avanpost use standard OIDC claims.
// Keycloak may put display name in "name"; Avanpost may use given_name + family_name.
export function mapClaims(raw: Record<string, unknown>): MappedClaims {
  const sub = String(raw['sub'] ?? '').trim();
  const rawEmail = String(raw['email'] ?? '').trim();
  const emailVerified = raw['email_verified'] !== false; // treat absent as true (IdP-verified accounts)

  if (!sub) throw new Error('OIDC claims missing required "sub"');

  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) throw new Error(`OIDC claims: invalid email "${rawEmail}"`);
  const email = emailResult.data;

  let name = String(raw['name'] ?? '').trim();
  if (!name) {
    const given = String(raw['given_name'] ?? '').trim();
    const family = String(raw['family_name'] ?? '').trim();
    name = [given, family].filter(Boolean).join(' ');
  }
  if (!name) name = email.split('@')[0];

  const amr = Array.isArray(raw['amr']) ? (raw['amr'] as string[]) : [];

  return { sub, email, name, emailVerified, amr };
}

export function buildSsoSubjectId(sub: string): string {
  const provider = config.OIDC_PROVIDER ?? 'oidc';
  return `${provider}:${sub}`;
}
