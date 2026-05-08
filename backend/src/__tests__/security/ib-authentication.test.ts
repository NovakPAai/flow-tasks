/**
 * BDD: ИБ — Аутентификация (ИАА / iia)
 * Feature: specs/security/ib-authentication.feature
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, registerUser, cleanupTestData, auth } from '../helpers.js';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';

const email = () => `${uid()}@test.com`;

async function getLastAuditLog(action: string, since?: Date) {
  return prisma.auditLog.findFirst({
    where: { action, ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

describe('ИАА: Аутентификация — ИБ-требования', () => {
  afterAll(cleanupTestData);

  // ─── Уникальность учётных записей ─────────────────────────────────────────

  describe('Уникальность учётных записей (Req basic §1.2)', () => {
    it('дублирующийся email возвращает 200 с тем же сообщением (gap-15: no enumeration)', async () => {
      const e = email();
      const first = await api.post('/api/auth/register').send({ email: e, name: 'A', password: 'Password1' });
      const second = await api.post('/api/auth/register').send({ email: e, name: 'B', password: 'Password1' });
      expect(second.status).toBe(200);
      expect(second.body.message).toBe(first.body.message);
    });
  });

  // ─── Email enumeration (gap-15) ───────────────────────────────────────────

  describe('Отсутствие email enumeration через /register (gap-15)', () => {
    it('три запроса с разным статусом email возвращают одинаковый message', async () => {
      const existingUser = await registerUser();

      const pendingEmail = email();
      const pendingRes = await api
        .post('/api/auth/register')
        .send({ email: pendingEmail, name: 'Pending', password: 'Password1' });
      expect(pendingRes.status).toBe(200);

      const newEmail = email();
      const newRes = await api
        .post('/api/auth/register')
        .send({ email: newEmail, name: 'New', password: 'Password1' });

      const existingRes = await api
        .post('/api/auth/register')
        .send({ email: existingUser.email, name: 'Dup', password: 'Password1' });

      const pendingDupRes = await api
        .post('/api/auth/register')
        .send({ email: pendingEmail, name: 'Dup', password: 'Password1' });

      expect(newRes.status).toBe(200);
      expect(existingRes.status).toBe(200);
      expect(pendingDupRes.status).toBe(200);
      expect(existingRes.body.message).toBe(newRes.body.message);
      expect(pendingDupRes.body.message).toBe(newRes.body.message);
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

    it('успешный login создаёт AuditLog с action=auth.login и result=SUCCESS', async () => {
      const before = new Date();
      await api.post('/api/auth/login').send({ email: testEmail, password: testPassword });
      await new Promise((r) => setTimeout(r, 80));
      const log = await getLastAuditLog('auth.login', before);
      expect(log).not.toBeNull();
      expect((log!.meta as Record<string, unknown>)?.result).toBe('SUCCESS');
    });

    it('неуспешный login создаёт AuditLog с action=auth.login и result=FAIL', async () => {
      const before = new Date();
      await api.post('/api/auth/login').send({ email: testEmail, password: 'WrongPass1' });
      await new Promise((r) => setTimeout(r, 80));
      const log = await getLastAuditLog('auth.login', before);
      expect(log).not.toBeNull();
      expect((log!.meta as Record<string, unknown>)?.result).toBe('FAIL');
    });

    it('событие login содержит ip и userAgent из заголовков запроса', async () => {
      const before = new Date();
      await api
        .post('/api/auth/login')
        .set('User-Agent', 'TestBrowser/1.0')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: testEmail, password: testPassword });
      await new Promise((r) => setTimeout(r, 80));
      const log = await getLastAuditLog('auth.login', before);
      const meta = log!.meta as Record<string, unknown>;
      expect(meta.ip).toBe('10.0.0.1');
      expect(meta.userAgent).toContain('TestBrowser');
    });

    it('событие login содержит sessionId', async () => {
      const before = new Date();
      await api.post('/api/auth/login').send({ email: testEmail, password: testPassword });
      await new Promise((r) => setTimeout(r, 80));
      const log = await getLastAuditLog('auth.login', before);
      const meta = log!.meta as Record<string, unknown>;
      expect(typeof meta.sessionId).toBe('string');
      expect((meta.sessionId as string).length).toBeGreaterThan(0);
    });
  });

  // ─── Rate-limit по email (gap-14) ────────────────────────────────────────

  describe('Rate-limit на /login ключируется по email, а не по IP (gap-14)', () => {
    it('10 запросов с разными X-Forwarded-For на один email → 11-й блокируется (429)', async () => {
      const victim = await registerUser();

      for (let i = 1; i <= 10; i++) {
        await api
          .post('/api/auth/login')
          .set('X-Forwarded-For', `10.99.${i}.1`)
          .send({ email: victim.email, password: 'WrongPass!' });
      }

      const blocked = await api
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.99.99.1')
        .send({ email: victim.email, password: 'WrongPass!' });

      expect(blocked.status).toBe(429);
    });

    it('/register: 10 запросов с разными X-Forwarded-For на один email → 11-й блокируется (429)', async () => {
      const targetEmail = email();

      for (let i = 1; i <= 10; i++) {
        await api
          .post('/api/auth/register')
          .set('X-Forwarded-For', `10.88.${i}.1`)
          .send({ email: targetEmail, name: 'Flood', password: 'Password1' });
      }

      const blocked = await api
        .post('/api/auth/register')
        .set('X-Forwarded-For', '10.88.99.1')
        .send({ email: targetEmail, name: 'Flood', password: 'Password1' });

      expect(blocked.status).toBe(429);
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

    it.skip('блокировка создаёт AuditLog с action=auth.lockout', async () => {
      // auth.lockout is emitted only when Redis brute-force counter triggers (disabled in test env)
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
      const res = await api.post('/api/auth/logout').set('Cookie', user.cookie);
      expect(res.status).toBe(200);
    });

    it('logout создаёт AuditLog с action=auth.logout и reason=user_initiated', async () => {
      const user = await registerUser();
      await api.post('/api/auth/logout').set('Cookie', user.cookie);
      const log = await getLastAuditLog('auth.logout');
      expect(log).not.toBeNull();
      const meta = log!.meta as Record<string, unknown>;
      expect(meta.reason).toBe('user_initiated');
    });
  });

  // ─── Смена пароля (ГОСТ 57580 РД-43) ─────────────────────────────────────

  describe('Изменение аутентификационных данных (ГОСТ 57580 РД-43)', () => {
    it('смена пароля создаёт AuditLog с action=auth.credential.change', async () => {
      const user = await registerUser();
      const res = await api
        .patch('/api/auth/profile')
        .set(auth(user.token))
        .send({ currentPassword: user.password, newPassword: 'NewPassword1' });
      expect(res.status).toBe(200);
      const log = await getLastAuditLog('auth.credential.change');
      expect(log).not.toBeNull();
    });
  });

  // ─── SIEM-тег ─────────────────────────────────────────────────────────────

  describe('SIEM-тегирование событий (Req логирование §4)', () => {
    it('событие auth.login содержит SIEM-тег в формате [system,type,segment,env,dc]', async () => {
      const user = await registerUser();
      const before = new Date();
      await api.post('/api/auth/login').send({ email: user.email, password: user.password });
      await new Promise((r) => setTimeout(r, 80));
      const log = await getLastAuditLog('auth.login', before);
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
    it('использование валидного API-ключа создаёт AuditLog с action=auth.apikey.use', async () => {
      const user = await registerUser();
      const keyRes = await api
        .post('/api/integrations/api-keys')
        .set(auth(user.token))
        .send({ label: 'test-key' });
      expect(keyRes.status).toBe(201);
      const rawKey = keyRes.body.key as string;

      await api.get('/api/my-tasks').set('Authorization', `Bearer ${rawKey}`);
      const log = await getLastAuditLog('auth.apikey.use');
      expect(log).not.toBeNull();
    });
  });
});
