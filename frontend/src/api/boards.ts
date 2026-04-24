import api from './client';
import type { Board, Task } from '../types';

export async function listBoards(workspaceId: string): Promise<Board[]> {
  const { data } = await api.get<Board[]>(`/workspaces/${workspaceId}/boards`);
  return data;
}

export async function createBoard(workspaceId: string, payload: {
  name: string;
  prefix: string;
  description?: string;
  workflowId?: string;
}): Promise<Board> {
  const { data } = await api.post<Board>(`/workspaces/${workspaceId}/boards`, payload);
  return data;
}

export async function getBoard(boardId: string): Promise<Board> {
  const { data } = await api.get<Board>(`/boards/${boardId}`);
  return data;
}

export async function getBoardByPrefix(workspaceId: string, prefix: string): Promise<Board> {
  const { data } = await api.get<Board>(`/workspaces/${workspaceId}/boards/by-prefix/${prefix}`);
  return data;
}

export async function updateBoard(boardId: string, payload: { name?: string; description?: string; workflowId?: string; isPrivate?: boolean }): Promise<Board> {
  const { data } = await api.patch<Board>(`/boards/${boardId}`, payload);
  return data;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}

export async function getRoadmapTasks(boardId: string, from?: string, to?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  const { data } = await api.get<Task[]>(`/boards/${boardId}/roadmap${query ? `?${query}` : ''}`);
  return data;
}
