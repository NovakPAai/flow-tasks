import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
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

export async function listComments(taskId: string, userId: string) {
  // Verify read access (any member can read)
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { board: true } });
  if (!task) throw new AppError(404, 'Task not found');
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.board.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');

  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

export async function createComment(taskId: string, userId: string, dto: CreateCommentDto) {
  await verifyTaskAccess(taskId, userId);

  return prisma.comment.create({
    data: { taskId, authorId: userId, body: dto.body },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

export async function updateComment(commentId: string, userId: string, dto: UpdateCommentDto) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError(404, 'Comment not found');
  if (comment.authorId !== userId) throw new AppError(403, 'Only the author can edit this comment');

  return prisma.comment.update({
    where: { id: commentId },
    data: { body: dto.body },
    include: { author: { select: AUTHOR_SELECT } },
  });
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
