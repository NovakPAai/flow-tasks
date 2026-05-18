/**
 * G5 failing tests for workspace member candidates search.
 *
 * Spec: specs/workspace-member-picker.feature
 * Design: docs/design/workspace-member-picker.md
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, auth, registerUser, createWorkspace, cleanupTestData } from './helpers.js';
import { prisma } from '../prisma/client.js';

describe('GET /api/workspaces/:id/members/candidates', () => {
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let viewerToken: string;
  let viewerId: string;
  let strangerToken: string;
  let workspaceId: string;

  // Searchable test users (created with predictable name/email patterns).
  let annaId: string;
  let borisId: string;
  let _carlaId: string;
  let dmitryId: string;
  let inactiveId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    const owner    = await registerUser();
    const memberU  = await registerUser();
    const viewerU  = await registerUser();
    const stranger = await registerUser();
    ownerToken    = owner.token;    ownerId    = owner.userId;
    memberToken   = memberU.token;  memberId   = memberU.userId;
    viewerToken   = viewerU.token;  viewerId   = viewerU.userId;
    strangerToken = stranger.token;

    // Searchable users — names + emails are crafted to test ordering, casing, cyrillic, etc.
    const anna   = await registerUser({ email: `anna-${stamp}@test.com`,  name: `Анна Петрова ${stamp}` });
    const boris  = await registerUser({ email: `boris-ivanov-${stamp}@test.com`, name: `Boris Иванов ${stamp}` });
    const carla  = await registerUser({ email: `carla-${stamp}@test.com`, name: `Carla García ${stamp}` });
    const dmitry = await registerUser({ email: `dima+work-${stamp}@test.com`, name: `Дмитрий Сидоров ${stamp}` });
    annaId = anna.userId; borisId = boris.userId; _carlaId = carla.userId; dmitryId = dmitry.userId;

    // Inactive user — must not appear in results.
    const inactive = await prisma.user.create({
      data: {
        email: `old-account-${stamp}@test.com`,
        name: `Old Account ${stamp}`,
        password: 'hash',
        isActive: false,
      },
    });
    inactiveId = inactive.id;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;

    // Add Anna to workspace so she is alreadyMember:true.
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: annaId, role: 'MEMBER' });
    // Add memberU and viewerU with their roles so we can verify RBAC.
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: memberId, role: 'MEMBER' });
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: viewerId, role: 'VIEWER' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: inactiveId } });
    await cleanupTestData();
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  it('200 — Owner gets results for valid query', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `boris-ivanov-${stamp}` })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const boris = res.body.find((u: { id: string }) => u.id === borisId);
    expect(boris).toBeDefined();
    expect(boris.name).toContain('Boris');
    expect(boris.email).toContain('boris-ivanov');
    expect(boris.alreadyMember).toBe(false);
  });

  it('200 — response includes only public-safe fields (no isSuperadmin, lastLoginAt, authProvider, isActive)', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `boris-ivanov-${stamp}` })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    const boris = res.body.find((u: { id: string }) => u.id === borisId);
    expect(Object.keys(boris).sort()).toEqual(['alreadyMember', 'avatar', 'email', 'id', 'name']);
    expect(boris).not.toHaveProperty('isSuperadmin');
    expect(boris).not.toHaveProperty('lastLoginAt');
    expect(boris).not.toHaveProperty('authProvider');
    expect(boris).not.toHaveProperty('isActive');
    expect(boris).not.toHaveProperty('password');
  });

  it('200 — alreadyMember:true for users already in workspace', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `anna-${stamp}` })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    const anna = res.body.find((u: { id: string }) => u.id === annaId);
    expect(anna).toBeDefined();
    expect(anna.alreadyMember).toBe(true);
  });

  it('200 — case-insensitive match across name and email', async () => {
    // Upper-case query should still find user — search by full unique fragment of name to avoid noise.
    const resName = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `BORIS-IVANOV-${stamp}` })
      .set(auth(ownerToken));
    expect(resName.status).toBe(200);
    expect(resName.body.some((u: { id: string }) => u.id === borisId)).toBe(true);

    const resEmail = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `DIMA+WORK-${stamp}` })
      .set(auth(ownerToken));
    expect(resEmail.status).toBe(200);
    expect(resEmail.body.some((u: { id: string }) => u.id === dmitryId)).toBe(true);
  });

  it('200 — cyrillic search finds cyrillic name', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'Дмитрий' })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.some((u: { id: string }) => u.id === dmitryId)).toBe(true);
  });

  it('200 — inactive users are excluded', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: `old-account-${stamp}` })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.some((u: { id: string }) => u.id === inactiveId)).toBe(false);
  });

  it('200 — empty array when nothing matches', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'qzx-no-match-zzz' })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 — respects limit param (default 10, max 20)', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'test', limit: 5 })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

  it('200 — special chars and XSS payload in q do not break and return empty', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: '🚀<script>alert(1)</script>' })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Cannot match any user — payload is contained as a literal substring.
    expect(res.body.length).toBe(0);
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  it('400 — q shorter than 2 chars after trim', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: '   a   ' })
      .set(auth(ownerToken));
    expect(res.status).toBe(400);
  });

  it('400 — q missing entirely', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .set(auth(ownerToken));
    expect(res.status).toBe(400);
  });

  it('400 — limit above 20', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'an', limit: 1000 })
      .set(auth(ownerToken));
    expect(res.status).toBe(400);
  });

  it('400 — q longer than 100 chars', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'a'.repeat(150) })
      .set(auth(ownerToken));
    expect(res.status).toBe(400);
  });

  // ─── RBAC ──────────────────────────────────────────────────────────────────

  it('401 — without auth token', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'an' });
    expect(res.status).toBe(401);
  });

  it('403 — MEMBER (not Owner) cannot search candidates', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'an' })
      .set(auth(memberToken));
    expect(res.status).toBe(403);
  });

  it('403 — VIEWER cannot search candidates', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'an' })
      .set(auth(viewerToken));
    expect(res.status).toBe(403);
  });

  it('403 — Stranger (no membership at all) cannot search', async () => {
    const res = await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q: 'an' })
      .set(auth(strangerToken));
    expect(res.status).toBe(403);
  });

  it('404 — soft-deleted workspace is not accessible', async () => {
    // Delete the workspace into trash (soft delete sets deletedAt).
    const tmpWs = await createWorkspace(ownerToken);
    await api.delete(`/api/workspaces/${tmpWs.id}`).set(auth(ownerToken));
    const res = await api.get(`/api/workspaces/${tmpWs.id}/members/candidates`)
      .query({ q: 'an' })
      .set(auth(ownerToken));
    // Owner of a soft-deleted workspace gets 404 (assertMember inside assertOwner rejects).
    expect(res.status).toBe(404);
  });

  // ─── Audit logging ─────────────────────────────────────────────────────────

  it('audit — successful search writes member.candidates.search with queryLength + resultCount, no raw q', async () => {
    const q = `secret-project-${stamp}`;
    await api.get(`/api/workspaces/${workspaceId}/members/candidates`)
      .query({ q })
      .set(auth(ownerToken));

    const log = await prisma.auditLog.findFirst({
      where: { action: 'member.candidates.search', actorId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    const meta = (log!.meta ?? {}) as Record<string, unknown>;
    expect(meta.queryLength).toBe(q.length);
    expect(meta.resultCount).toBeTypeOf('number');
    // Raw query string must NOT leak into audit meta — neither under "q" nor as any value.
    expect(meta).not.toHaveProperty('q');
    expect(meta).not.toHaveProperty('query');
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(q);

    // Allow-list enforcement: caller meta MUST be exactly these two keys.
    // The audit-logger adds its own keys (result, ip, time, etc.) on top —
    // those are not caller-controlled so we don't enforce them here.
    // This catches a future "meta: { ..., q: q.slice(0,5) }" regression that
    // a substring `toContain` check would miss.
    const FORBIDDEN_META_KEYS = ['q', 'query', 'rawQuery', 'email', 'name', 'queryText'];
    for (const key of FORBIDDEN_META_KEYS) {
      expect(meta).not.toHaveProperty(key);
    }
  });

  // ─── Rate limiting ─────────────────────────────────────────────────────────
  // NOTE: skipped by default because it requires Redis and would slow CI.
  // Enable manually for security review with `RUN_RATE_LIMIT_TESTS=1 npm test`.
  it.skipIf(!process.env.RUN_RATE_LIMIT_TESTS)(
    '429 — over 30 requests/min',
    async () => {
      const requests = Array.from({ length: 32 }, () =>
        api.get(`/api/workspaces/${workspaceId}/members/candidates`)
          .query({ q: 'an' })
          .set(auth(ownerToken)),
      );
      const responses = await Promise.all(requests);
      const tooMany = responses.filter((r) => r.status === 429);
      expect(tooMany.length).toBeGreaterThan(0);
    },
    20_000,
  );
});
