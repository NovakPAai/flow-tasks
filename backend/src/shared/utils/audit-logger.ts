import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { logger } from './logger.js';
import { tagsForAction } from './siem-tags.js';

export interface AuditEventInput {
  actorId: string | null;
  action: string;
  targetId?: string | null;
  result?: 'SUCCESS' | 'FAIL';
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
}

// Mask PII values so they never land in SIEM in plaintext
const PII_KEY_RE = /^(email|phone|passport|card_?number|inn)$/i;

function maskPiiValue(value: string): string {
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (value.length <= 4) return '***';
  return value.slice(0, 2) + '*'.repeat(Math.max(2, value.length - 4)) + value.slice(-2);
}

function maskPii(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      PII_KEY_RE.test(k) && typeof v === 'string' ? maskPiiValue(v) : v,
    ]),
  );
}

export async function auditLog(event: AuditEventInput): Promise<void> {
  try {
    const tags = tagsForAction(event.action);
    // tags = [system, type, segment, env, dc]
    const techSegment = tags[2] ?? 'iia';
    const meta = maskPii({
      result: event.result ?? 'SUCCESS',
      ip: event.ip,
      userAgent: event.userAgent,
      sessionId: event.sessionId,
      session_id: event.sessionId ?? null,
      subject: event.actorId ?? 'system',
      tech_segment: techSegment,
      source: 'flow-tasks-backend',
      tags,
      time: new Date().toISOString(),
      ...event.meta,
    });

    await prisma.auditLog.create({
      data: {
        actorId: event.actorId ?? 'system',
        action: event.action,
        targetId: event.targetId ?? null,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
        sessionId: event.sessionId ?? null,
        result: event.result ?? 'SUCCESS',
        meta: meta as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Audit failure must never break the main request
    logger.error('audit_log.write.error', { action: event.action, error: String(err) });
  }
}

// Helper: extract client meta from Express request-like object
export interface ClientMeta {
  ip: string;
  userAgent: string;
  region?: string;
}

export function extractClientMeta(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}): ClientMeta {
  const ip =
    (req.headers['x-real-ip'] as string) ??
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.ip ??
    req.socket?.remoteAddress ??
    'unknown';

  const userAgent = (req.headers['user-agent'] as string) ?? 'unknown';
  const region =
    (req.headers['cf-ipcountry'] as string) ??
    (req.headers['x-region'] as string) ??
    undefined;

  return { ip, userAgent, region };
}
