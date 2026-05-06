import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { emitMentionNotifications, emitTaskAssignedNotification } from '../notifications/notifications.service.js';
import type { CreateTaskDto, UpdateTaskDto, TaskFiltersDto, MyTasksFiltersDto } from './tasks.dto.js';
import type { Prisma } from '@prisma/client';

// ─── Access helpers ───────────────────────────────────────────────────────────

async function getBoardWithAccess(boardId: string, userId: string) {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      workspace: { members: { some: { userId } } },
    },
    include: { workflow: { include: { statuses: { orderBy: { position: 'asc' } }, transitions: true } } },
  });
  if (!board) throw new AppError(404, 'Board not found or access denied');

  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
  });
  return { board, member };
}

async function getTaskWithAccess(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      board: { workspace: { members: { some: { userId } } } },
    },
    include: { board: true },
  });
  if (!task) throw new AppError(404, 'Task not found or access denied');

  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId: task.board.workspaceId, userId } },
  });
  return { task, member };
}

// ─── Issue key generation ─────────────────────────────────────────────────────

async function generateIssueKey(boardId: string): Promise<{ issueKey: string; issueNumber: number }> {
  // Retry loop: if another process already used this issueKey (P2002 unique violation),
  // skip forward by incrementing nextNumber again rather than returning a 500.
  for (let attempt = 0; attempt < 10; attempt++) {
    const board = await prisma.board.update({
      where: { id: boardId },
      data: { nextNumber: { increment: 1 } },
      select: { prefix: true, nextNumber: true },
    });
    const issueNumber = board.nextNumber - 1;
    const issueKey = `${board.prefix}-${issueNumber}`;
    // Check if this key is already taken (can happen in tests or after data migration)
    const existing = await prisma.task.findUnique({ where: { issueKey }, select: { id: true } });
    if (!existing) return { issueKey, issueNumber };
  }
  throw new AppError(500, 'Could not generate unique issue key after 10 attempts');
}

// ─── Depth limit ─────────────────────────────────────────────────────────────

const MAX_SUBTASK_DEPTH = 5; // tasks at depth 0-4 allowed; depth 5 is rejected

// ─── Materialized path helpers ────────────────────────────────────────────────

async function buildPath(parentId: string | null | undefined): Promise<{ path: string; depth: number }> {
  if (!parentId) return { path: '/', depth: 0 };

  const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { path: true, depth: true } });
  if (!parent) throw new AppError(404, 'Parent task not found');

  return {
    path: `${parent.path}${parentId}/`,
    depth: parent.depth + 1,
  };
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

function buildDueDateFilter(preset: string | undefined): Prisma.TaskWhereInput {
  if (!preset) return {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeekStart = new Date(today); nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  switch (preset) {
    case 'today':     return { dueDate: { gte: today, lt: tomorrow } };
    case 'this_week': return { dueDate: { gte: today, lt: nextWeekStart } };
    case 'next_week': return { dueDate: { gte: nextWeekStart, lt: nextWeekEnd } };
    case 'overdue':   return { dueDate: { lt: today } };
    case 'no_date':   return { dueDate: null };
    default: return {};
  }
}

// ─── List tasks ───────────────────────────────────────────────────────────────

export async function listTasks(boardId: string, userId: string, filters: TaskFiltersDto) {
  await getBoardWithAccess(boardId, userId);

  const where: Prisma.TaskWhereInput = {
    boardId,
    ...(filters.statusId && { statusId: filters.statusId }),
    ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.labelId && { labels: { some: { labelId: filters.labelId } } }),
    ...(filters.search && { title: { contains: filters.search, mode: 'insensitive' } }),
    ...buildDueDateFilter(filters.duePreset),
  };

  // parentId filter: null = root tasks only, undefined = all, uuid = specific parent
  if (filters.rootOnly) {
    where.parentId = null;
  } else if (filters.parentId === null) {
    where.parentId = null;
  } else if (filters.parentId) {
    where.parentId = filters.parentId;
  }

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [{ statusId: 'asc' }, { orderIndex: 'asc' }],
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
      omit: { assigneeId: true },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        status: { select: { id: true, name: true, color: true, category: true } },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
        _count: { select: { children: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
}

// ─── Create task ──────────────────────────────────────────────────────────────

export async function createTask(boardId: string, userId: string, dto: CreateTaskDto) {
  const { board } = await getBoardWithAccess(boardId, userId);

  // Resolve statusId — default to first status
  let statusId = dto.statusId;
  if (!statusId) {
    const firstStatus = board.workflow.statuses[0];
    if (!firstStatus) throw new AppError(400, 'Workflow has no statuses');
    statusId = firstStatus.id;
  } else {
    const validStatus = board.workflow.statuses.find((s) => s.id === statusId);
    if (!validStatus) throw new AppError(400, 'Status does not belong to this board workflow');
  }

  // Validate parent belongs to same board
  if (dto.parentId) {
    const parent = await prisma.task.findUnique({ where: { id: dto.parentId } });
    if (!parent || parent.boardId !== boardId) {
      throw new AppError(400, 'Parent task not found in this board');
    }
  }

  const { path, depth } = await buildPath(dto.parentId);

  if (depth >= MAX_SUBTASK_DEPTH) {
    throw new AppError(400, `Maximum subtask nesting depth (${MAX_SUBTASK_DEPTH}) reached`);
  }

  const { issueKey, issueNumber } = await generateIssueKey(boardId);

  // orderIndex = max + 1 in same status
  const maxOrder = await prisma.task.aggregate({
    where: { boardId, statusId },
    _max: { orderIndex: true },
  });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  // Membership check + write are atomic to prevent TOCTOU if assignee is removed mid-request.
  const task = await prisma.$transaction(async (tx) => {
    if (dto.assigneeId != null) {
      const member = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: board.workspaceId, userId: dto.assigneeId } },
        select: { userId: true },
      });
      if (!member) throw new AppError(400, 'Assignee is not a member of this workspace');
    }

    const created = await tx.task.create({
      data: {
        boardId,
        statusId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        assigneeId: dto.assigneeId,
        creatorId: userId,
        parentId: dto.parentId,
        issueKey,
        issueNumber,
        path,
        depth,
        orderIndex,
      },
      omit: { assigneeId: true },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        status: { select: { id: true, name: true, color: true, category: true } },
        _count: { select: { children: true } },
      },
    });

    // Открываем первую запись истории статусов
    await tx.taskStatusHistory.create({ data: { taskId: created.id, statusId } });

    return created;
  });

  if (dto.description) {
    const author = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });
    await emitMentionNotifications(dto.description, {
      taskId: task.id,
      taskTitle: task.title,
      taskKey: task.issueKey,
      mentionedBy: author,
      context: 'task',
    }, userId);
  }

  if (dto.assigneeId && dto.assigneeId !== userId) {
    emitTaskAssignedNotification(task.id, dto.assigneeId, userId).catch(() => {});
  }

  return task;
}

