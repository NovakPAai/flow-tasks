import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, createTask, cleanupTestData, api } from './helpers.js';

describe('Checklists', () => {
  let ownerToken: string;
  let viewerToken: string;
  let taskId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const viewer = await registerUser();
    ownerToken  = owner.token;
    viewerToken = viewer.token;

    const ws = await createWorkspace(ownerToken);
    const workspaceId = ws.id;
    const viewerId = (await api.get('/api/auth/me').set(auth(viewerToken))).body.id;
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: viewerId, role: 'VIEWER' });

    const board = await createBoard(ownerToken, workspaceId);
    const task  = await createTask(ownerToken, board.id);
    taskId = task.id;
  });

  afterAll(cleanupTestData);

  describe('POST /api/tasks/:tid/checklists', () => {
    it('creates a checklist', async () => {
      const res = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(ownerToken)).send({ title: 'Acceptance Criteria' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Acceptance Criteria');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 403 for VIEWER', async () => {
      const res = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(viewerToken)).send({ title: 'Blocked' });
      expect(res.status).toBe(403);
    });

    it('rejects empty title with 400', async () => {
      const res = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(ownerToken)).send({ title: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('Checklist items', () => {
    let checklistId: string;

    beforeAll(async () => {
      const res = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(ownerToken)).send({ title: 'Items Test' });
      checklistId = res.body.id;
    });

    describe('POST /api/checklists/:id/items', () => {
      it('creates a checklist item', async () => {
        const res = await api.post(`/api/checklists/${checklistId}/items`)
          .set(auth(ownerToken)).send({ title: 'Step one' });
        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.isDone).toBe(false);
      });

      it('rejects empty title with 400', async () => {
        const res = await api.post(`/api/checklists/${checklistId}/items`)
          .set(auth(ownerToken)).send({ title: '' });
        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/checklist-items/:id', () => {
      it('marks item as done', async () => {
        const create = await api.post(`/api/checklists/${checklistId}/items`)
          .set(auth(ownerToken)).send({ title: 'Do something' });
        const itemId = create.body.id;
        const res = await api.patch(`/api/checklist-items/${itemId}`)
          .set(auth(ownerToken)).send({ isDone: true });
        expect(res.status).toBe(200);
        expect(res.body.isDone).toBe(true);
      });

      it('updates item title', async () => {
        const create = await api.post(`/api/checklists/${checklistId}/items`)
          .set(auth(ownerToken)).send({ title: 'Old title' });
        const res = await api.patch(`/api/checklist-items/${create.body.id}`)
          .set(auth(ownerToken)).send({ title: 'New title' });
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('New title');
      });
    });

    describe('DELETE /api/checklist-items/:id', () => {
      it('deletes a checklist item', async () => {
        const create = await api.post(`/api/checklists/${checklistId}/items`)
          .set(auth(ownerToken)).send({ title: 'To delete' });
        const res = await api.delete(`/api/checklist-items/${create.body.id}`).set(auth(ownerToken));
        expect(res.status).toBe(200);
      });
    });
  });

  describe('DELETE /api/checklists/:id', () => {
    it('deletes checklist', async () => {
      const create = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(ownerToken)).send({ title: 'To be deleted' });
      const res = await api.delete(`/api/checklists/${create.body.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
    });

    it('returns 403 for VIEWER', async () => {
      const create = await api.post(`/api/tasks/${taskId}/checklists`)
        .set(auth(ownerToken)).send({ title: 'Protected' });
      const res = await api.delete(`/api/checklists/${create.body.id}`).set(auth(viewerToken));
      expect(res.status).toBe(403);
    });
  });
});
