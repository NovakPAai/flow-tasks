import api from './client';
import type { Board } from '../types';

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

export async function updateBoard(boardId: string, payload: { name?: string; description?: string; workflowId?: string; isPrivate?: boolean }): Promise<Board> {
  const { data } = await api.patch<Board>(`/boards/${boardId}`, payload);
  return data;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}
