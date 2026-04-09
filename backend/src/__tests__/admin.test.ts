import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, auth, registerUser, cleanupTestData } from './helpers.js';
import { prisma } from '../prisma/client.js';
import { hashPassword } from '../shared/utils/password.js';
import { config } from '../config.js';

// Creates a superadmin user (email = SUPERADMIN_EMAIL) and logs in
async function registerSuperadmin() {
  const password = 'Password1';
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email: config.SUPERADMIN_EMAIL },
    update: { password: passwordHash },
    create: { email: config.SUPERADMIN_EMAIL, name: 'Test Superadmin', password: passwordHash },
  });
  const loginRes = await api.post('/api/auth/login').send({ email: config.SUPERADMIN_EMAIL, password });
  return loginRes.body.accessToken as string;
}

describe('Admin', () => {
  let superToken: string;
  let regularToken: string;

  beforeAll(async () => {
    [superToken, { token: regularToken }] = await Promise.all([
      registerSuperadmin(),
      registerUser(),
    ]);
  });

  afterAll(async () => {
    await prisma.registrationRequest.deleteMany({ where: { email: { contains: '@test.com' } } });
    await cleanupTestData();
    // Clean up superadmin if it was created just for tests
    await prisma.user.deleteMany({ where: { email: config.SUPERADMIN_EMAIL } });
  });

  // ─── Access Control ──────────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('GET /api/admin/users returns 401 without token', async () => {
      const res = await api.get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/users returns 403 for regular user', async () => {
      const res = await api.get('/api/admin/users').set(auth(regularToken));
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/registration-requests returns 403 for regular user', async () => {
      const res = await api.get('/api/admin/registration-requests').set(auth(regularToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/users ─────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns list of all users for superadmin', async () => {
      const res = await api.get('/api/admin/users').set(auth(superToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('response does not include password field', async () => {
      const res = await api.get('/api/admin/users').set(auth(superToken));
      expect(res.status).toBe(200);
      expect(res.body[0].password).toBeUndefined();
    });
  });

  // ─── GET /api/admin/registration-requests ────────────────────────────────

  describe('GET /api/admin/registration-requests', () => {
    it('returns registration request list for superadmin', async () => {
      // Create a registration request directly via Prisma (bypasses domain transformation)
      const reqEmail = `${uid()}@test.com`;
      const passwordHash = await hashPassword('Password1');
      await prisma.registrationRequest.create({
        data: { email: reqEmail, name: 'Pending User', password: passwordHash },
      });

      const res = await api.get('/api/admin/registration-requests').set(auth(superToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: { email: string }) => r.email === reqEmail)).toBe(true);
    });
  });

  // ─── PATCH /api/admin/registration-requests/:id ───────────────────────────

  describe('PATCH /api/admin/registration-requests/:id (approve)', () => {
    it('approves a pending request and creates a user', async () => {
      const reqEmail = `${uid()}@test.com`;
      const passwordHash = await hashPassword('Password1');
      await prisma.registrationRequest.create({
        data: { email: reqEmail, name: 'Future User', password: passwordHash },
      });

      const listRes = await api.get('/api/admin/registration-requests').set(auth(superToken));
      const pending = listRes.body.find((r: { email: string; status: string }) => r.email === reqEmail && r.status === 'PENDING');
      expect(pending).toBeDefined();

      const approveRes = await api
        .patch(`/api/admin/registration-requests/${pending.id}`)
        .set(auth(superToken))
        .send({ action: 'approve' });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.message).toBeDefined();

      // The approved email should now exist as a user
      const user = await prisma.user.findUnique({ where: { email: pending.email } });
      expect(user).not.toBeNull();
    });
  });

  describe('PATCH /api/admin/registration-requests/:id (reject)', () => {
    it('rejects a pending request and sets status to REJECTED', async () => {
      const reqEmail = `${uid()}@test.com`;
      const passwordHash = await hashPassword('Password1');
      await prisma.registrationRequest.create({
        data: { email: reqEmail, name: 'Rejected User', password: passwordHash },
      });

      const listRes = await api.get('/api/admin/registration-requests').set(auth(superToken));
      const pending = listRes.body.find((r: { email: string; status: string }) => r.email === reqEmail && r.status === 'PENDING');
      expect(pending).toBeDefined();

      const rejectRes = await api
        .patch(`/api/admin/registration-requests/${pending.id}`)
        .set(auth(superToken))
        .send({ action: 'reject' });
      expect(rejectRes.status).toBe(200);

      const updated = await prisma.registrationRequest.findUnique({ where: { id: pending.id } });
      expect(updated?.status).toBe('REJECTED');
    });
  });

  // ─── POST /api/admin/users ─────────────────────────────────────────────────

  describe('POST /api/admin/users', () => {
    it('creates a user and returns generated password', async () => {
      const emailPrefix = `testadmin${uid()}`;
      const res = await api
        .post('/api/admin/users')
        .set(auth(superToken))
        .send({ name: 'Admin Created User', emailPrefix });
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.generatedPassword).toBeDefined();
      expect(res.body.user.email).toBe(`${emailPrefix}@${config.REGISTRATION_DOMAIN}`);
    });

    it('returns 403 for regular user', async () => {
      const res = await api
        .post('/api/admin/users')
        .set(auth(regularToken))
        .send({ name: 'X', emailPrefix: 'x' });
      expect(res.status).toBe(403);
    });
  });
});
