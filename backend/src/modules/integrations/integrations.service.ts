import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export async function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, label: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(userId: string, label: string) {
  const raw = `ft_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
  const keyPrefix = raw.slice(0, 12); // safe prefix for display only, never stored in full
  const apiKey = await prisma.apiKey.create({
    data: { userId, keyHash, keyPrefix, label },
    select: { id: true, label: true, keyPrefix: true, createdAt: true },
  });
  // Raw key returned once — never persisted after this point
  return { ...apiKey, key: raw };
}

export async function deleteApiKey(userId: string, keyId: string) {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== userId) throw new AppError(404, 'API key not found');
  await prisma.apiKey.delete({ where: { id: keyId } });
}

export async function getWorkspacesForIntegration(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => m.workspace);
}

const PULSAR_LABEL = { name: 'Pulsar', color: '#4F6EF7' } as const;

export async function attachPulsarLabel(taskId: string, workspaceId: string, userId: string): Promise<void> {
  // Verify task belongs to workspaceId AND requesting user is a workspace member (IDOR guard)
  const [task, member] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, board: { workspaceId } }, select: { id: true } }),
    prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
  ]);
  if (!task) throw new AppError(404, 'Task not found');
  if (!member) throw new AppError(403, 'Access denied');

  const label = await prisma.label.upsert({
    where: { workspaceId_name: { workspaceId, name: PULSAR_LABEL.name } },
    create: { workspaceId, name: PULSAR_LABEL.name, color: PULSAR_LABEL.color },
    update: {},
  });
  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId: label.id } },
    create: { taskId, labelId: label.id },
    update: {},
  });
}

export async function getBoardsForIntegration(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');

  return prisma.board.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      prefix: true,
      workflow: {
        select: {
          statuses: {
            select: { id: true, name: true, color: true, category: true, position: true },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}
