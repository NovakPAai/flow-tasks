/**
 * BDD: ИБ — Регистрация событий и аудит (SIEM-интеграция)
 * Feature: specs/security/ib-audit-logging.feature
 *
 * GAP-статус:
 *   РЕАЛИЗОВАНО: AuditLog модель (admin actions), TaskHistory (было-стало), WorkspaceEvent,
 *                структурированный JSON-лог, редакция sensitive-полей в логгере
 *   НЕ РЕАЛИЗОВАНО: SIEM-транспорт (syslog/HTTP-sink), multi-sink, обязательные SIEM-поля,
 *                   SIEM-теги, маскировка ПДн, системные события (start/stop/update),
 *                   буферизация при недоступном SIEM
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, uid, registerUser, cleanupTestData, auth, createBoard, createTask } from '../helpers.js';
import { prisma } from '../../prisma/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { config } from '../../config.js';

const email = () => `${uid()}@test.com`;

async function getSuperadminToken(): Promise<string> {
  const pw = 'Password1';
  await prisma.user.upsert({
    where: { email: config.SUPERADMIN_EMAIL },
    update: { password: await hashPassword(pw), isSuperadmin: true },
    create: { email: config.SUPERADMIN_EMAIL, name: 'SA', password: await hashPassword(pw), isSuperadmin: true },
  });
  const res = await api.post('/api/auth/login').send({ email: config.SUPERADMIN_EMAIL, password: pw });
  return res.body.accessToken as string;
}

async function getLastAuditLog(action: string) {
  return prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } });
}

describe('Аудит: Регистрация событий — ИБ-требования', () => {
  let superToken: string;
  let ownerUser: { token: string; userId: string; email: string };

  beforeAll(async () => {
    superToken = await getSuperadminToken();
    ownerUser = await registerUser();
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

  // ─── TaskHistory: было-стало ───────────────────────────────────────────────

  describe('Изменения в формате "было-стало" (Req логирование §1)', () => {
    let workspaceId: string;
    let boardId: string;
    let taskId: string;

    beforeAll(async () => {
      const ws = await api.post('/api/workspaces').set(auth(ownerUser.token)).send({
        name: `ws-${uid()}`, slug: `ws-${uid()}`,
      });
      workspaceId = ws.body.id;

      // createBoard uses the default workflow auto-created on workspace creation
      const board = await createBoard(ownerUser.token, workspaceId);
      boardId = board.id;

      // createTask auto-resolves statusId to the first status in the workflow
      const task = await createTask(ownerUser.token, boardId, { title: 'Original Title', priority: 'HIGH' });
      taskId = task.id;
    });

    it('изменение priority создаёт TaskHistory с oldValue и newValue', async () => {
      await api.patch(`/api/tasks/${taskId}`).set(auth(ownerUser.token)).send({ priority: 'LOW' });

      const history = await prisma.taskHistory.findFirst({
        where: { taskId, field: 'priority' },
        orderBy: { createdAt: 'desc' },
      });
      expect(history).not.toBeNull();
      expect(history!.oldValue).toBe('HIGH');
      expect(history!.newValue).toBe('LOW');
    });

    it('изменение title создаёт TaskHistory с корректными oldValue/newValue', async () => {
      await api.patch(`/api/tasks/${taskId}`).set(auth(ownerUser.token)).send({ title: 'New Title' });

      const history = await prisma.taskHistory.findFirst({
        where: { taskId, field: 'title' },
        orderBy: { createdAt: 'desc' },
      });
      expect(history).not.toBeNull();
      expect(history!.oldValue).toBe('Original Title');
      expect(history!.newValue).toBe('New Title');
    });
  });

  // ─── Admin AuditLog ────────────────────────────────────────────────────────

  describe('Аудит действий администраторов (Req логирование §2.3, ГОСТ УЗП.22)', () => {
    it('одобрение регистрации создаёт AuditLog с action=request.approve', async () => {
      const newUser = await registerUser();

      const requests = await api.get('/api/admin/registration-requests').set(auth(superToken));
      const pending = (requests.body as Array<{ id: string; email: string }>)
        .find((r) => r.email === newUser.email);

      if (!pending) return;

      await api.post(`/api/admin/registration-requests/${pending.id}/approve`).set(auth(superToken));

      const log = await getLastAuditLog('request.approve');
      expect(log).not.toBeNull();
      expect(log!.actorId).toBeTruthy();
    });

    it.todo('изменение настроек системы создаёт AuditLog с action=admin.config.change', async () => {
      await api.patch('/api/admin/config').set(auth(superToken)).send({ registrationDomain: 'newdomain.ru' });
      const log = await getLastAuditLog('admin.config.change');
      expect(log).not.toBeNull();
      const meta = log!.meta as Record<string, unknown>;
      expect(meta.setting).toBe('registrationDomain');
      expect(typeof meta.oldValue).toBe('string');
      expect(meta.newValue).toBe('newdomain.ru');
    });
  });

  // ─── SIEM-формат обязательных полей ────────────────────────────────────────

  describe('Обязательные поля SIEM-события (Req логирование §1)', () => {
    it.todo('каждый AuditLog-event содержит обязательные SIEM-поля', async () => {
      const logs = await prisma.auditLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } });

      const requiredFields = ['source', 'subject', 'tech_segment', 'tags', 'session_id', 'result'];

      for (const log of logs) {
        const meta = (log.meta ?? {}) as Record<string, unknown>;
        for (const field of requiredFields) {
          expect(meta[field], `AuditLog ${log.id} missing field: ${field}`).toBeDefined();
        }
        // tags должен быть массивом из 5 элементов
        expect(Array.isArray(meta.tags)).toBe(true);
        expect((meta.tags as unknown[]).length).toBeGreaterThanOrEqual(3);
      }
    });

    it.todo('createdAt в AuditLog соответствует формату ISO-8601', async () => {
      const log = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
      expect(log).not.toBeNull();
      expect(() => new Date(log!.createdAt).toISOString()).not.toThrow();
    });
  });

  // ─── SIEM-тегирование ──────────────────────────────────────────────────────

  describe('SIEM-тегирование (Req логирование §4)', () => {
    it.todo('тег auth.login содержит ["flowtasks","auth","iia","PROD",<dc>]', async () => {
      const user = await registerUser();
      await api.post('/api/auth/login').send({ email: user.email, password: user.password });

      const log = await getLastAuditLog('auth.login');
      const meta = (log!.meta ?? {}) as Record<string, unknown>;
      const tags = meta.tags as string[];
      expect(tags[0]).toBe('flowtasks');
      expect(tags[1]).toBe('auth');
      expect(tags[2]).toBe('iia');
    });
  });

  // ─── Маскировка ПДн ──────────────────────────────────────────────────────

  describe('Маскировка ПДн в SIEM-событиях (Req логирование §2.4)', () => {
    it.todo('email пользователя в AuditLog.meta маскируется перед отправкой в SIEM', async () => {
      // При реализации SIEM-транспорта: проверить что email передаётся как hash/mask
      const log = await getLastAuditLog('auth.login');
      const meta = (log!.meta ?? {}) as Record<string, unknown>;
      if (meta.actorEmail) {
        expect(meta.actorEmail as string).toMatch(/\*{2,}|[a-f0-9]{64}/);
      }
    });
  });

  // ─── Системные события ────────────────────────────────────────────────────

  describe('Системные события (Req логирование §2.6, ГОСТ ЦЗИ.30)', () => {
    it.todo('при старте сервера пишется событие system.service.start', async () => {
      // Проверить через специальный health+events endpoint или stdout capture
      const res = await api.get('/api/health');
      expect(res.status).toBe(200);
      // TODO: проверить что при старте был записан системный event
    });
  });

  // ─── Валидационные ошибки ────────────────────────────────────────────────

  describe('Ошибки валидации логируются (Req логирование §2.6)', () => {
    it.todo('POST /api/auth/login с невалидным телом создаёт событие system.validation.error', async () => {
      await api.post('/api/auth/login').send({ email: 'not-an-email', password: '' });
      const log = await getLastAuditLog('system.validation.error');
      expect(log).not.toBeNull();
    });
  });

  // ─── WorkspaceEvent для ресурсных операций (ГОСТ ИУ.7) ────────────────────

  describe('Регистрация операций над ресурсами БД (ГОСТ 57580 ИУ.7)', () => {
    it('создание воркспейса создаёт WorkspaceEvent с action=workspace_created', async () => {
      const wsRes = await api.post('/api/workspaces').set(auth(ownerUser.token)).send({
        name: `ws-${uid()}`, slug: `ws-${uid()}`,
      });
      const wsId = wsRes.body.id;

      const event = await prisma.workspaceEvent.findFirst({
        where: { workspaceId: wsId, action: 'workspace_created' },
      });
      expect(event).not.toBeNull();
    });
  });
});
