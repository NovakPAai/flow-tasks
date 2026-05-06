import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, createTask, cleanupTestData, api } from './helpers.js';

describe('Comments', () => {
  let ownerToken: string;
  let memberToken: string;
  let viewerToken: string;
  let taskId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const member = await registerUser();
    const viewer = await registerUser();
    ownerToken  = owner.token;
    memberToken = member.token;
    viewerToken = viewer.token;

    const ws = await createWorkspace(ownerToken);
    const workspaceId = ws.id;

    const memberId = (await api.get('/api/auth/me').set(auth(memberToken))).body.id;
    const viewerId = (await api.get('/api/auth/me').set(auth(viewerToken))).body.id;
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: memberId, role: 'MEMBER' });
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: viewerId, role: 'VIEWER' });

    const board = await createBoard(ownerToken, workspaceId);
    const task  = await createTask(ownerToken, board.id);
    taskId = task.id;
  });

  afterAll(cleanupTestData);

  describe('POST /api/tasks/:tid/comments', () => {
    it('creates a comment as MEMBER', async () => {
      const res = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: 'Hello world' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.body).toBe('Hello world');
    });

    it('returns 403 for VIEWER', async () => {
      const res = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(viewerToken)).send({ body: 'Can I comment?' });
      expect(res.status).toBe(403);
    });

    it('rejects empty body with 400', async () => {
      const res = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tasks/:tid/comments', () => {
    it('returns comments for the task', async () => {
      await api.post(`/api/tasks/${taskId}/comments`).set(auth(ownerToken)).send({ body: 'Comment 1' });
      const res = await api.get(`/api/tasks/${taskId}/comments`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.comments)).toBe(true);
      expect(res.body.comments.length).toBeGreaterThan(0);
    });

    it('VIEWER can read comments', async () => {
      const res = await api.get(`/api/tasks/${taskId}/comments`).set(auth(viewerToken));
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/comments/:id', () => {
    it('author can update their comment', async () => {
      const create = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: 'Original' });
      const commentId = create.body.id;
      const res = await api.patch(`/api/comments/${commentId}`)
        .set(auth(memberToken)).send({ body: 'Edited' });
      expect(res.status).toBe(200);
      expect(res.body.body).toBe('Edited');
    });

    it('non-author cannot update comment with 403', async () => {
      const create = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: 'Mine' });
      const res = await api.patch(`/api/comments/${create.body.id}`)
        .set(auth(ownerToken)).send({ body: 'Stolen' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('author can delete their comment', async () => {
      const create = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: 'Delete me' });
      const res = await api.delete(`/api/comments/${create.body.id}`).set(auth(memberToken));
      expect(res.status).toBe(200);
    });

    it('OWNER can delete any comment', async () => {
      const create = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(memberToken)).send({ body: 'Owner deletes' });
      const res = await api.delete(`/api/comments/${create.body.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
    });

    it('non-author non-owner cannot delete with 403', async () => {
      const other = await registerUser();
      const otherWs = await createWorkspace(other.token);
      // Another member of this workspace won't have cross-workspace delete access
      const create = await api.post(`/api/tasks/${taskId}/comments`)
        .set(auth(ownerToken)).send({ body: 'Protected' });
      // memberToken is not the author of this comment
      const res = await api.delete(`/api/comments/${create.body.id}`).set(auth(memberToken));
      expect(res.status).toBe(403);
      // Cleanup unused ws
      void otherWs;
    });
  });
});
