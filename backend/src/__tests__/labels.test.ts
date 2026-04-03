import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, createTask, cleanupTestData, api, uid } from './helpers.js';

describe('Labels', () => {
  let ownerToken: string;
  let viewerToken: string;
  let workspaceId: string;
  let taskId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const viewer = await registerUser();
    ownerToken  = owner.token;
    viewerToken = viewer.token;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;
    const viewerId = (await api.get('/api/auth/me').set(auth(viewerToken))).body.id;
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: viewerId, role: 'VIEWER' });

    const board = await createBoard(ownerToken, workspaceId);
    const task  = await createTask(ownerToken, board.id);
    taskId = task.id;
  });

  afterAll(cleanupTestData);

  describe('POST /api/workspaces/:wid/labels', () => {
    it('creates a label as OWNER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: '#FF5733' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('rejects duplicate label name with 409', async () => {
      const name = `label-${uid()}`;
      await api.post(`/api/workspaces/${workspaceId}/labels`).set(auth(ownerToken)).send({ name, color: '#000000' });
      const res = await api.post(`/api/workspaces/${workspaceId}/labels`).set(auth(ownerToken)).send({ name, color: '#111111' });
      expect(res.status).toBe(409);
    });

    it('returns 403 for VIEWER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(viewerToken)).send({ name: `label-${uid()}`, color: '#AABBCC' });
      expect(res.status).toBe(403);
    });

    it('rejects invalid color format with 400', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: 'red' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workspaces/:wid/labels', () => {
    it('returns list of labels', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/labels`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Task label association', () => {
    let labelId: string;

    beforeAll(async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: '#123456' });
      labelId = res.body.id;
    });

    it('POST adds label to task', async () => {
      const res = await api.post(`/api/tasks/${taskId}/labels/${labelId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((l: { labelId: string }) => l.labelId === labelId)).toBe(true);
    });

    it('DELETE removes label from task', async () => {
      await api.post(`/api/tasks/${taskId}/labels/${labelId}`).set(auth(ownerToken));
      const res = await api.delete(`/api/tasks/${taskId}/labels/${labelId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.some((l: { labelId: string }) => l.labelId === labelId)).toBe(false);
    });

    it('returns 403 when VIEWER tries to add label', async () => {
      const res = await api.post(`/api/tasks/${taskId}/labels/${labelId}`).set(auth(viewerToken));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/labels/:id', () => {
    it('updates label color as OWNER', async () => {
      const createRes = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: '#AABBCC' });
      const res = await api.patch(`/api/labels/${createRes.body.id}`)
        .set(auth(ownerToken)).send({ color: '#DDEEFF' });
      expect(res.status).toBe(200);
      expect(res.body.color).toBe('#DDEEFF');
    });
  });

  describe('DELETE /api/labels/:id', () => {
    it('deletes label as OWNER', async () => {
      const createRes = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: '#112233' });
      const res = await api.delete(`/api/labels/${createRes.body.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
    });

    it('returns 403 for VIEWER', async () => {
      const createRes = await api.post(`/api/workspaces/${workspaceId}/labels`)
        .set(auth(ownerToken)).send({ name: `label-${uid()}`, color: '#334455' });
      const res = await api.delete(`/api/labels/${createRes.body.id}`).set(auth(viewerToken));
      expect(res.status).toBe(403);
    });
  });
});
