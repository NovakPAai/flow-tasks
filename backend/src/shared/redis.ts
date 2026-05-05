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
    logger.error('Redis read error', { key, error: String(err) });
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds = config.REDIS_CACHE_TTL_SECONDS): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.error('Redis write error', { key, error: String(err) });
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
    logger.error('Redis getdel error', { key, error: String(err) });
    return null;
  }
}

export type UserSession = {
  userId: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
};

function buildSessionKey(userId: string): string {
  return `session:${userId}`;
}

export async function setUserSession(userId: string, session: Omit<UserSession, 'userId'>): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.set(buildSessionKey(userId), JSON.stringify({ userId, ...session }), { EX: SESSION_TTL_SECONDS });
  } catch (err) {
    logger.error('Redis session write error', { userId, error: String(err) });
  }
}

export async function deleteUserSession(userId: string): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;
  try {
    await redis.del(buildSessionKey(userId));
  } catch (err) {
    logger.error('Redis session delete error', { userId, error: String(err) });
  }
}
