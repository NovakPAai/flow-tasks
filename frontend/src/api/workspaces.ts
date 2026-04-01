import api from './client';
import type { Workspace, WorkspaceMember, WorkspaceEvent } from '../types';

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<Workspace[]>('/workspaces');
  return data;
}

export async function createWorkspace(payload: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Workspace> {
  const { data } = await api.post<Workspace>('/workspaces', payload);
  return data;
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const { data } = await api.get<Workspace>(`/workspaces/${id}`);
  return data;
}

export async function updateWorkspace(
  id: string,
  payload: { name?: string; description?: string },
): Promise<Workspace> {
  const { data } = await api.patch<Workspace>(`/workspaces/${id}`, payload);
  return data;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await api.delete(`/workspaces/${id}`);
}

export async function listMembers(id: string): Promise<WorkspaceMember[]> {
  const { data } = await api.get<WorkspaceMember[]>(`/workspaces/${id}/members`);
  return data;
}

export async function addMember(
  id: string,
  userId: string,
  role: 'OWNER' | 'MEMBER' | 'VIEWER' = 'MEMBER',
): Promise<WorkspaceMember> {
  const { data } = await api.post<WorkspaceMember>(`/workspaces/${id}/members`, { userId, role });
  return data;
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'MEMBER' | 'VIEWER',
): Promise<WorkspaceMember> {
  const { data } = await api.patch<WorkspaceMember>(`/workspaces/${workspaceId}/members/${userId}`, { role });
  return data;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
}

export async function inviteByEmail(
  workspaceId: string,
  email: string,
  role: 'OWNER' | 'MEMBER' | 'VIEWER' = 'MEMBER',
): Promise<WorkspaceMember> {
  const { data } = await api.post<WorkspaceMember>(`/workspaces/${workspaceId}/invite`, { email, role });
  return data;
}

export async function getWorkspaceHistory(workspaceId: string): Promise<WorkspaceEvent[]> {
  const { data } = await api.get<WorkspaceEvent[]>(`/workspaces/${workspaceId}/history`);
  return data;
}
