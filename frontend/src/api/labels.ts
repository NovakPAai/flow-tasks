import api from './client';
import type { Label, TaskLabel } from '../types';

export async function listLabels(workspaceId: string): Promise<Label[]> {
  const { data } = await api.get<Label[]>(`/workspaces/${workspaceId}/labels`);
  return data;
}

export async function createLabel(workspaceId: string, payload: { name: string; color: string }): Promise<Label> {
  const { data } = await api.post<Label>(`/workspaces/${workspaceId}/labels`, payload);
  return data;
}

export async function updateLabel(labelId: string, payload: { name?: string; color?: string }): Promise<Label> {
  const { data } = await api.patch<Label>(`/labels/${labelId}`, payload);
  return data;
}

export async function deleteLabel(labelId: string): Promise<void> {
  await api.delete(`/labels/${labelId}`);
}

export async function addLabelToTask(taskId: string, labelId: string): Promise<TaskLabel[]> {
  const { data } = await api.post<TaskLabel[]>(`/tasks/${taskId}/labels/${labelId}`);
  return data;
}

export async function removeLabelFromTask(taskId: string, labelId: string): Promise<TaskLabel[]> {
  const { data } = await api.delete<TaskLabel[]>(`/tasks/${taskId}/labels/${labelId}`);
  return data;
}
