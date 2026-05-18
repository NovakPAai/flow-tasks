import api from './client';
import type { Task, TaskHistory } from '../types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  statusId?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  assigneeId?: string;
  parentId?: string;
}

export async function listTasks(boardId: string, params?: Record<string, string>): Promise<{ tasks: Task[]; total: number }> {
  const { data } = await api.get<{ tasks: Task[]; total: number }>(`/boards/${boardId}/tasks`, { params });
  return data;
}

export async function createTask(boardId: string, payload: CreateTaskPayload): Promise<Task> {
  const { data } = await api.post<Task>(`/boards/${boardId}/tasks`, payload);
  return data;
}

export async function getTask(taskId: string): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${taskId}`);
  return data;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  parentId?: string | null;
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${taskId}`, payload);
  return data;
}

export async function moveTask(taskId: string, statusId: string): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/move`, { statusId });
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}

export async function reorderTasks(boardId: string, updates: {
  id: string;
  statusId: string;
  orderIndex: number;
}[]): Promise<void> {
  await api.patch(`/boards/${boardId}/tasks/reorder`, { updates });
}

export interface MyTask extends Task {
  board: {
    id: string;
    name: string;
    prefix: string;
    workspace: { id: string; name: string; slug: string };
  };
}

export async function getSubtree(taskId: string): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/tasks/${taskId}/subtree`);
  return data;
}

export async function getTaskHistory(taskId: string): Promise<TaskHistory[]> {
  const { data } = await api.get<TaskHistory[]>(`/tasks/${taskId}/history`);
  return data;
}

export interface BulkUpdatePayload {
  ids: string[];
  patch: {
    statusId?: string;
    assigneeId?: string | null;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  };
}

export async function bulkUpdateTasks(boardId: string, payload: BulkUpdatePayload): Promise<{ updated: number }> {
  const { data } = await api.patch<{ updated: number }>(`/boards/${boardId}/tasks/bulk`, payload);
  return data;
}

export async function bulkDeleteTasks(boardId: string, ids: string[]): Promise<{ deleted: number }> {
  const { data } = await api.post<{ deleted: number }>(`/boards/${boardId}/tasks/bulk-delete`, { ids });
  return data;
}

export async function listMyTasks(params?: {
  priority?: string;
  duePreset?: string;
  search?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: MyTask[]; total: number }> {
  const { data } = await api.get<{ tasks: MyTask[]; total: number }>('/my-tasks', { params });
  return data;
}
