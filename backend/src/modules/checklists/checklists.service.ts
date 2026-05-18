import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateChecklistDto, CreateChecklistItemDto, UpdateChecklistItemDto } from './checklists.dto.js';

async function verifyTaskWrite(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { board: { include: { workspace: { select: { deletedAt: true } } } } },
  });
  if (!task) throw new AppError(404, 'Task not found');
  if (task.board.workspace.deletedAt !== null) throw new AppError(404, 'Task not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.board.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot modify checklists');
  return task;
}

async function verifyChecklistAccess(checklistId: string, userId: string) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { task: { include: { board: { include: { workspace: { select: { deletedAt: true } } } } } } },
  });
  if (!checklist) throw new AppError(404, 'Checklist not found');
  if (checklist.task.board.workspace.deletedAt !== null) throw new AppError(404, 'Checklist not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: checklist.task.board.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot modify checklists');
  return checklist;
}

// ─── Checklists CRUD ──────────────────────────────────────────────────────────

export async function createChecklist(taskId: string, userId: string, dto: CreateChecklistDto) {
  await verifyTaskWrite(taskId, userId);

  const maxOrder = await prisma.checklist.aggregate({ where: { taskId }, _max: { orderIndex: true } });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  return prisma.checklist.create({
    data: { taskId, title: dto.title, orderIndex },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });
}

export async function deleteChecklist(checklistId: string, userId: string) {
  await verifyChecklistAccess(checklistId, userId);
  await prisma.checklist.delete({ where: { id: checklistId } });
}

// ─── Checklist items ─────────────────────────────────────────────────────────

export async function createChecklistItem(checklistId: string, userId: string, dto: CreateChecklistItemDto) {
  await verifyChecklistAccess(checklistId, userId);

  const maxOrder = await prisma.checklistItem.aggregate({ where: { checklistId }, _max: { orderIndex: true } });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  return prisma.checklistItem.create({
    data: { checklistId, title: dto.title, orderIndex },
  });
}

export async function updateChecklistItem(itemId: string, userId: string, dto: UpdateChecklistItemDto) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError(404, 'Checklist item not found');

  await verifyChecklistAccess(item.checklistId, userId);

  return prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.isDone !== undefined && { isDone: dto.isDone }),
    },
  });
}

export async function deleteChecklistItem(itemId: string, userId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError(404, 'Checklist item not found');

  await verifyChecklistAccess(item.checklistId, userId);
  await prisma.checklistItem.delete({ where: { id: itemId } });
}
