import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { logEvent } from '../workspaces/workspaces.service.js';
import type { CreateBoardDto, UpdateBoardDto } from './boards.dto.js';

// Max allowed roadmap date range to prevent full-table scans
const MAX_ROADMAP_RANGE_DAYS = 730;

function parseIsoDate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(s)) {
    throw new AppError(400, 'Invalid date parameter');
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new AppError(400, 'Invalid date parameter');
  return d;
}

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

  const board = await prisma.board.create({
    data: { workspaceId, workflowId, name: dto.name, prefix, description: dto.description },
    include: {
      workflow: { include: { statuses: { orderBy: { position: 'asc' } } } },
    },
  });

  logEvent(workspaceId, userId, 'board_created', 'board', board.id, { name: dto.name, prefix })
    .catch(err => console.error('audit log failed (board_created):', err));

  return board;
}

export async function getBoardByPrefix(workspaceId: string, prefix: string, userId: string) {
  if (!/^[A-Z0-9_-]{1,20}$/.test(prefix.toUpperCase())) throw new AppError(400, 'Invalid board prefix');
  await assertMember(workspaceId, userId);
  const board = await prisma.board.findFirst({
    where: { workspaceId, prefix: prefix.toUpperCase() },
  });
  if (!board) throw new AppError(404, 'Board not found');
  return getBoard(board.id, userId);
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
        take: 100, // pagination not yet supported — 100 task cap
        include: {
          assignee: { select: { id: true, name: true, avatar: true } },
          status: { select: { id: true, name: true, color: true, category: true } },
          labels: { include: { label: { select: { id: true, name: true, color: true } } } },
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

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: {
      name:        dto.name,
      description: dto.description,
      workflowId:  dto.workflowId,
      isPrivate:   dto.isPrivate,
    },
  });

  const meta: Record<string, unknown> = {};
  if (dto.name !== undefined && dto.name !== board.name) meta.nameFrom = board.name;
  if (dto.name !== undefined) meta.nameTo = dto.name;
  if (dto.workflowId !== undefined && dto.workflowId !== board.workflowId) meta.workflowChanged = true;
  logEvent(board.workspaceId, userId, 'board_updated', 'board', boardId, { boardName: board.name, ...meta })
    .catch(err => console.error('audit log failed (board_updated):', err));

  return updated;
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError(404, 'Board not found');
  await assertOwner(board.workspaceId, userId);
  await prisma.board.delete({ where: { id: boardId } });
  logEvent(board.workspaceId, userId, 'board_deleted', 'board', boardId, { name: board.name })
    .catch(err => console.error('audit log failed (board_deleted):', err));
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
export async function getRoadmapTasks(boardId: string, userId: string, from?: string, to?: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError(404, 'Board not found');
  const member = await assertMember(board.workspaceId, userId);
  if (board.isPrivate && member.role === 'VIEWER') throw new AppError(403, 'This board is private');

  const fromDate = from ? parseIsoDate(from) : new Date(new Date().getFullYear(), 0, 1);
  const toDate   = to   ? parseIsoDate(to)   : new Date(new Date().getFullYear() + 1, 0, 1);

  if (toDate < fromDate) {
    throw new AppError(400, 'to must not be before from');
  }
  if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > MAX_ROADMAP_RANGE_DAYS) {
    throw new AppError(400, 'Date range too large (max 2 years)');
  }

  const MAX_RANGE_DAYS = 730;
  if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new AppError(400, 'Date range too large (max 2 years)');
  }

  const taskInclude = {
    status:        { select: { id: true, name: true, color: true, category: true } },
    assignee:      { select: { id: true, name: true, avatar: true } },
    _count:        { select: { children: true } },
    statusHistory: { orderBy: { startedAt: 'asc' as const }, select: { id: true, statusId: true, startedAt: true, endedAt: true } },
  } as const;

  const dateInRange = {
    OR: [
      { startDate: { gte: fromDate, lte: toDate } },
      { dueDate:   { gte: fromDate, lte: toDate } },
      { startDate: { lte: fromDate }, dueDate: { gte: toDate } },
    ],
  };

  return prisma.task.findMany({
    where: {
      boardId,
      parentId: null,
      OR: [
        dateInRange,
        { children: { some: dateInRange } },
      ],
    },
    include: {
      ...taskInclude,
      children: {
        include: taskInclude,
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { orderIndex: 'asc' },
  });
}
