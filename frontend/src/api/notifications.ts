import api from './client';

export interface MentionPayload {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  mentionedBy: { id: string; name: string };
  context: 'task' | 'comment';
  workspaceSlug: string;
  boardSlug: string;
  body?: string;
}

export interface TaskAssignedPayload {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  workspaceSlug: string;
  boardSlug: string;
  actor: { id: string; name: string };
}

export interface CommentAddedPayload {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  workspaceSlug: string;
  boardSlug: string;
  actor: { id: string; name: string };
}

export interface MemberAddedPayload {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  actor: { id: string; name: string };
}

export type NotificationType = 'mention' | 'task_assigned' | 'comment_added' | 'member_added';
export type NotificationPayload = MentionPayload | TaskAssignedPayload | CommentAddedPayload | MemberAddedPayload;

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: NotificationPayload;
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
