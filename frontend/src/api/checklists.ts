import api from './client';
import type { Checklist, ChecklistItem } from '../types';

export async function createChecklist(taskId: string, title: string): Promise<Checklist> {
  const { data } = await api.post<Checklist>(`/tasks/${taskId}/checklists`, { title });
  return data;
}

export async function deleteChecklist(checklistId: string): Promise<void> {
  await api.delete(`/checklists/${checklistId}`);
}

export async function createChecklistItem(checklistId: string, title: string): Promise<ChecklistItem> {
  const { data } = await api.post<ChecklistItem>(`/checklists/${checklistId}/items`, { title });
  return data;
}

export async function updateChecklistItem(
  itemId: string,
  payload: { title?: string; isDone?: boolean },
): Promise<ChecklistItem> {
  const { data } = await api.patch<ChecklistItem>(`/checklist-items/${itemId}`, payload);
  return data;
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  await api.delete(`/checklist-items/${itemId}`);
}
