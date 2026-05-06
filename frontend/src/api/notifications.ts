import api from './client';

export interface MentionPayload {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  mentionedBy: { id: string; name: string };
  context: 'task' | 'comment';
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: MentionPayload;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unread: number;
}

export async function listNotifications(limit = 20, offset = 0): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/notifications', { params: { limit, offset } });
  return data;
}

export async function markRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
