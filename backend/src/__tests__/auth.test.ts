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

    it('rejects duplicate email with 409', async () => {
      const e = email();
      await api.post('/api/auth/register').send({ email: e, name: 'A', password: 'Password1' });
      const res = await api.post('/api/auth/register').send({ email: e, name: 'B', password: 'Password1' });
      expect(res.status).toBe(409);
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
      const res = await api.post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects invalid refresh token with 401', async () => {
      const res = await api.post('/api/auth/refresh').send({ refreshToken: 'bad-token' });
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
    it('revokes refresh token', async () => {
      const user = await registerUser();
      const { refreshToken } = user;
      const logout = await api.post('/api/auth/logout').send({ refreshToken });
      expect(logout.status).toBe(200);

      // Token should no longer be usable
      const refresh = await api.post('/api/auth/refresh').send({ refreshToken });
      expect(refresh.status).toBe(401);
    });
  });
});