// ─── Get task detail ──────────────────────────────────────────────────────────

export async function getTask(taskId: string, userId: string) {
  await getTaskWithAccess(taskId, userId);

  return prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    omit: { assigneeId: true },
    include: {
      status: true,
      assignee: { select: { id: true, name: true, email: true, avatar: true } },
      creator: { select: { id: true, name: true, avatar: true } },
      parent: { select: { id: true, title: true, issueKey: true } },
      children: {
        orderBy: { orderIndex: 'asc' },
        omit: { assigneeId: true },
        include: {
          assignee: { select: { id: true, name: true, avatar: true } },
          status: { select: { id: true, name: true, color: true, category: true } },
          _count: { select: { children: true } },
        },
      },
      labels: {
        include: { label: true },
        orderBy: { label: { name: 'asc' } },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { author: { select: { id: true, name: true, avatar: true } } },
      },
      _count: { select: { comments: true, children: true } },
      checklists: {
        orderBy: { orderIndex: 'asc' },
        include: { items: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  });
}

// ─── Get subtree ──────────────────────────────────────────────────────────────

export async function getSubtree(taskId: string, userId: string) {
  const { task } = await getTaskWithAccess(taskId, userId);

  return prisma.task.findMany({
    where: {
      boardId: task.boardId,
      path: { startsWith: `${task.path}${taskId}/` },
    },
    orderBy: [{ depth: 'asc' }, { orderIndex: 'asc' }],
    omit: { assigneeId: true },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      status: { select: { id: true, name: true, color: true, category: true } },
      _count: { select: { children: true } },
    },
  });
}

// ─── History helper ───────────────────────────────────────────────────────────

type HistoryRecord = { taskId: string; userId: string; field: string; oldValue: string | null; newValue: string | null };

function makeHistoryEntries(
  taskId: string,
  userId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): HistoryRecord[] {
  const entries: HistoryRecord[] = [];
  for (const field of Object.keys(after)) {
    const oldVal = before[field] !== undefined && before[field] !== null ? String(before[field]) : null;
    const newVal = after[field] !== undefined && after[field] !== null ? String(after[field]) : null;
    if (oldVal !== newVal) {
      entries.push({ taskId, userId, field, oldValue: oldVal, newValue: newVal });
    }
  }
  return entries;
}

// ─── Update task ──────────────────────────────────────────────────────────────

