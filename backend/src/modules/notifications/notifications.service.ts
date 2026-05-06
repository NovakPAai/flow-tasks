import { prisma } from '../../prisma/client.js';
import { sendNotificationEmail } from '../../shared/utils/email.js';
import { escapeHtml, sanitizeEmailHeader } from '../../shared/utils/sanitize.js';
import { config } from '../../config.js';
import { logger } from '../../shared/utils/logger.js';

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

// Extract user IDs from mention markers: @[Display Name](userId)
const MENTION_RE = /@\[[^\]]*\]\(([a-f0-9-]{36})\)/g;

export function extractMentionedUserIds(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(MENTION_RE)].map((m) => m[1]);
}

export async function emitMentionNotifications(
  text: string | null | undefined,
  payload: MentionPayload,
  authorId?: string,
) {
  const userIds = extractMentionedUserIds(text);
  if (userIds.length === 0) return;

  // Deduplicate; optionally exclude author (pass authorId to suppress self-notifications)
  const unique = [...new Set(authorId ? userIds.filter((id) => id !== authorId) : userIds)];

  // Verify users exist (avoid FK violation on stale mentions)
  const existing = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((u) => u.id));

  await prisma.notification.createMany({
    data: unique
      .filter((id) => validIds.has(id))
      .map((userId) => ({
        userId,
        type: 'mention',
        payload: payload as object,
      })),
    skipDuplicates: false,
  });
}

export async function listNotifications(userId: string, limit = 20, offset = 0) {
  const [items, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unread };
}

export async function markRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ─── Trigger emitters ─────────────────────────────────────────────────────────

export async function emitTaskAssignedNotification(
  taskId: string,
  assigneeId: string,
  actorId: string,
): Promise<void> {
  if (assigneeId === actorId) return;

  const [task, actor] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true, issueKey: true,
        board: { select: { prefix: true, workspace: { select: { slug: true } } } },
      },
    }),
    prisma.user.findUnique({ where: { id: actorId }, select: { id: true, name: true } }),
  ]);
  if (!task || !actor) return;

  const payload = {
    taskId,
    taskTitle: task.title,
    taskKey: task.issueKey,
    workspaceSlug: task.board.workspace.slug,
    boardSlug: task.board.prefix.toLowerCase(),
    actor,
  };

  await prisma.notification.create({
    data: { userId: assigneeId, type: 'task_assigned', payload: payload as object },
  });

  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { email: true, emailNotifications: true },
  });
  if (assignee?.emailNotifications) {
    const url = `${config.APP_URL}/w/${task.board.workspace.slug}/boards/${task.board.prefix.toLowerCase()}`;
    void sendNotificationEmail(
      assignee.email,
      sanitizeEmailHeader(`Задача назначена: ${task.issueKey}`),
      `<p><b>${escapeHtml(actor.name)}</b> назначил(а) вас на задачу <a href="${url}">${task.issueKey}: ${escapeHtml(task.title)}</a></p>`,
      `${actor.name} назначил(а) вас на задачу ${task.issueKey}: ${task.title}`,
    ).catch((err) => logger.warn('notification_email_failed', { type: 'task_assigned', error: String(err) }));
  }
}

export async function emitCommentNotification(
  taskId: string,
  authorId: string,
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true, issueKey: true, creatorId: true, assigneeId: true,
      board: { select: { prefix: true, workspace: { select: { slug: true } } } },
    },
  });
  if (!task) return;

  const recipients = new Set<string>();
  if (task.assigneeId && task.assigneeId !== authorId) recipients.add(task.assigneeId);
  if (task.creatorId !== authorId) recipients.add(task.creatorId);
  if (recipients.size === 0) return;

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true, name: true },
  });
  if (!author) return;

  const payload = {
    taskId,
    taskTitle: task.title,
    taskKey: task.issueKey,
    workspaceSlug: task.board.workspace.slug,
    boardSlug: task.board.prefix.toLowerCase(),
    actor: author,
  };

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      type: 'comment_added',
      payload: payload as object,
    })),
    skipDuplicates: false,
  });

  const recipientUsers = await prisma.user.findMany({
    where: { id: { in: [...recipients] }, emailNotifications: true },
    select: { email: true },
  });
  const url = `${config.APP_URL}/w/${task.board.workspace.slug}/boards/${task.board.prefix.toLowerCase()}`;
  for (const u of recipientUsers) {
    void sendNotificationEmail(
      u.email,
      sanitizeEmailHeader(`Новый комментарий: ${task.issueKey}`),
      `<p><b>${escapeHtml(author.name)}</b> прокомментировал(а) задачу <a href="${url}">${task.issueKey}: ${escapeHtml(task.title)}</a></p>`,
      `${author.name} прокомментировал(а) задачу ${task.issueKey}: ${task.title}`,
    ).catch((err) => logger.warn('notification_email_failed', { type: 'comment_added', error: String(err) }));
  }
}

export async function emitMemberAddedNotification(
  workspaceId: string,
  addedUserId: string,
  actorId: string,
): Promise<void> {
  const [workspace, actor] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, slug: true } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { id: true, name: true } }),
  ]);
  if (!workspace || !actor) return;

  const payload = {
    workspaceId,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    actor,
  };

  await prisma.notification.create({
    data: { userId: addedUserId, type: 'member_added', payload: payload as object },
  });

  const addedUser = await prisma.user.findUnique({
    where: { id: addedUserId },
    select: { email: true, emailNotifications: true },
  });
  if (addedUser?.emailNotifications) {
    void sendNotificationEmail(
      addedUser.email,
      sanitizeEmailHeader(`Вас добавили в воркспейс ${workspace.name}`),
      `<p><b>${escapeHtml(actor.name)}</b> добавил(а) вас в воркспейс <b>${escapeHtml(workspace.name)}</b></p>`,
      `${actor.name} добавил(а) вас в воркспейс ${workspace.name}`,
    ).catch((err) => logger.warn('notification_email_failed', { type: 'member_added', error: String(err) }));
  }
}
