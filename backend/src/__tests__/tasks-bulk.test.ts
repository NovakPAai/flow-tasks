import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, createTask, cleanupTestData, api } from './helpers.js';
import { prisma } from '../prisma/client.js';

describe('Bulk task operations', () => {
  let ownerToken: string;
  let memberToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let boardId: string;
  let otherBoardId: string;
  let workspaceId: string;
  let memberId: string;
  let statuses: Array<{ id: string; name: string; category: string }>;

  beforeAll(async () => {
    const owner   = await registerUser();
    const member  = await registerUser();
    const viewer  = await registerUser();
    const outsider = await registerUser();
    ownerToken    = owner.token;
    memberToken   = member.token;
    viewerToken   = viewer.token;
    outsiderToken = outsider.token;
    memberId      = member.userId;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;

    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: memberId, role: 'MEMBER' });
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: viewer.userId, role: 'VIEWER' });

    const board = await createBoard(ownerToken, workspaceId);
    boardId = board.id;
    const otherBoard = await createBoard(ownerToken, workspaceId);
    otherBoardId = otherBoard.id;

    const boardDetail = await api.get(`/api/boards/${boardId}`).set(auth(ownerToken));
    statuses = boardDetail.body.workflow.statuses;
  });

  afterAll(cleanupTestData);

  // ── PATCH /bulk ──────────────────────────────────────────────────────────────

  describe('PATCH /api/boards/:bid/tasks/bulk', () => {
    it('bulk-updates priority for multiple tasks', async () => {
      const t1 = await createTask(ownerToken, boardId);
      const t2 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id, t2.id], patch: { priority: 'HIGH' } });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      const check = await api.get(`/api/tasks/${t1.id}`).set(auth(ownerToken));
      expect(check.body.priority).toBe('HIGH');
    });

    it('bulk-updates status and moves tasks to new column', async () => {
      const t1 = await createTask(ownerToken, boardId, { statusId: statuses[0].id });
      const secondStatus = statuses[1];

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { statusId: secondStatus.id } });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);

      const check = await api.get(`/api/tasks/${t1.id}`).set(auth(ownerToken));
      expect(check.body.statusId).toBe(secondStatus.id);
    });

    it('bulk-updates assignee', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { assigneeId: memberId } });

      expect(res.status).toBe(200);
      const check = await api.get(`/api/tasks/${t1.id}`).set(auth(ownerToken));
      expect(check.body.assignee?.id).toBe(memberId);
    });

    it('writes taskHistory records for changed fields', async () => {
      const t1 = await createTask(ownerToken, boardId);

      await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { priority: 'LOW' } });

      const history = await prisma.taskHistory.findMany({ where: { taskId: t1.id } });
      expect(history.some(h => h.field === 'priority' && h.newValue === 'LOW')).toBe(true);
    });

    it('writes taskStatusHistory on bulk status change', async () => {
      const t1 = await createTask(ownerToken, boardId, { statusId: statuses[0].id });
      const secondStatus = statuses[1];

      // Ensure there's an open status history entry
      await prisma.taskStatusHistory.create({ data: { taskId: t1.id, statusId: statuses[0].id } });

      await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { statusId: secondStatus.id } });

      const closedEntry = await prisma.taskStatusHistory.findFirst({
        where: { taskId: t1.id, statusId: statuses[0].id, endedAt: { not: null } },
      });
      const newEntry = await prisma.taskStatusHistory.findFirst({
        where: { taskId: t1.id, statusId: secondStatus.id, endedAt: null },
      });
      expect(closedEntry).not.toBeNull();
      expect(newEntry).not.toBeNull();
    });

    it('silently ignores IDs from a different board (returns updated: 0)', async () => {
      const otherTask = await createTask(ownerToken, otherBoardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [otherTask.id], patch: { priority: 'HIGH' } });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(0);

      // Original task must be unchanged
      const check = await api.get(`/api/tasks/${otherTask.id}`).set(auth(ownerToken));
      expect(check.body.priority).not.toBe('HIGH');
    });

    it('returns 400 for statusId not in board workflow', async () => {
      const t1 = await createTask(ownerToken, boardId);
      // Create an isolated workspace+board so its statuses share no workflow with boardId
      const isolatedWs = await createWorkspace(ownerToken);
      const isolatedBoard = await createBoard(ownerToken, isolatedWs.id);
      const isolatedDetail = await api.get(`/api/boards/${isolatedBoard.id}`).set(auth(ownerToken));
      const foreignStatusId = isolatedDetail.body.workflow.statuses[0].id;

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { statusId: foreignStatusId } });

      expect(res.status).toBe(400);
    });

    it('returns 400 for assigneeId not in workspace', async () => {
      const outsiderDetail = await api.get('/api/auth/me').set(auth(outsiderToken));
      const outsiderId = outsiderDetail.body.id;
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: { assigneeId: outsiderId } });

      expect(res.status).toBe(400);
    });

    it('returns 400 when ids array exceeds 100', async () => {
      const ids = Array.from({ length: 101 }, () => '00000000-0000-0000-0000-000000000001');

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids, patch: { priority: 'LOW' } });

      expect(res.status).toBe(400);
    });

    it('returns 400 when patch object is empty', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id], patch: {} });

      expect(res.status).toBe(400);
    });

    it('VIEWER gets 403', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(viewerToken))
        .send({ ids: [t1.id], patch: { priority: 'LOW' } });

      expect(res.status).toBe(403);
    });

    it('non-member gets 404', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .set(auth(outsiderToken))
        .send({ ids: [t1.id], patch: { priority: 'LOW' } });

      expect(res.status).toBe(404);
    });

    it('unauthenticated gets 401', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.patch(`/api/boards/${boardId}/tasks/bulk`)
        .send({ ids: [t1.id], patch: { priority: 'LOW' } });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /bulk-delete ────────────────────────────────────────────────────────

  describe('POST /api/boards/:bid/tasks/bulk-delete', () => {
    it('deletes multiple tasks', async () => {
      const t1 = await createTask(ownerToken, boardId);
      const t2 = await createTask(ownerToken, boardId);

      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(ownerToken))
        .send({ ids: [t1.id, t2.id] });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);

      const check = await api.get(`/api/tasks/${t1.id}`).set(auth(ownerToken));
      expect(check.status).toBe(404);
    });

    it('cascades to subtasks', async () => {
      const parent = await createTask(ownerToken, boardId);
      const child = await api.post(`/api/boards/${boardId}/tasks`)
        .set(auth(ownerToken))
        .send({ title: 'Subtask', parentId: parent.id });
      const childId = child.body.id;

      await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(ownerToken))
        .send({ ids: [parent.id] });

      const checkChild = await api.get(`/api/tasks/${childId}`).set(auth(ownerToken));
      expect(checkChild.status).toBe(404);
    });

    it('silently ignores IDs from a different board (returns deleted: 0)', async () => {
      const otherTask = await createTask(ownerToken, otherBoardId);

      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(ownerToken))
        .send({ ids: [otherTask.id] });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(0);

      const check = await api.get(`/api/tasks/${otherTask.id}`).set(auth(ownerToken));
      expect(check.status).toBe(200);
    });

    it('returns 400 when ids array exceeds 100', async () => {
      const ids = Array.from({ length: 101 }, () => '00000000-0000-0000-0000-000000000001');

      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(ownerToken))
        .send({ ids });

      expect(res.status).toBe(400);
    });

    it('VIEWER gets 403', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(viewerToken))
        .send({ ids: [t1.id] });

      expect(res.status).toBe(403);
    });

    it('non-member gets 404', async () => {
      const t1 = await createTask(ownerToken, boardId);

      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .set(auth(outsiderToken))
        .send({ ids: [t1.id] });

      expect(res.status).toBe(404);
    });

    it('unauthenticated gets 401', async () => {
      const res = await api.post(`/api/boards/${boardId}/tasks/bulk-delete`)
        .send({ ids: ['00000000-0000-0000-0000-000000000001'] });

      expect(res.status).toBe(401);
    });
  });
});
