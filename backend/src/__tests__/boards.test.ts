import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, cleanupTestData, api } from './helpers.js';

describe('Boards', () => {
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;
  let boardId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const member = await registerUser();
    ownerToken  = owner.token;
    memberToken = member.token;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;

    const memberId = (await api.get('/api/auth/me').set(auth(memberToken))).body.id;
    await api.post(`/api/workspaces/${workspaceId}/members`)
      .set(auth(ownerToken)).send({ userId: memberId, role: 'MEMBER' });

    const board = await createBoard(ownerToken, workspaceId);
    boardId = board.id;
  });

  afterAll(cleanupTestData);

  describe('POST /api/workspaces/:wid/boards', () => {
    it('creates a board as OWNER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(ownerToken)).send({ name: 'Sprint Board', prefix: 'SPR1' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.prefix).toBe('SPR1');
    });

    it('rejects duplicate prefix with 409', async () => {
      await api.post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(ownerToken)).send({ name: 'A', prefix: 'DUPL' });
      const res = await api.post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(ownerToken)).send({ name: 'B', prefix: 'DUPL' });
      expect(res.status).toBe(409);
    });

    it('returns 403 for MEMBER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(memberToken)).send({ name: 'Hack', prefix: 'HCK1' });
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid prefix', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(ownerToken)).send({ name: 'Bad', prefix: 'a' }); // too short
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workspaces/:wid/boards', () => {
    it('returns list of boards for workspace members', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/boards`).set(auth(memberToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/boards/:id', () => {
    it('returns board detail with workflow and tasks', async () => {
      const res = await api.get(`/api/boards/${boardId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(boardId);
      expect(res.body.workflow).toBeDefined();
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('returns 404 for unknown board', async () => {
      const res = await api.get('/api/boards/00000000-0000-0000-0000-000000000000').set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/boards/:id', () => {
    it('updates board name as OWNER', async () => {
      const res = await api.patch(`/api/boards/${boardId}`)
        .set(auth(ownerToken)).send({ name: 'Renamed Board' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Board');
    });

    it('returns 403 for MEMBER', async () => {
      const res = await api.patch(`/api/boards/${boardId}`)
        .set(auth(memberToken)).send({ name: 'Hack' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/boards/:id', () => {
    it('deletes board as OWNER', async () => {
      const board = await createBoard(ownerToken, workspaceId);
      const res = await api.delete(`/api/boards/${board.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      const get = await api.get(`/api/boards/${board.id}`).set(auth(ownerToken));
      expect(get.status).toBe(404);
    });

    it('returns 403 for MEMBER', async () => {
      const res = await api.delete(`/api/boards/${boardId}`).set(auth(memberToken));
      expect(res.status).toBe(403);
    });
  });
});
