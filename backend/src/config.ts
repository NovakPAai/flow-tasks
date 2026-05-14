import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// override: true — .env wins over inherited process env (PM2/daemon cache).
// Production incident 2026-05-13: PM2 daemon cached a revoked GITHUB_ISSUES_TOKEN
// in its env, dotenv (default no-override) silently ignored the new value in .env,
// and only a full `pm2 kill` recovered. Override removes that footgun.
loadDotenv({ override: true });

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3101),
  NODE_ENV: z.enum(['development', 'production', 'test', 'e2e']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5174'),
  REDIS_URL: z.string().optional(),
  REDIS_CACHE_TTL_SECONDS: z.coerce.number().min(1).max(3600).default(30),
  SUPERADMIN_EMAIL: z.string().email().default('novak.pavel@flowtask.dev'),
  REGISTRATION_DOMAIN: z.string().default('flowtask.dev'),
  GITHUB_ISSUES_TOKEN: z.string().optional(),
  GITHUB_REPO_OWNER: z.string().default('NovakPAai'),
  GITHUB_REPO_NAME: z.string().default('flow-tasks'),
  // SSO / OIDC
  SSO_ENABLED: z.coerce.boolean().default(false),
  SSO_ONLY: z.coerce.boolean().default(false),
  OIDC_PROVIDER: z.enum(['keycloak', 'avanpost']).optional(),
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPE: z.string().default('openid profile email'),
  // Email (SMTP) — optional; password reset is functional only when configured
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@flowtask.dev'),
  APP_URL: z.string().default('http://localhost:5174'),
  MAX_SESSIONS: z.coerce.number().int().min(1).max(20).default(5),
});

export const config = envSchema.parse(process.env);

if (config.SSO_ENABLED) {
  const ssoRequired = ['OIDC_ISSUER_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI', 'OIDC_PROVIDER'] as const;
  const missing = ssoRequired.filter((k) => !config[k]);
  if (missing.length) {
    console.error(`FATAL: SSO_ENABLED=true but missing required vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

if (config.NODE_ENV === 'production') {
  const weakPatterns = ['change-me', 'changeme', 'replace', 'secret', 'password'];
  const isWeak = (s: string) => s.length < 32 || weakPatterns.some((p) => s.toLowerCase().includes(p));

  if (isWeak(config.JWT_SECRET)) {
    console.error('FATAL: JWT_SECRET must be >= 32 chars and not contain weak patterns in production.');
    process.exit(1);
  }
  if (isWeak(config.JWT_REFRESH_SECRET)) {
    console.error('FATAL: JWT_REFRESH_SECRET must be >= 32 chars and not contain weak patterns in production.');
    process.exit(1);
  }
}
