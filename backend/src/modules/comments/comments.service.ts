import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { emitMentionNotifications, emitCommentNotification } from '../notifications/notifications.service.js';
import type { CreateCommentDto, UpdateCommentDto } from './comments.dto.js';

const AUTHOR_SELECT = { id: true, name: true, avatar: true } as const;

async function verifyTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { board: true } });
  if (!task) throw new AppError(404, 'Task not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.board.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot comment');
  return member;
}

export async function listComments(
  taskId: string,
  userId: string,
  limit = 50,
  offset = 0,
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { board: true } });
  if (!task) throw new AppError(404, 'Task not found');
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.board.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');

  const where = { taskId };
  const [comments, total] = await prisma.$transaction([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      include: { author: { select: AUTHOR_SELECT } },
    }),
    prisma.comment.count({ where }),
  ]);
  return { comments, total };
}

export async function createComment(taskId: string, userId: string, dto: CreateCommentDto) {
  await verifyTaskAccess(taskId, userId);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      title: true, issueKey: true,
      board: { select: { prefix: true, workspace: { select: { slug: true } } } },
    },
  });
  const author = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });

  const comment = await prisma.comment.create({
    data: { taskId, authorId: userId, body: dto.body },
    include: { author: { select: AUTHOR_SELECT } },
  });

  await emitMentionNotifications(dto.body, {
    taskId,
    taskTitle: task.title,
    taskKey: task.issueKey,
    mentionedBy: author,
    context: 'comment',
    workspaceSlug: task.board.workspace.slug,
    boardSlug: task.board.prefix.toLowerCase(),
  }, userId);

  emitCommentNotification(taskId, userId).catch(() => {});

  return comment;
}

export async function updateComment(commentId: string, userId: string, dto: UpdateCommentDto) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError(404, 'Comment not found');
  if (comment.authorId !== userId) throw new AppError(403, 'Only the author can edit this comment');

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: dto.body },
    include: { author: { select: AUTHOR_SELECT } },
  });

  // Emit notifications for newly added mentions (re-emit all — dedup by context is acceptable at this scale)
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: comment.taskId },
    select: {
      title: true, issueKey: true,
      board: { select: { prefix: true, workspace: { select: { slug: true } } } },
    },
  });
  const author = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });
  await emitMentionNotifications(dto.body, {
    taskId: comment.taskId,
    taskTitle: task.title,
    taskKey: task.issueKey,
    mentionedBy: author,
    context: 'comment',
    workspaceSlug: task.board.workspace.slug,
    boardSlug: task.board.prefix.toLowerCase(),
  }, userId);

  return updated;
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: { include: { board: true } } },
  });
  if (!comment) throw new AppError(404, 'Comment not found');

  // Author or workspace owner can delete
  if (comment.authorId !== userId) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: comment.task.board.workspaceId, userId } },
    });
    if (!member || member.role !== 'OWNER') throw new AppError(403, 'Not authorised to delete this comment');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}
