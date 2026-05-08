import crypto from 'crypto';
import { createClient, type RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from './utils/logger.js';

type RedisClient = RedisClientType;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

async function getRedisClientInternal(): Promise<RedisClient | null> {
  if (process.env.NODE_ENV === 'test') return null;
  if (!config.REDIS_URL) return null;
  if (client) return client;

  if (!connecting) {
    const instance = createClient({ url: config.REDIS_URL }) as RedisClient;
    instance.on('error', () => { /* suppress repeated noise */ });

    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 2000));
    connecting = Promise.race([
      instance
        .connect()
        .then(() => { client = instance; return instance; })
        .catch(() => { client = null; return null; }),
      timeout,
    ]).then(result => { if (result === null) connecting = null; return result; });
  }

  return connecting;
}

export async function isRedisAvailable(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true; // In tests: assume available, getCachedJson returns null (0 attempts)
  if (!config.REDIS_URL) return false;
  const redis = await getRedisClientInternal();
  return redis !== null;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClientInternal();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error('redis_read_error', { key, error: String(err) });
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds = config.REDIS_CACHE_TTL_SECONDS): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.error('redis_write_error', { key, error: String(err) });
  }
}

// Atomic get-and-delete — used for one-time-use state tokens (SSO PKCE, exchange codes).
// Returns null when key is absent, expired, or Redis is unavailable.
export async function getAndDeleteCachedJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClientInternal();
  if (!redis) return null;
  try {
    const raw = await redis.getDel(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error('redis_getdel_error', { key, error: String(err) });
    return null;
  }
}

export type UserSession = {
  userId: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
  amr?: string[];
};

function buildSessionKey(userId: string): string {
  return `session:${userId}`;
}

export async function getUserSession(userId: string): Promise<UserSession | null> {
  const redis = await getRedisClientInternal();
  if (!redis) return null;
  try {
    const raw = await redis.get(buildSessionKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch (err) {
    logger.error('redis_session_read_error', { userId, error: String(err) });
    return null;
  }
}

export async function setUserSession(userId: string, session: Omit<UserSession, 'userId'>): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.set(buildSessionKey(userId), JSON.stringify({ userId, ...session }), { EX: SESSION_TTL_SECONDS });
  } catch (err) {
    logger.error('redis_session_write_error', { userId, error: String(err) });
  }
}

export async function deleteUserSession(userId: string): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.del(buildSessionKey(userId));
  } catch (err) {
    logger.error('redis_session_delete_error', { userId, error: String(err) });
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

/**
 * Sliding window rate limit via Redis sorted sets.
 * Returns { allowed, remaining, retryAfterMs }.
 * Throws if Redis is unavailable — caller must handle fallback.
 */
export async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = await getRedisClientInternal();
  if (!redis) throw new Error('Redis unavailable');

  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${now}-${crypto.randomBytes(8).toString('hex')}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  // Atomic pipeline: trim expired → add current → count → expire
  const [, , countRaw] = await redis
    .multi()
    .zRemRangeByScore(key, 0, windowStart)
    .zAdd(key, { score: now, value: member })
    .zCard(key)
    .expire(key, ttlSeconds)
    .exec() as [unknown, unknown, number, unknown];

  const count = countRaw as number;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  if (!allowed) {
    // Find the oldest entry to compute retry-after
    const oldest = await redis.zRangeWithScores(key, 0, 0);
    const oldestScore = oldest[0]?.score ?? now;
    const retryAfterMs = oldestScore + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  return { allowed: true, remaining, retryAfterMs: 0 };
}
