/**
 * Integration tests for task filtering and RBAC.
 * Covers gaps in tasks.test.ts:
 *   - Filter by statusId, assigneeId, labelId
 *   - duePreset filters on task list (today / this_week / next_week / overdue / no_date)
 *   - Combined filter parameters
 *   - Non-member access returns 403
 *   - Cross-workspace isolation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, createBoard, createTask, cleanupTestData, api, uid } from './helpers.js';

describe('Tasks — filters and RBAC', () => {
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let boardId: string;
  let workspaceId: string;
  let statuses: Array<{ id: string; name: string }>;
  let labelId: string;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    const owner   = await registerUser();
    const member  = await registerUser();
    const outsider = await registerUser();
    ownerToken    = owner.token;
    memberToken   = member.token;
    outsiderToken = outsider.token;
    ownerId       = owner.userId;
    memberId      = member.userId;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;

    // Add member to workspace, outsider stays outside
    await api.post(`/api/workspaces/${workspaceId}/members`)
      .set(auth(ownerToken)).send({ userId: memberId, role: 'MEMBER' });

    const board = await createBoard(ownerToken, workspaceId);
    boardId = board.id;

    const boardDetail = await api.get(`/api/boards/${boardId}`).set(auth(ownerToken));
    statuses = boardDetail.body.workflow.statuses;

    // Create a workspace label for label-filter tests
    const labelRes = await api.post(`/api/workspaces/${workspaceId}/labels`)
      .set(auth(ownerToken)).send({ name: `filter-label-${uid()}`, color: '#AABBCC' });
    labelId = labelRes.body.id;
  });

  afterAll(cleanupTestData);

  // ── RBAC ────────────────────────────────────────────────────────────────────

  describe('RBAC — workspace isolation', () => {
    it('outsider cannot list tasks from board (403)', async () => {
      const res = await api.get(`/api/boards/${boardId}/tasks`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });

    it('outsider cannot create a task (403)', async () => {
      const res = await api.post(`/api/boards/${boardId}/tasks`)
        .set(auth(outsiderToken)).send({ title: 'Hacker task' });
      expect(res.status).toBe(403);
    });

    it('outsider cannot get task detail (403)', async () => {
      const task = await createTask(ownerToken, boardId);
      const res = await api.get(`/api/tasks/${task.id}`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });

    it('outsider cannot update a task (403)', async () => {
      const task = await createTask(ownerToken, boardId);
      const res = await api.patch(`/api/tasks/${task.id}`)
        .set(auth(outsiderToken)).send({ title: 'Stolen' });
      expect(res.status).toBe(403);
    });

    it('outsider cannot delete a task (403)', async () => {
      const task = await createTask(ownerToken, boardId);
      const res = await api.delete(`/api/tasks/${task.id}`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });

    it('member CAN list tasks (200)', async () => {
      const res = await api.get(`/api/boards/${boardId}/tasks`).set(auth(memberToken));
      expect(res.status).toBe(200);
    });

    it('unauthenticated request returns 401', async () => {
      const res = await api.get(`/api/boards/${boardId}/tasks`);
      expect(res.status).toBe(401);
    });
  });

  // ── Filter by statusId ───────────────────────────────────────────────────────

  describe('GET /api/boards/:bid/tasks?statusId=', () => {
    it('returns only tasks in the given status', async () => {
      if (statuses.length < 2) return;

      // Create tasks in distinct statuses
      const s0 = statuses[0].id;
      const s1 = statuses[statuses.length - 1].id;
      await createTask(ownerToken, boardId, { statusId: s0, title: `Status0 ${uid()}` });
      await createTask(ownerToken, boardId, { statusId: s1, title: `Status1 ${uid()}` });

      const res = await api.get(`/api/boards/${boardId}/tasks?statusId=${s0}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.every((t: { statusId: string }) => t.statusId === s0)).toBe(true);
    });
  });

  // ── Filter by assigneeId ─────────────────────────────────────────────────────

  describe('GET /api/boards/:bid/tasks?assigneeId=', () => {
    it('returns only tasks assigned to the given user', async () => {
      await createTask(ownerToken, boardId, { assigneeId: ownerId, title: `Assigned ${uid()}` });
      await createTask(ownerToken, boardId, { title: `Unassigned ${uid()}` });

      const res = await api.get(`/api/boards/${boardId}/tasks?assigneeId=${ownerId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((t: { assigneeId: string | null }) => t.assigneeId === ownerId)).toBe(true);
    });
  });

  // ── Filter by labelId ────────────────────────────────────────────────────────

  describe('GET /api/boards/:bid/tasks?labelId=', () => {
    it('returns only tasks that have the given label', async () => {
      const task = await createTask(ownerToken, boardId, { title: `Labeled ${uid()}` });
      await api.post(`/api/tasks/${task.id}/labels/${labelId}`).set(auth(ownerToken));

      // Another task without the label
      await createTask(ownerToken, boardId, { title: `Unlabeled ${uid()}` });

      const res = await api.get(`/api/boards/${boardId}/tasks?labelId=${labelId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      // Every returned task should have this label
      const allHaveLabel = await Promise.all(
        res.body.map(async (t: { id: string }) => {
          const detail = await api.get(`/api/tasks/${t.id}`).set(auth(ownerToken));
          return detail.body.labels.some((l: { labelId: string }) => l.labelId === labelId);
        })
      );
      expect(allHaveLabel.every(Boolean)).toBe(true);
    });
  });

  // ── Due date preset filters on task list ──────────────────────────────────────

  describe('GET /api/boards/:bid/tasks?duePreset=', () => {
    it('duePreset=overdue returns only past-due tasks', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      await createTask(ownerToken, boardId, { title: `Overdue ${uid()}`, dueDate: pastDate });

      const res = await api.get(`/api/boards/${boardId}/tasks?duePreset=overdue`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((t: { dueDate: string }) => {
        expect(new Date(t.dueDate).getTime()).toBeLessThan(Date.now());
      });
    });

    it('duePreset=no_date returns only tasks without a due date', async () => {
      await createTask(ownerToken, boardId, { title: `NoDue ${uid()}` });

      const res = await api.get(`/api/boards/${boardId}/tasks?duePreset=no_date`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((t: { dueDate: string | null }) => {
        expect(t.dueDate).toBeNull();
      });
    });

    it('duePreset=today returns tasks due today', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0); // noon today
      await createTask(ownerToken, boardId, { title: `Today ${uid()}`, dueDate: today.toISOString() });

      const res = await api.get(`/api/boards/${boardId}/tasks?duePreset=today`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      // All returned tasks should be due today (not tomorrow, not yesterday)
      const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);
      res.body.forEach((t: { dueDate: string }) => {
        const due = new Date(t.dueDate).getTime();
        expect(due).toBeGreaterThanOrEqual(todayStart.getTime());
        expect(due).toBeLessThanOrEqual(todayEnd.getTime());
      });
    });
  });

  // ── Combined filters ─────────────────────────────────────────────────────────

  describe('Combined filter parameters', () => {
    it('priority + search filters compose correctly', async () => {
      const uniqueTitle = `ComboHigh-${uid()}`;
      await createTask(ownerToken, boardId, { title: uniqueTitle, priority: 'HIGH' });
      // Another HIGH task with a different title
      await createTask(ownerToken, boardId, { title: `OtherHigh-${uid()}`, priority: 'HIGH' });

      const res = await api.get(`/api/boards/${boardId}/tasks?priority=HIGH&search=${uniqueTitle}`)
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.every((t: { priority: string; title: string }) =>
        t.priority === 'HIGH' && t.title.includes(uniqueTitle)
      )).toBe(true);
    });

    it('assigneeId + priority compose correctly', async () => {
      await createTask(ownerToken, boardId, { assigneeId: ownerId, priority: 'HIGH', title: `HighMine ${uid()}` });
      await createTask(ownerToken, boardId, { assigneeId: memberId, priority: 'HIGH', title: `HighOther ${uid()}` });

      const res = await api.get(`/api/boards/${boardId}/tasks?assigneeId=${ownerId}&priority=HIGH`)
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      res.body.forEach((t: { assigneeId: string; priority: string }) => {
        expect(t.assigneeId).toBe(ownerId);
        expect(t.priority).toBe('HIGH');
      });
    });
  });

  // ── parentId filter ──────────────────────────────────────────────────────────
  // NOTE: The parentId=null filter is not accessible via HTTP query string because
  // query params are always strings — Zod rejects "null" as an invalid UUID.
  // The parentId filter only works with a valid UUID to filter by specific parent.

  describe('GET /api/boards/:bid/tasks?parentId=<uuid>', () => {
    it('returns only direct children of given parent', async () => {
      const parent = await createTask(ownerToken, boardId);
      const child  = await createTask(ownerToken, boardId, { parentId: parent.id });
      await createTask(ownerToken, boardId, { title: 'Unrelated root task' });

      const res = await api.get(`/api/boards/${boardId}/tasks?parentId=${parent.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.some((t: { id: string }) => t.id === child.id)).toBe(true);
      expect(res.body.every((t: { parentId: string | null }) => t.parentId === parent.id)).toBe(true);
    });
  });

  // ── My-tasks duePreset ───────────────────────────────────────────────────────

  describe('GET /api/my-tasks?duePreset= (owner perspective)', () => {
    it('duePreset=this_week returns tasks due within 7 days', async () => {
      const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await createTask(ownerToken, boardId, {
        assigneeId: ownerId,
        dueDate: in3Days,
        title: `ThisWeek ${uid()}`,
      });

      const res = await api.get('/api/my-tasks?duePreset=this_week').set(auth(ownerToken));
      expect(res.status).toBe(200);
      const now = Date.now();
      const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
      res.body.forEach((t: { dueDate: string }) => {
        const due = new Date(t.dueDate).getTime();
        expect(due).toBeGreaterThanOrEqual(now - 86400000); // allow 1-day tolerance
        expect(due).toBeLessThan(weekEnd);
      });
    });

    it('duePreset=next_week returns tasks due 7-14 days from now', async () => {
      const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      await createTask(ownerToken, boardId, {
        assigneeId: ownerId,
        dueDate: in10Days,
        title: `NextWeek ${uid()}`,
      });

      const res = await api.get('/api/my-tasks?duePreset=next_week').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 401 without token', async () => {
      const res = await api.get('/api/my-tasks');
      expect(res.status).toBe(401);
    });
  });
});