export async function updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
  const { task: current } = await getTaskWithAccess(taskId, userId);

  const data: Record<string, unknown> = {
    ...(dto.title !== undefined && { title: dto.title }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.priority !== undefined && { priority: dto.priority }),
    ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
    ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
    ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
  };

  const before: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    before[key] = (current as Record<string, unknown>)[key] ?? null;
  }
  const historyEntries = makeHistoryEntries(taskId, userId, before, data);

  // Run membership check + write atomically so a concurrent membership removal
  // cannot slip between the validation and the UPDATE.
  // null = explicit unassign (skip check); undefined = field not in payload.
  const updated = await prisma.$transaction(async (tx) => {
    if (dto.assigneeId != null) {
      const member = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: current.board.workspaceId, userId: dto.assigneeId } },
        select: { userId: true },
      });
      if (!member) throw new AppError(400, 'Assignee is not a member of this workspace');
    }

    const result = await tx.task.update({
      where: { id: taskId },
      data,
      omit: { assigneeId: true },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, avatar: true } },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
        _count: { select: { children: true } },
      },
    });
    await Promise.all(historyEntries.map((e) => tx.taskHistory.create({ data: e })));
    return result;
  });

  if (dto.description !== undefined) {
    const author = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });
    await emitMentionNotifications(dto.description, {
      taskId,
      taskTitle: updated.title,
      taskKey: updated.issueKey,
      mentionedBy: author,
      context: 'task',
    }, userId);
  }

  // Notify new assignee if assignee changed
  const newAssigneeId = dto.assigneeId;
  if (newAssigneeId !== undefined && newAssigneeId !== current.assigneeId && newAssigneeId) {
    emitTaskAssignedNotification(taskId, newAssigneeId, userId).catch(() => {});
  }

  return updated;
}

// ─── Move task (status transition) ────────────────────────────────────────────

export async function moveTask(taskId: string, userId: string, toStatusId: string) {
  const { task } = await getTaskWithAccess(taskId, userId);

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: task.boardId },
    include: { workflow: { include: { transitions: true } } },
  });

  const fromStatusId = task.statusId;

  // Validate transition (skip if same status)
  if (fromStatusId !== toStatusId) {
    const validTransition = board.workflow.transitions.find(
      (t) => t.fromStatusId === fromStatusId && t.toStatusId === toStatusId,
    );
    if (!validTransition) {
      throw new AppError(400, 'Transition not allowed by workflow rules');
    }
  }

  // Place at end of target column
  const maxOrder = await prisma.task.aggregate({
    where: { boardId: task.boardId, statusId: toStatusId },
    _max: { orderIndex: true },
  });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  const [updated] = await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { statusId: toStatusId, orderIndex },
      omit: { assigneeId: true },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, avatar: true } },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
        _count: { select: { children: true } },
      },
    }),
    prisma.taskHistory.create({
      data: { taskId, userId, field: 'statusId', oldValue: fromStatusId, newValue: toStatusId },
    }),
    // Закрываем текущую запись истории статусов и открываем новую
    prisma.taskStatusHistory.updateMany({
      where: { taskId, endedAt: null },
      data: { endedAt: new Date() },
    }),
    prisma.taskStatusHistory.create({
      data: { taskId, statusId: toStatusId },
    }),
  ]);

  return updated;
}

// ─── Task history ─────────────────────────────────────────────────────────────

export async function getTaskHistory(taskId: string, userId: string) {
  await getTaskWithAccess(taskId, userId);

  const entries = await prisma.taskHistory.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  // Resolve assigneeId UUIDs → user names so the frontend can display them.
  const assigneeIds = new Set<string>();
  for (const e of entries) {
    if (e.field === 'assigneeId') {
      if (e.oldValue) assigneeIds.add(e.oldValue);
      if (e.newValue) assigneeIds.add(e.newValue);
    }
  }
  const userMap = new Map<string, string>();
  if (assigneeIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...assigneeIds] } },
      select: { id: true, name: true },
    });
    for (const u of users) userMap.set(u.id, u.name);
  }

  return entries.map((e) => ({
    ...e,
    oldValue: e.field === 'assigneeId' && e.oldValue ? (userMap.get(e.oldValue) ?? e.oldValue) : e.oldValue,
    newValue: e.field === 'assigneeId' && e.newValue ? (userMap.get(e.newValue) ?? e.newValue) : e.newValue,
  }));
}

// ─── Delete task ──────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string, userId: string) {
  const { task } = await getTaskWithAccess(taskId, userId);

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { path: { startsWith: `${task.path}${taskId}/` } } }),
    prisma.task.delete({ where: { id: taskId } }),
  ]);
}

// ─── Bulk update tasks ────────────────────────────────────────────────────────

