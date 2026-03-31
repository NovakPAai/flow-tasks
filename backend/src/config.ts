import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3101),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5174'),
  REDIS_URL: z.string().optional(),
  REDIS_CACHE_TTL_SECONDS: z.coerce.number().min(1).max(3600).default(30),
});

export const config = envSchema.parse(process.env);

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
