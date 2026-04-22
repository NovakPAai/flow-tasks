import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateBoardDto, UpdateBoardDto } from './boards.dto.js';

async function assertMember(workspaceId: string, userId: string) {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) throw new AppError(403, 'Access denied');
  return m;
}

async function assertOwner(workspaceId: string, userId: string) {
  const m = await assertMember(workspaceId, userId);
  if (m.role !== 'OWNER') throw new AppError(403, 'Only workspace owners can manage boards');
  return m;
}

export async function listBoards(workspaceId: string, userId: string) {
  const member = await assertMember(workspaceId, userId);
  // VIEWERs cannot see private boards
  const where = member.role === 'VIEWER'
    ? { workspaceId, isPrivate: false }
    : { workspaceId };
  return prisma.board.findMany({
    where,
    include: {
      workflow: { include: { statuses: { orderBy: { position: 'asc' } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createBoard(workspaceId: string, userId: string, dto: CreateBoardDto) {
  await assertOwner(workspaceId, userId);

  // Resolve workflowId — default to workspace default workflow
  let workflowId = dto.workflowId;
  if (!workflowId) {
    const defaultWf = await prisma.workflow.findFirst({
      where: { workspaceId, isDefault: true },
    });
    if (!defaultWf) throw new AppError(400, 'Workspace has no default workflow');
    workflowId = defaultWf.id;
  } else {
    const wf = await prisma.workflow.findFirst({ where: { id: workflowId, workspaceId } });
    if (!wf) throw new AppError(404, 'Workflow not found in this workspace');
  }

  const prefix = dto.prefix.toUpperCase();
  const existing = await prisma.board.findFirst({ where: { workspaceId, prefix } });
  if (existing) throw new AppError(409, `Prefix "${prefix}" already used in this workspace`);

  return prisma.board.create({
    data: { workspaceId, workflowId, name: dto.name, prefix, description: dto.description },
    include: {
      workflow: { include: { statuses: { orderBy: { position: 'asc' } } } },
    },
  });
}

export async function getBoard(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      workflow: {
        include: {
          statuses: { orderBy: { position: 'asc' } },
          transitions: true,
        },
      },
      tasks: {
        where: { parentId: null },
        orderBy: [{ statusId: 'asc' }, { orderIndex: 'asc' }],
        take: 100,
        include: {
          assignee: { select: { id: true, name: true, avatar: true } },
          _count: { select: { children: true } },
        },
      },
    },
  });
  if (!board) throw new AppError(404, 'Board not found');
  const member = await assertMember(board.workspaceId, userId);
  if (board.isPrivate && member.role === 'VIEWER') throw new AppError(403, 'This board is private');
  return board;
}

export async function updateBoard(boardId: string, userId: string, dto: UpdateBoardDto) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError(404, 'Board not found');
  await assertOwner(board.workspaceId, userId);

  if (dto.workflowId) {
    const wf = await prisma.workflow.findFirst({
      where: { id: dto.workflowId, workspaceId: board.workspaceId },
    });
    if (!wf) throw new AppError(404, 'Workflow not found in this workspace');
  }

  return prisma.board.update({ where: { id: boardId }, data: dto });
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError(404, 'Board not found');
  await assertOwner(board.workspaceId, userId);
  await prisma.board.delete({ where: { id: boardId } });
}
