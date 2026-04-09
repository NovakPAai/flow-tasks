/**
 * Helpers that call the backend API directly (no UI noise).
 * Used for test setup: create required data before the actual UI interaction.
 */

const API = 'http://localhost:3101/api';

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  const { accessToken } = await res.json();
  return accessToken as string;
}

async function authFetch(token: string, path: string, opts: RequestInit = {}): Promise<Response> {
  return apiFetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export async function getAdminToken(): Promise<string> {
  return login('admin@flowtask.dev', 'Password1');
}

export async function createWorkspace(
  token: string,
  name: string,
  slug: string,
  description?: string,
): Promise<{ id: string; slug: string; name: string }> {
  const res = await authFetch(token, '/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, slug, description }),
  });
  if (!res.ok) throw new Error(`createWorkspace failed: ${await res.text()}`);
  return res.json();
}

export async function createBoard(
  token: string,
  workspaceId: string,
  name: string,
  prefix: string,
): Promise<{ id: string; name: string }> {
  const res = await authFetch(token, `/workspaces/${workspaceId}/boards`, {
    method: 'POST',
    body: JSON.stringify({ name, prefix }),
  });
  if (!res.ok) throw new Error(`createBoard failed: ${await res.text()}`);
  return res.json();
}

export async function createTask(
  token: string,
  boardId: string,
  title: string,
  statusId: string,
): Promise<{ id: string; title: string; issueKey: string }> {
  const res = await authFetch(token, `/boards/${boardId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title, statusId }),
  });
  if (!res.ok) throw new Error(`createTask failed: ${await res.text()}`);
  return res.json();
}

export async function getWorkspace(
  token: string,
  id: string,
): Promise<{ id: string; slug: string; name: string; workflows: Array<{ statuses: Array<{ id: string; name: string }> }> }> {
  const res = await authFetch(token, `/workspaces/${id}`);
  if (!res.ok) throw new Error(`getWorkspace failed: ${await res.text()}`);
  return res.json();
}

export async function listWorkspaces(token: string): Promise<Array<{ id: string; slug: string; name: string }>> {
  const res = await authFetch(token, '/workspaces');
  if (!res.ok) throw new Error(`listWorkspaces failed: ${await res.text()}`);
  return res.json();
}

/** Unique suffix to avoid slug collisions between test runs */
export function uid(): string {
  return Math.random().toString(36).slice(2, 8);
}