export async function bulkUpdateTasks(
  boardId: string,
  userId: string,
  ids: string[],
  patch: { statusId?: string; assigneeId?: string | null; priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null },
) {
  const { board, member } = await getBoardWithAccess(boardId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot update tasks');

  if (patch.statusId) {
    const valid = board.workflow.statuses.find(s => s.id === patch.statusId);
    if (!valid) throw new AppError(400, 'Status does not belong to this board workflow');
  }

  if (patch.assigneeId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: board.workspaceId, userId: patch.assigneeId } },
    });
    if (!isMember) throw new AppError(400, 'Assignee is not a member of this workspace');
  }

  // Fetch current state to compute history and status transitions
  const current = await prisma.task.findMany({
    where: { id: { in: ids }, boardId },
    select: { id: true, statusId: true, assigneeId: true, priority: true },
  });
  if (current.length === 0) return { updated: 0 };

  const validIds = current.map(t => t.id);
  const historyEntries: HistoryRecord[] = [];
  const statusChangedIds: string[] = [];

  for (const t of current) {
    if (patch.statusId !== undefined && patch.statusId !== t.statusId) {
      historyEntries.push({ taskId: t.id, userId, field: 'statusId', oldValue: t.statusId, newValue: patch.statusId });
      statusChangedIds.push(t.id);
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== t.assigneeId) {
      historyEntries.push({ taskId: t.id, userId, field: 'assigneeId', oldValue: t.assigneeId, newValue: patch.assigneeId });
    }
    if (patch.priority !== undefined && patch.priority !== t.priority) {
      historyEntries.push({ taskId: t.id, userId, field: 'priority', oldValue: t.priority ?? null, newValue: patch.priority ?? null });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { id: { in: validIds }, boardId },
      data: {
        ...(patch.statusId !== undefined && { statusId: patch.statusId }),
        ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId }),
        ...(patch.priority !== undefined && { priority: patch.priority }),
      },
    });

    if (historyEntries.length > 0) {
      await tx.taskHistory.createMany({ data: historyEntries });
    }

    if (statusChangedIds.length > 0) {
      await tx.taskStatusHistory.updateMany({
        where: { taskId: { in: statusChangedIds }, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.taskStatusHistory.createMany({
        data: statusChangedIds.map(id => ({ taskId: id, statusId: patch.statusId! })),
      });
    }
  });

  return { updated: validIds.length };
}

// ─── Bulk delete tasks ────────────────────────────────────────────────────────

export async function bulkDeleteTasks(boardId: string, userId: string, ids: string[]) {
  const { member } = await getBoardWithAccess(boardId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot delete tasks');

  const tasksToDelete = await prisma.task.findMany({
    where: { id: { in: ids }, boardId },
    select: { id: true, path: true },
  });
  if (tasksToDelete.length === 0) return { deleted: 0 };

  const validIds = tasksToDelete.map(t => t.id);

  await prisma.$transaction(async (tx) => {
    // Delete descendants before the selected tasks (materialized path cascade)
    await tx.task.deleteMany({
      where: {
        boardId,
        OR: tasksToDelete.map(t => ({ path: { startsWith: `${t.path}${t.id}/` } })),
      },
    });
    await tx.task.deleteMany({ where: { id: { in: validIds } } });
  });

  return { deleted: validIds.length };
}

// ─── My Tasks (cross-workspace) ───────────────────────────────────────────────

export async function listMyTasks(userId: string, filters: MyTasksFiltersDto) {
  // All workspaces where user is a member
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  const workspaceIds = memberships.map((m) => m.workspaceId);

  if (workspaceIds.length === 0) return { tasks: [], total: 0 };

  // Filter by specific workspace if requested
  const filteredWorkspaceIds = filters.workspaceId
    ? workspaceIds.filter((id) => id === filters.workspaceId)
    : workspaceIds;

  const where: Prisma.TaskWhereInput = {
    assigneeId: userId,
    board: { workspaceId: { in: filteredWorkspaceIds } },
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.search && { title: { contains: filters.search, mode: 'insensitive' } }),
    ...buildDueDateFilter(filters.duePreset),
  };

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
      include: {
        status: { select: { id: true, name: true, color: true, category: true } },
        board: {
          select: {
            id: true, name: true, prefix: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { children: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
}

// ─── DnD reorder ──────────────────────────────────────────────────────────────

export async function reorderTasks(
  boardId: string,
  userId: string,
  updates: { id: string; statusId: string; orderIndex: number }[],
) {
  const { board, member } = await getBoardWithAccess(boardId, userId);
  if (member.role === 'VIEWER') throw new AppError(403, 'Viewers cannot reorder tasks');
  const validStatusIds = new Set(board.workflow.statuses.map((s) => s.id));

  for (const u of updates) {
    if (!validStatusIds.has(u.statusId)) {
      throw new AppError(400, `Status ${u.statusId} not valid for this board`);
    }
  }

  // Batch update in transaction
  await prisma.$transaction(
    updates.map((u) =>
      prisma.task.update({
        where: { id: u.id, boardId },
        data: { statusId: u.statusId, orderIndex: u.orderIndex },
      }),
    ),
  );
}
