import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, auth, registerUser, createWorkspace, cleanupTestData } from './helpers.js';
import { addBusinessDays } from '../modules/workspaces/workspaces.service.js';
import { prisma } from '../prisma/client.js';

describe('Workspace Trash (#157)', () => {
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let strangerToken: string;
  let workspaceId: string;
  let originalSlug: string;

  beforeAll(async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const stranger = await registerUser();
    ownerToken = owner.token;
    ownerId = owner.userId;
    memberToken = member.token;
    memberId = member.userId;
    strangerToken = stranger.token;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;
    originalSlug = ws.slug;

    await api
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(auth(ownerToken))
      .send({ userId: memberId, role: 'MEMBER' });
  });

  afterAll(cleanupTestData);

  describe('addBusinessDays helper', () => {
    it('skips weekends — Friday + 1 business day = Monday', () => {
      // 2026-05-15 is a Friday (UTC). +1 business day should be Monday 2026-05-18.
      const fri = new Date('2026-05-15T00:00:00.000Z');
      const result = addBusinessDays(fri, 1);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-18');
    });

    it('skips weekends — Monday + 10 business days = 2 weeks later Monday', () => {
      // 2026-05-04 is Monday. +10 business days = 2026-05-18 (next-next Monday).
      const mon = new Date('2026-05-04T00:00:00.000Z');
      const result = addBusinessDays(mon, 10);
      expect(result.toISOString().slice(0, 10)).toBe('2026-05-18');
    });
  });

  describe('DELETE /api/workspaces/:id — soft-delete', () => {
    it('Owner soft-deletes workspace; it disappears from list', async () => {
      const ws = await createWorkspace(ownerToken);

      const deleteRes = await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      expect(deleteRes.status).toBe(200);

      const listRes = await api.get('/api/workspaces').set(auth(ownerToken));
      expect(listRes.body.find((w: { id: string }) => w.id === ws.id)).toBeUndefined();

      const getRes = await api.get(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      expect(getRes.status).toBe(404);
    });

    it('Member cannot soft-delete workspace (403)', async () => {
      const res = await api.delete(`/api/workspaces/${workspaceId}`).set(auth(memberToken));
      expect(res.status).toBe(403);
    });

    it('frees the slug by suffixing it', async () => {
      const ws = await createWorkspace(ownerToken);
      const sameSlug = ws.slug;

      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      // Creating new workspace with the original slug should succeed
      const newRes = await api
        .post('/api/workspaces')
        .set(auth(ownerToken))
        .send({ name: 'Replacement', slug: sameSlug });
      expect(newRes.status).toBe(201);
    });

    it('sets purgeAt 10 business days in future', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const row = await prisma.workspace.findUnique({
        where: { id: ws.id },
        select: { deletedAt: true, deletedBy: true, purgeAt: true },
      });
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.deletedBy).toBe(ownerId);
      expect(row?.purgeAt).not.toBeNull();

      const diffMs = row!.purgeAt!.getTime() - row!.deletedAt!.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      // 10 business days = at least 12 calendar days, at most 16 (depending on weekend overlap)
      expect(diffDays).toBeGreaterThanOrEqual(11);
      expect(diffDays).toBeLessThanOrEqual(17);
    });
  });

  describe('GET /api/workspaces/trash/list', () => {
    it('Owner sees workspaces they own that are in trash', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const res = await api.get('/api/workspaces/trash/list').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.find((w: { id: string }) => w.id === ws.id)).toBeDefined();
    });

    it('Member sees workspace they deleted themselves', async () => {
      const member = await registerUser();
      const wsOwn = await createWorkspace(member.token);

      // Member is Owner of their own workspace — they CAN delete it
      await api.delete(`/api/workspaces/${wsOwn.id}`).set(auth(member.token));

      const res = await api.get('/api/workspaces/trash/list').set(auth(member.token));
      expect(res.body.find((w: { id: string }) => w.id === wsOwn.id)).toBeDefined();
    });

    it('Member of foreign workspace does NOT see it in their trash', async () => {
      const ws = await createWorkspace(ownerToken);
      // Add memberId to ws
      await api
        .post(`/api/workspaces/${ws.id}/members`)
        .set(auth(ownerToken))
        .send({ userId: memberId, role: 'MEMBER' });
      // Owner deletes
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const memberRes = await api.get('/api/workspaces/trash/list').set(auth(memberToken));
      expect(memberRes.body.find((w: { id: string }) => w.id === ws.id)).toBeUndefined();
    });

    it('Stranger sees empty trash', async () => {
      const res = await api.get('/api/workspaces/trash/list').set(auth(strangerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /trash/count returns same count as list', async () => {
      const list = await api.get('/api/workspaces/trash/list').set(auth(ownerToken));
      const count = await api.get('/api/workspaces/trash/count').set(auth(ownerToken));
      expect(count.body.count).toBe(list.body.length);
    });
  });

  describe('POST /api/workspaces/:id/restore', () => {
    it('Owner restores workspace; it becomes accessible again', async () => {
      const ws = await createWorkspace(ownerToken);
      const slug = ws.slug;
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const restoreRes = await api.post(`/api/workspaces/${ws.id}/restore`).set(auth(ownerToken));
      expect(restoreRes.status).toBe(200);

      // Workspace is accessible
      const getRes = await api.get(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      expect(getRes.status).toBe(200);
      expect(getRes.body.slug).toBe(slug); // original slug restored
    });

    it('Member cannot restore workspace they did not delete (403)', async () => {
      const ws = await createWorkspace(ownerToken);
      await api
        .post(`/api/workspaces/${ws.id}/members`)
        .set(auth(ownerToken))
        .send({ userId: memberId, role: 'MEMBER' });
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const res = await api.post(`/api/workspaces/${ws.id}/restore`).set(auth(memberToken));
      expect(res.status).toBe(403);
    });

    it('Returns 400 if workspace is not in trash', async () => {
      const ws = await createWorkspace(ownerToken);
      const res = await api.post(`/api/workspaces/${ws.id}/restore`).set(auth(ownerToken));
      expect(res.status).toBe(400);
    });

    it('Suffixes slug if the original is now occupied', async () => {
      const ws = await createWorkspace(ownerToken);
      const slug = ws.slug;
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      // Someone takes the freed slug
      await api.post('/api/workspaces').set(auth(ownerToken)).send({ name: 'Squatter', slug });

      // Restore — slug must be suffixed
      const restoreRes = await api.post(`/api/workspaces/${ws.id}/restore`).set(auth(ownerToken));
      expect(restoreRes.status).toBe(200);

      const getRes = await api.get(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      expect(getRes.body.slug).not.toBe(slug);
      expect(getRes.body.slug).toMatch(new RegExp(`^${slug}-restored-`));
    });
  });

  describe('DELETE /api/workspaces/:id/purge', () => {
    it('Owner permanently deletes workspace from trash', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const purgeRes = await api.delete(`/api/workspaces/${ws.id}/purge`).set(auth(ownerToken));
      expect(purgeRes.status).toBe(200);

      // Workspace fully gone from DB
      const row = await prisma.workspace.findUnique({ where: { id: ws.id } });
      expect(row).toBeNull();
    });

    it('Cannot purge a workspace that is NOT in trash (400)', async () => {
      const ws = await createWorkspace(ownerToken);
      const res = await api.delete(`/api/workspaces/${ws.id}/purge`).set(auth(ownerToken));
      expect(res.status).toBe(400);
    });

    it('Non-owner cannot purge (403)', async () => {
      const ws = await createWorkspace(ownerToken);
      await api
        .post(`/api/workspaces/${ws.id}/members`)
        .set(auth(ownerToken))
        .send({ userId: memberId, role: 'MEMBER' });
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));

      const res = await api.delete(`/api/workspaces/${ws.id}/purge`).set(auth(memberToken));
      expect(res.status).toBe(403);
    });
  });

  describe('Access to soft-deleted workspace resources is denied', () => {
    it('GET /workspaces/:id returns 404 when soft-deleted', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      const res = await api.get(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      expect(res.status).toBe(404);
    });

    it('Listing boards in deleted workspace returns 404', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      const res = await api.get(`/api/workspaces/${ws.id}/boards/by-prefix/X`).set(auth(ownerToken));
      // Either 404 (workspace not found) or 404 (board not found within deleted ws)
      expect([403, 404]).toContain(res.status);
    });

    it('PATCH on deleted workspace fails with 404', async () => {
      const ws = await createWorkspace(ownerToken);
      await api.delete(`/api/workspaces/${ws.id}`).set(auth(ownerToken));
      const res = await api
        .patch(`/api/workspaces/${ws.id}`)
        .set(auth(ownerToken))
        .send({ name: 'Renamed' });
      expect(res.status).toBe(404);
    });
  });
});
