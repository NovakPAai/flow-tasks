/**
 * BDD: ИБ — Аутентификация (ИАА / iia)
 * Feature: specs/security/ib-authentication.feature
 *
 * GAP-статус: большинство тестов — PENDING (требуется реализация AuditLog для auth-событий)
 * Реализовано: brute-force блокировка, JWT, SSO-flow
 * Не реализовано: запись auth-событий в AuditLog, clientSignature, sessionId в логах
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, registerUser, cleanupTestData, auth } from '../helpers.js';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';

const email = () => `${uid()}@test.com`;

async function getLastAuditLog(action: string) {
  return prisma.auditLog.findFirst({
    where: { action },
    orderBy: { createdAt: 'desc' },
  });
}

describe('ИАА: Аутентификация — ИБ-требования', () => {
  afterAll(cleanupTestData);

  // ─── Уникальность учётных записей ─────────────────────────────────────────

  describe('Уникальность учётных записей (Req basic §1.2)', () => {
    it('дублирующийся email возвращает 409', async () => {
      const e = email();
      await api.post('/api/auth/register').send({ email: e, name: 'A', password: 'Password1' });
      const res = await api.post('/api/auth/register').send({ email: e, name: 'B', password: 'Password1' });
      expect(res.status).toBe(409);
    });
  });

  // ─── Успешный / неуспешный вход → AuditLog ────────────────────────────────

  describe('Событие auth.login записывается в AuditLog (ГОСТ 57580 РД-40)', () => {
    let testEmail: string;
    let testPassword: string;

    beforeAll(async () => {
      const user = await registerUser();
      testEmail = user.email;
      testPassword = user.password;
    });

    it.todo('успешный login создаёт AuditLog с action=auth.login и result=SUCCESS', async () => {
      await api.post('/api/auth/login').send({ email: testEmail, password: testPassword });
      const log = await getLastAuditLog('auth.login');
      expect(log).not.toBeNull();
      expect((log!.meta as Record<string, unknown>)?.result).toBe('SUCCESS');
    });

    it.todo('неуспешный login создаёт AuditLog с action=auth.login и result=FAIL', async () => {
      await api.post('/api/auth/login').send({ email: testEmail, password: 'WrongPass1' });
      const log = await getLastAuditLog('auth.login');
      expect(log).not.toBeNull();
      expect((log!.meta as Record<string, unknown>)?.result).toBe('FAIL');
    });

    it.todo('событие login содержит ip и userAgent из заголовков запроса', async () => {
      await api
        .post('/api/auth/login')
        .set('User-Agent', 'TestBrowser/1.0')
        .set('X-Real-IP', '10.0.0.1')
        .send({ email: testEmail, password: testPassword });
      const log = await getLastAuditLog('auth.login');
      const meta = log!.meta as Record<string, unknown>;
      expect(meta.ip).toBe('10.0.0.1');
      expect(meta.userAgent).toContain('TestBrowser');
    });

    it.todo('событие login содержит sessionId', async () => {
      await api.post('/api/auth/login').send({ email: testEmail, password: testPassword });
      const log = await getLastAuditLog('auth.login');
      const meta = log!.meta as Record<string, unknown>;
      expect(typeof meta.sessionId).toBe('string');
      expect((meta.sessionId as string).length).toBeGreaterThan(0);
    });
  });

  // ─── Блокировка по brute-force ────────────────────────────────────────────

  describe('Блокировка аккаунта (Req логирование §2.1)', () => {
    it.skip('после 5 неудачных попыток возвращает 429', async () => {
      // Redis brute-force counter disabled in NODE_ENV=test (getRedisClientInternal returns null)
      const e = email();
      await registerUser({ email: e });
      for (let i = 0; i < 5; i++) {
        await api.post('/api/auth/login').send({ email: e, password: 'WrongPass1' });
      }
      const res = await api.post('/api/auth/login').send({ email: e, password: 'WrongPass1' });
      expect(res.status).toBe(429);
    });

    it.todo('блокировка создаёт AuditLog с action=auth.lockout', async () => {
      const e = email();
      await registerUser({ email: e });
      for (let i = 0; i < 5; i++) {
        await api.post('/api/auth/login').send({ email: e, password: 'WrongPass1' });
      }
      const log = await getLastAuditLog('auth.lockout');
      expect(log).not.toBeNull();
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  describe('Выход из системы (ГОСТ 57580 РД-41)', () => {
    it('POST /api/auth/logout возвращает 200', async () => {
      const user = await registerUser();
      const res = await api.post('/api/auth/logout').set(auth(user.token));
      expect(res.status).toBe(200);
    });

    it.todo('logout создаёт AuditLog с action=auth.logout и reason=user_initiated', async () => {
      const user = await registerUser();
      await api.post('/api/auth/logout').set(auth(user.token));
      const log = await getLastAuditLog('auth.logout');
      expect(log).not.toBeNull();
      const meta = log!.meta as Record<string, unknown>;
      expect(meta.reason).toBe('user_initiated');
    });
  });

  // ─── Смена пароля (ГОСТ 57580 РД-43) ─────────────────────────────────────

  describe('Изменение аутентификационных данных (ГОСТ 57580 РД-43)', () => {
    it.todo('смена пароля создаёт AuditLog с action=auth.credential.change', async () => {
      const user = await registerUser();
      await api
        .patch('/api/auth/profile')
        .set(auth(user.token))
        .send({ currentPassword: user.password, newPassword: 'NewPassword1' });
      const log = await getLastAuditLog('auth.credential.change');
      expect(log).not.toBeNull();
    });
  });

  // ─── SIEM-тег ─────────────────────────────────────────────────────────────

  describe('SIEM-тегирование событий (Req логирование §4)', () => {
    it.todo('событие auth.login содержит SIEM-тег в формате [system,type,segment,env,dc]', async () => {
      const user = await registerUser();
      await api.post('/api/auth/login').send({ email: user.email, password: user.password });
      const log = await getLastAuditLog('auth.login');
      const meta = log!.meta as Record<string, unknown>;
      expect(Array.isArray(meta.tags)).toBe(true);
      const tags = meta.tags as string[];
      expect(tags[0]).toBe('flowtasks');
      expect(tags[1]).toBe('auth');
      expect(tags[2]).toBe('iia');
    });
  });

  // ─── API Key auth ─────────────────────────────────────────────────────────

  describe('API Key аутентификация (Req §1.3.4)', () => {
    it.todo('использование валидного API-ключа создаёт AuditLog с action=auth.apikey.use', async () => {
      // Setup: create API key via /api/auth/api-keys endpoint
      const user = await registerUser();
      const keyRes = await api
        .post('/api/auth/api-keys')
        .set(auth(user.token))
        .send({ label: 'test-key' });
      const rawKey = keyRes.body.key as string;

      await api.get('/api/my-tasks').set('Authorization', `Bearer ${rawKey}`);
      const log = await getLastAuditLog('auth.apikey.use');
      expect(log).not.toBeNull();
    });
  });
});
