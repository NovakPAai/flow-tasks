import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateLabelDto, UpdateLabelDto } from './labels.dto.js';

async function getWorkspaceMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.workspace.deletedAt !== null) throw new AppError(404, 'Workspace not found');
  return member;
}

// ─── Workspace labels ─────────────────────────────────────────────────────────

export async function listLabels(workspaceId: string, userId: string) {
  await getWorkspaceMember(workspaceId, userId);
  return prisma.label.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function createLabel(workspaceId: string, userId: string, dto: CreateLabelDto) {
  const member = await getWorkspaceMember(workspaceId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot create labels');

  const existing = await prisma.label.findUnique({ where: { workspaceId_name: { workspaceId, name: dto.name } } });
  if (existing) throw new AppError(409, `Label "${dto.name}" already exists`);

  return prisma.label.create({
    data: { workspaceId, name: dto.name, color: dto.color },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function updateLabel(labelId: string, userId: string, dto: UpdateLabelDto) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new AppError(404, 'Label not found');

  const member = await getWorkspaceMember(label.workspaceId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot update labels');

  return prisma.label.update({
    where: { id: labelId },
    data: dto,
    include: { _count: { select: { tasks: true } } },
  });
}

export async function deleteLabel(labelId: string, userId: string) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new AppError(404, 'Label not found');

  const member = await getWorkspaceMember(label.workspaceId, userId);
  if (member.role !== 'OWNER') throw new AppError(403, 'Only owners can delete labels');

  await prisma.label.delete({ where: { id: labelId } });
}

// ─── Task label assignment ────────────────────────────────────────────────────

async function getTaskAndVerifyAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { board: true } });
  if (!task) throw new AppError(404, 'Task not found');

  const member = await getWorkspaceMember(task.board.workspaceId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot modify labels');
  return { task, workspaceId: task.board.workspaceId };
}

export async function addLabelToTask(taskId: string, labelId: string, userId: string) {
  const { workspaceId } = await getTaskAndVerifyAccess(taskId, userId);

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.workspaceId !== workspaceId) throw new AppError(400, 'Label not found in this workspace');

  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    create: { taskId, labelId },
    update: {},
  });

  return prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
    orderBy: { label: { name: 'asc' } },
  });
}

export async function removeLabelFromTask(taskId: string, labelId: string, userId: string) {
  await getTaskAndVerifyAccess(taskId, userId);

  await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });

  return prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
    orderBy: { label: { name: 'asc' } },
  });
}
