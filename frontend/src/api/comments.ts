import api from './client';
import type { Comment } from '../types';

export async function listComments(taskId: string): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
  return data;
}

export async function createComment(taskId: string, body: string): Promise<Comment> {
  const { data } = await api.post<Comment>(`/tasks/${taskId}/comments`, { body });
  return data;
}

export async function updateComment(commentId: string, body: string): Promise<Comment> {
  const { data } = await api.patch<Comment>(`/comments/${commentId}`, { body });
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
