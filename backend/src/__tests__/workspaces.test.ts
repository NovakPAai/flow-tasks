import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, slug, auth, registerUser, createWorkspace, cleanupTestData } from './helpers.js';

describe('Workspaces', () => {
  let ownerToken: string;
  let memberToken: string;
  let viewerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const member = await registerUser();
    const viewer = await registerUser();
    ownerToken  = owner.token;
    memberToken = member.token;
    viewerToken = viewer.token;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;

    // Add member and viewer
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: (await api.get('/api/auth/me').set(auth(memberToken))).body.id, role: 'MEMBER' });
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: (await api.get('/api/auth/me').set(auth(viewerToken))).body.id, role: 'VIEWER' });
  });

  afterAll(cleanupTestData);

  describe('POST /api/workspaces', () => {
    it('creates a workspace and returns it', async () => {
      const wsSlug = slug();
      const res = await api.post('/api/workspaces').set(auth(ownerToken))
        .send({ name: 'My WS', slug: wsSlug });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.slug).toBe(wsSlug);
    });

    it('rejects duplicate slug with 409', async () => {
      const dupSlug = slug();
      await api.post('/api/workspaces').set(auth(ownerToken)).send({ name: 'A', slug: dupSlug });
      const res = await api.post('/api/workspaces').set(auth(ownerToken)).send({ name: 'B', slug: dupSlug });
      expect(res.status).toBe(409);
    });

    it('returns 401 without token', async () => {
      const res = await api.post('/api/workspaces').send({ name: 'X', slug: slug() });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/workspaces', () => {
    it('returns list of workspaces for user', async () => {
      const res = await api.get('/api/workspaces').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('returns workspace detail with members and workflows', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(workspaceId);
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(Array.isArray(res.body.workflows)).toBe(true);
    });

    it('returns 403 for non-member', async () => {
      const stranger = await registerUser();
      const res = await api.get(`/api/workspaces/${workspaceId}`).set(auth(stranger.token));
      expect(res.status).toBe(403);
    });

    it('returns 403 for unknown id (member check precedes 404)', async () => {
      const res = await api.get('/api/workspaces/00000000-0000-0000-0000-000000000000').set(auth(ownerToken));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/workspaces/:id', () => {
    it('updates name as OWNER', async () => {
      const res = await api.patch(`/api/workspaces/${workspaceId}`).set(auth(ownerToken))
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('returns 403 for MEMBER', async () => {
      const res = await api.patch(`/api/workspaces/${workspaceId}`).set(auth(memberToken))
        .send({ name: 'Hacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('Members', () => {
    it('GET /members returns all members', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('PATCH /members/:userId updates role as OWNER', async () => {
      const memberId = (await api.get('/api/auth/me').set(auth(memberToken))).body.id;
      const res = await api.patch(`/api/workspaces/${workspaceId}/members/${memberId}`)
        .set(auth(ownerToken)).send({ role: 'VIEWER' });
      expect(res.status).toBe(200);
    });

    it('DELETE /members/:userId removes member as OWNER', async () => {
      const extra = await registerUser();
      const extraId = (await api.get('/api/auth/me').set(auth(extra.token))).body.id;
      await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
        .send({ userId: extraId, role: 'VIEWER' });
      const res = await api.delete(`/api/workspaces/${workspaceId}/members/${extraId}`)
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/workspaces/:id/history', () => {
    it('returns workspace event history for OWNER', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/history`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 403 for VIEWER', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/history`).set(auth(viewerToken));
      expect(res.status).toBe(403);
    });
  });
});
