import supertest from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../prisma/client.js';
import { hashPassword } from '../shared/utils/password.js';

export const app = createApp();
export const api = supertest(app);

let _counter = 0;
export function uid() {
  return `t${Date.now()}${++_counter}`;
}

/** URL-safe slug: lowercase letters, digits, hyphens only */
export function slug() {
  return `ws-${Date.now()}-${++_counter}`;
}

/**
 * Creates a test user directly via Prisma (bypasses the approval-based registration flow)
 * and returns real JWT tokens via the login endpoint.
 */
export async function registerUser(overrides: { email?: string; name?: string; password?: string } = {}) {
  const email = overrides.email ?? `${uid()}@test.com`;
  const name  = overrides.name  ?? `User ${uid()}`;
  const password = overrides.password ?? 'Password1';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({ data: { email, name, password: passwordHash } });

  const loginRes = await api.post('/api/auth/login').send({ email, password });
  const rawCookies = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(rawCookies) ? rawCookies.join('; ') : (rawCookies ?? '');
  return {
    email,
    name,
    password,
    token: loginRes.body.accessToken as string,
    cookie, // HttpOnly refresh token cookie for use in subsequent requests
    userId: user.id,
  };
}

export async function loginUser(email: string, password: string) {
  const res = await api.post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createWorkspace(token: string, overrides: Record<string, unknown> = {}) {
  const wsSlug = slug();
  const res = await api
    .post('/api/workspaces')
    .set(auth(token))
    .send({ name: 'Test Workspace', slug: wsSlug, ...overrides });
  return res.body as { id: string; slug: string; name: string };
}

export async function createBoard(token: string, workspaceId: string, overrides: Record<string, unknown> = {}) {
  const prefix = `B${Math.floor(Math.random() * 9000) + 1000}`;
  const res = await api
    .post(`/api/workspaces/${workspaceId}/boards`)
    .set(auth(token))
    .send({ name: 'Test Board', prefix, ...overrides });
  return res.body as { id: string; prefix: string; workflowId: string };
}

export async function createTask(token: string, boardId: string, overrides: Record<string, unknown> = {}) {
  const res = await api
    .post(`/api/boards/${boardId}/tasks`)
    .set(auth(token))
    .send({ title: `Task ${uid()}`, ...overrides });
  return res.body as { id: string; issueKey: string; statusId: string };
}

/** Clean up all test data by email pattern */
export async function cleanupTestData() {
  // Delete workspaces created by test users first (no cascade from user → workspace)
  const testUsers = await prisma.user.findMany({ where: { email: { contains: '@test.com' } }, select: { id: true } });
  const ids = testUsers.map(u => u.id);
  if (ids.length > 0) {
    await prisma.workspace.deleteMany({ where: { creatorId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
}
