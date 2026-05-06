import { prisma } from '../../prisma/client.js';

export interface MentionPayload {
  taskId: string;
  taskTitle: string;
  taskKey: string;
  mentionedBy: { id: string; name: string };
  context: 'task' | 'comment';
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
  authorId: string,
) {
  const userIds = extractMentionedUserIds(text);
  if (userIds.length === 0) return;
  const recipients = userIds;

  // Deduplicate
  const unique = [...new Set(recipients)];

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
