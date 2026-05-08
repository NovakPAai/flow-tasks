/**
 * BDD: ИБ — Управление правами доступа (RBAC / Record-level)
 * Feature: specs/security/ib-access-control.feature
 *
 * GAP-статус:
 *   РЕАЛИЗОВАНО: workspace RBAC (OWNER/MEMBER/VIEWER), superadmin guard
 *   НЕ РЕАЛИЗОВАНО: isActive/blocking flag, AuditLog для role-changes с oldValue/newValue,
 *                    API-key scope enforcement, доступ к audit-log сам логируется
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, registerUser, cleanupTestData, auth } from '../helpers.js';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { config } from '../../config.js';

const email = () => `${uid()}@test.com`;

async function getSuperadminToken(): Promise<string> {
  const pw = 'Password1';
  await prisma.user.upsert({
    where: { email: config.SUPERADMIN_EMAIL },
    update: { password: await hashPassword(pw), isSuperadmin: true },
    create: { email: config.SUPERADMIN_EMAIL, name: 'Superadmin', password: await hashPassword(pw), isSuperadmin: true },
  });
  const res = await api.post('/api/auth/login').send({ email: config.SUPERADMIN_EMAIL, password: pw });
  return res.body.accessToken as string;
}

async function createWorkspace(token: string, name = `ws-${uid()}`) {
  const res = await api.post('/api/workspaces').set(auth(token)).send({ name, slug: name });
  return res.body as { id: string; name: string };
}

async function getLastAuditLog(action: string) {
  return prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } });
}

describe('RBAC: Управление правами доступа — ИБ-требования', () => {
  let superToken: string;
  let ownerUser: { token: string; userId: string; email: string };
  let memberUser: { token: string; userId: string; email: string };
  let viewerUser: { token: string; userId: string; email: string };
  let outsiderUser: { token: string; userId: string; email: string };
  let workspaceId: string;

  beforeAll(async () => {
    superToken = await getSuperadminToken();
    [ownerUser, memberUser, viewerUser, outsiderUser] = await Promise.all([
      registerUser(),
      registerUser(),
      registerUser(),
      registerUser(),
    ]);

    const ws = await createWorkspace(ownerUser.token);
    workspaceId = ws.id;

    // Add member and viewer
    await api
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(auth(ownerUser.token))
      .send({ userId: memberUser.userId, role: 'MEMBER' });
    await api
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(auth(ownerUser.token))
      .send({ userId: viewerUser.userId, role: 'VIEWER' });
  });

  afterAll(async () => {
    // Delete superadmin's workspaces first — Workspace.creatorId has no cascade on user delete
    const sa = await prisma.user.findUnique({ where: { email: config.SUPERADMIN_EMAIL }, select: { id: true } });
    if (sa) {
      await prisma.workspace.deleteMany({ where: { creatorId: sa.id } });
      await prisma.user.delete({ where: { id: sa.id } });
    }
    await cleanupTestData();
  });

  // ─── Принцип минимальных полномочий ────────────────────────────────────────

  describe('Минимальные полномочия (Req §1.3.1, §1.4.1)', () => {
    it('VIEWER не может удалить воркспейс — 403', async () => {
      const res = await api.delete(`/api/workspaces/${workspaceId}`).set(auth(viewerUser.token));
      expect(res.status).toBe(403);
    });

    it('MEMBER не может удалить воркспейс — 403', async () => {
      const res = await api.delete(`/api/workspaces/${workspaceId}`).set(auth(memberUser.token));
      expect(res.status).toBe(403);
    });

    it('OWNER может обновить настройки воркспейса', async () => {
      const res = await api
        .patch(`/api/workspaces/${workspaceId}`)
        .set(auth(ownerUser.token))
        .send({ description: 'updated' });
      expect(res.status).toBe(200);
    });

    it('без аутентификации любой запрос возвращает 401', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Изоляция по воркспейсу (Record-level) ─────────────────────────────────

  describe('Record-level isolation (Req §1.3.3, §1.7)', () => {
    let board: { id: string };
    let task: { id: string };

    beforeAll(async () => {
      // Create a workflow and board in the workspace
      const wfRes = await api
        .post(`/api/workspaces/${workspaceId}/workflows`)
        .set(auth(ownerUser.token))
        .send({ name: 'Default', mode: 'BIDIRECTIONAL' });

      // Add status to workflow
      await api
        .post(`/api/workflow-statuses`)
        .set(auth(ownerUser.token))
        .send({ workflowId: wfRes.body.id, name: 'Todo', color: '#aaa', position: 0, category: 'OPEN' });

      const wfWithStatuses = await api
        .get(`/api/workflows/${wfRes.body.id}`)
        .set(auth(ownerUser.token));
      const statusId = wfWithStatuses.body?.statuses?.[0]?.id;

      const boardRes = await api
        .post(`/api/workspaces/${workspaceId}/boards`)
        .set(auth(ownerUser.token))
        .send({ name: 'Board1', prefix: `B${uid().slice(0, 3).toUpperCase()}`, workflowId: wfRes.body.id });
      board = boardRes.body;

      if (board?.id && statusId) {
        const taskRes = await api
          .post(`/api/boards/${board.id}/tasks`)
          .set(auth(ownerUser.token))
          .send({ title: 'Task1', statusId });
        task = taskRes.body;
      }
    });

    it('пользователь без членства (outsider) не видит задачи воркспейса', async () => {
      if (!task?.id) return;
      const res = await api.get(`/api/tasks/${task.id}`).set(auth(outsiderUser.token));
      expect([403, 404]).toContain(res.status);
    });

    it('MEMBER видит задачи своего воркспейса', async () => {
      if (!board?.id) return;
      const res = await api.get(`/api/boards/${board.id}/tasks`).set(auth(memberUser.token));
      expect(res.status).toBe(200);
    });
  });

  // ─── Superadmin полномочия ─────────────────────────────────────────────────

  describe('Superadmin полный доступ (Req §1.5.3)', () => {
    it('superadmin видит всех пользователей через /api/admin/users', async () => {
      const res = await api.get('/api/admin/users').set(auth(superToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users ?? res.body)).toBe(true);
    });

    it('обычный пользователь не может вызвать /api/admin/users — 403', async () => {
      const res = await api.get('/api/admin/users').set(auth(memberUser.token));
      expect(res.status).toBe(403);
    });
  });

  // ─── AuditLog для изменений прав ──────────────────────────────────────────

  describe('AuditLog для изменений прав (ГОСТ 57580 УЗП.24, УЗП.25)', () => {
    it('добавление участника записывается в WorkspaceEvent', async () => {
      const newUser = await registerUser();
      await api
        .post(`/api/workspaces/${workspaceId}/members`)
        .set(auth(ownerUser.token))
        .send({ userId: newUser.userId, role: 'MEMBER' });

      const event = await prisma.workspaceEvent.findFirst({
        where: { workspaceId, action: 'member_added' },
        orderBy: { createdAt: 'desc' },
      });
      expect(event).not.toBeNull();
      expect(event!.userId).toBe(ownerUser.userId);
    });

    it('изменение роли записывается с oldRole и newRole в мета (было-стало)', async () => {
      await api
        .patch(`/api/workspaces/${workspaceId}/members/${viewerUser.userId}`)
        .set(auth(ownerUser.token))
        .send({ role: 'MEMBER' });

      const event = await prisma.workspaceEvent.findFirst({
        where: { workspaceId, action: 'member_role_changed' },
        orderBy: { createdAt: 'desc' },
      });
      expect(event).not.toBeNull();
      const meta = event!.meta as Record<string, unknown>;
      expect(meta.oldRole).toBe('VIEWER');
      expect(meta.newRole).toBe('MEMBER');
    });
  });

  // ─── Блокировка пользователя ──────────────────────────────────────────────

  describe('Блокировка пользователя администратором (Req логирование §2.2)', () => {
    it('заблокированный пользователь получает 403 при попытке входа', async () => {
      const blocked = await registerUser();
      await api
        .patch(`/api/admin/users/${blocked.userId}`)
        .set(auth(superToken))
        .send({ isActive: false });

      const res = await api.post('/api/auth/login').send({ email: blocked.email, password: blocked.password });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_DISABLED');
    });

    it('блокировка пользователя создаёт AuditLog с action=admin.user.deactivate', async () => {
      const blocked = await registerUser();
      await api
        .patch(`/api/admin/users/${blocked.userId}`)
        .set(auth(superToken))
        .send({ isActive: false });

      const log = await getLastAuditLog('admin.user.deactivate');
      expect(log).not.toBeNull();
      expect(log!.targetId).toBe(blocked.userId);
    });
  });
});
