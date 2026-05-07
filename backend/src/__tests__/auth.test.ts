import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, registerUser, cleanupTestData, auth } from './helpers.js';

describe('Auth', () => {
  afterAll(cleanupTestData);

  const email = () => `${uid()}@test.com`;

  describe('POST /api/auth/register', () => {
    it('creates a registration request and returns a message', async () => {
      const res = await api.post('/api/auth/register').send({
        email: email(), name: 'Alice', password: 'Password1',
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('returns 200 with generic message for duplicate email (gap-15: no enumeration)', async () => {
      const e = email();
      const first = await api.post('/api/auth/register').send({ email: e, name: 'A', password: 'Password1' });
      const second = await api.post('/api/auth/register').send({ email: e, name: 'B', password: 'Password1' });
      expect(second.status).toBe(200);
      expect(second.body.message).toBe(first.body.message);
    });

    it('rejects weak password with 400', async () => {
      const res = await api.post('/api/auth/register').send({
        email: email(), name: 'A', password: 'short',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing fields with 400', async () => {
      const res = await api.post('/api/auth/register').send({ email: email() });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail: string;
    let testPassword: string;
    beforeAll(async () => {
      const user = await registerUser();
      testEmail = user.email;
      testPassword = user.password;
    });

    it('returns tokens for valid credentials', async () => {
      const res = await api.post('/api/auth/login').send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const res = await api.post('/api/auth/login').send({ email: testEmail, password: 'WrongPass1' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await api.post('/api/auth/login').send({ email: 'nobody@test.com', password: 'Password1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues new access token using refresh token', async () => {
      const user = await registerUser();
      const res = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects request with no refresh token cookie with 401', async () => {
      const res = await api.post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;
    beforeAll(async () => {
      const user = await registerUser();
      token = user.token;
    });

    it('returns current user profile', async () => {
      const res = await api.get('/api/auth/me').set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
      expect(res.body.password).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await api.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await api.get('/api/auth/me').set({ Authorization: 'Bearer invalid' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes refresh token cookie', async () => {
      const user = await registerUser();
      const logout = await api.post('/api/auth/logout').set('Cookie', user.cookie);
      expect(logout.status).toBe(200);

      // Cookie token should no longer be usable
      const refresh = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
      expect(refresh.status).toBe(401);
    });
  });
});
