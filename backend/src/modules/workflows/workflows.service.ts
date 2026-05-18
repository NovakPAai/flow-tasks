import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { logEvent } from '../workspaces/workspaces.service.js';
import type { CreateWorkflowDto, UpdateWorkflowDto, AddStatusDto, UpdateStatusDto } from './workflows.dto.js';

// ─── Default workflow ─────────────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  { name: 'To Do',       color: '#6B7280', category: 'OPEN'        as const, position: 0 },
  { name: 'In Progress', color: '#4F6EF7', category: 'IN_PROGRESS' as const, position: 1 },
  { name: 'Done',        color: '#22C55E', category: 'DONE'        as const, position: 2 },
];

export async function createDefaultWorkflow(workspaceId: string) {
  const workflow = await prisma.workflow.create({
    data: {
      workspaceId,
      name: 'Default',
      mode: 'BIDIRECTIONAL',
      isDefault: true,
      statuses: { create: DEFAULT_STATUSES },
    },
    include: { statuses: { orderBy: { position: 'asc' } } },
  });

  await generateTransitions(workflow.id);
  return workflow;
}

// ─── Transition generation ────────────────────────────────────────────────────

async function generateTransitions(workflowId: string) {
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { statuses: { orderBy: { position: 'asc' } } },
  });

  await prisma.workflowTransition.deleteMany({ where: { workflowId } });

  const statuses = workflow.statuses;
  if (statuses.length < 2) return;

  const pairs: { workflowId: string; fromStatusId: string; toStatusId: string }[] = [];

  if (workflow.mode === 'FORWARD_ONLY') {
    for (let i = 0; i < statuses.length; i++) {
      for (let j = i + 1; j < statuses.length; j++) {
        pairs.push({ workflowId, fromStatusId: statuses[i].id, toStatusId: statuses[j].id });
      }
    }
  } else if (workflow.mode === 'BIDIRECTIONAL') {
    for (let i = 0; i < statuses.length; i++) {
      for (let j = 0; j < statuses.length; j++) {
        if (i !== j) {
          pairs.push({ workflowId, fromStatusId: statuses[i].id, toStatusId: statuses[j].id });
        }
      }
    }
  }
  // CUSTOM: no auto-generation

  if (pairs.length > 0) {
    await prisma.workflowTransition.createMany({ data: pairs });
  }
}

// ─── Workspace access check ───────────────────────────────────────────────────

async function assertWorkspaceAccess(workflowId: string, userId: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!workflow) throw new AppError(404, 'Workflow not found');
  if (workflow.workspace.deletedAt !== null) throw new AppError(404, 'Workflow not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workflow.workspaceId, userId } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  return { workflow, member };
}

async function assertWorkspaceOwner(workflowId: string, userId: string) {
  const { workflow, member } = await assertWorkspaceAccess(workflowId, userId);
  if (member.role !== 'OWNER') throw new AppError(403, 'Only workspace owners can manage workflows');
  return workflow;
}

// ─── Workflow CRUD ────────────────────────────────────────────────────────────

export async function listWorkflows(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.workspace.deletedAt !== null) throw new AppError(404, 'Workspace not found');

  return prisma.workflow.findMany({
    where: { workspaceId },
    include: {
      statuses: { orderBy: { position: 'asc' } },
      _count: { select: { transitions: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function createWorkflow(workspaceId: string, userId: string, dto: CreateWorkflowDto) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!member) throw new AppError(403, 'Access denied');
  if (member.workspace.deletedAt !== null) throw new AppError(404, 'Workspace not found');
  if (member.role !== 'OWNER') throw new AppError(403, 'Only workspace owners can create workflows');

  const workflow = await prisma.workflow.create({
    data: {
      workspaceId,
      name: dto.name,
      mode: dto.mode ?? 'BIDIRECTIONAL',
      statuses: dto.statuses
        ? { create: dto.statuses.map((s, i) => ({ ...s, position: i })) }
        : undefined,
    },
    include: { statuses: { orderBy: { position: 'asc' } } },
  });

  if (workflow.mode !== 'CUSTOM') {
    await generateTransitions(workflow.id);
  }

  await logEvent(workspaceId, userId, 'workflow_created', 'workflow', workflow.id, { name: dto.name });

  return workflow;
}

export async function getWorkflow(workflowId: string, userId: string) {
  await assertWorkspaceAccess(workflowId, userId);

  return prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: {
      statuses: { orderBy: { position: 'asc' } },
      transitions: {
        include: {
          fromStatus: true,
          toStatus: true,
        },
      },
    },
  });
}

export async function updateWorkflow(workflowId: string, userId: string, dto: UpdateWorkflowDto) {
  const workflow = await assertWorkspaceOwner(workflowId, userId);

  if (dto.isDefault === false && workflow.isDefault) {
    throw new AppError(400, 'Cannot unset the default workflow — set another workflow as default first');
  }

  const oldMode = workflow.mode;

  const updated = await prisma.$transaction(async (tx) => {
    // Atomically unset previous default before setting a new one
    if (dto.isDefault === true) {
      await tx.workflow.updateMany({
        where: { workspaceId: workflow.workspaceId, isDefault: true, id: { not: workflowId } },
        data: { isDefault: false },
      });
    }
    return tx.workflow.update({ where: { id: workflowId }, data: dto });
  });

  // If mode changed from/to FORWARD_ONLY or BIDIRECTIONAL, regenerate transitions
  if (dto.mode && dto.mode !== oldMode && dto.mode !== 'CUSTOM') {
    await generateTransitions(workflowId);
  }

  const meta: Record<string, unknown> = { workflowName: workflow.name };
  if (dto.name !== undefined && dto.name !== workflow.name) { meta.nameFrom = workflow.name; meta.nameTo = dto.name; }
  if (dto.mode !== undefined && dto.mode !== oldMode) { meta.modeFrom = oldMode; meta.modeTo = dto.mode; }
  await logEvent(workflow.workspaceId, userId, 'workflow_updated', 'workflow', workflowId, meta);

  return updated;
}

export async function deleteWorkflow(workflowId: string, userId: string) {
  const workflow = await assertWorkspaceOwner(workflowId, userId);

  if (workflow.isDefault) throw new AppError(400, 'Cannot delete the default workflow');

  await prisma.workflow.delete({ where: { id: workflowId } });

  await logEvent(workflow.workspaceId, userId, 'workflow_deleted', 'workflow', workflowId, { name: workflow.name });
}

// ─── Statuses ─────────────────────────────────────────────────────────────────

export async function addStatus(workflowId: string, userId: string, dto: AddStatusDto) {
  await assertWorkspaceOwner(workflowId, userId);

  const maxPos = await prisma.workflowStatus.aggregate({
    where: { workflowId },
    _max: { position: true },
  });
  const position = dto.position ?? (maxPos._max.position ?? -1) + 1;

  // Shift existing statuses if inserting at a specific position
  if (dto.position !== undefined) {
    await prisma.workflowStatus.updateMany({
      where: { workflowId, position: { gte: dto.position } },
      data: { position: { increment: 1 } },
    });
  }

  const status = await prisma.workflowStatus.create({
    data: { workflowId, name: dto.name, color: dto.color, category: dto.category, position },
  });

  // Regenerate transitions if non-custom
  const workflow = await prisma.workflow.findUniqueOrThrow({ where: { id: workflowId } });
  if (workflow.mode !== 'CUSTOM') {
    await generateTransitions(workflowId);
  }

  await logEvent(workflow.workspaceId, userId, 'workflow_status_added', 'workflow', workflowId, {
    workflowName: workflow.name,
    statusName: dto.name,
  });

  return status;
}

export async function updateStatus(statusId: string, userId: string, dto: UpdateStatusDto) {
  const status = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
  if (!status) throw new AppError(404, 'Status not found');

  const workflow = await assertWorkspaceOwner(status.workflowId, userId);

  const updated = await prisma.workflowStatus.update({ where: { id: statusId }, data: dto });

  if (dto.name !== undefined && dto.name !== status.name) {
    await logEvent(workflow.workspaceId, userId, 'workflow_status_renamed', 'workflow', status.workflowId, {
      workflowName: workflow.name,
      nameFrom: status.name,
      nameTo: dto.name,
    });
  }

  return updated;
}

export async function deleteStatus(statusId: string, userId: string) {
  const status = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
  if (!status) throw new AppError(404, 'Status not found');

  const workflow = await assertWorkspaceOwner(status.workflowId, userId);

  const count = await prisma.workflowStatus.count({ where: { workflowId: status.workflowId } });
  if (count <= 1) throw new AppError(400, 'Workflow must have at least one status');

  // Delete + re-normalize positions in a single transaction
  await prisma.$transaction(async (tx) => {
    await tx.workflowStatus.delete({ where: { id: statusId } });
    const rest = await tx.workflowStatus.findMany({
      where: { workflowId: status.workflowId },
      orderBy: { position: 'asc' },
    });
    await Promise.all(
      rest.map((s, i) => tx.workflowStatus.update({ where: { id: s.id }, data: { position: i } })),
    );
  });

  if (workflow.mode !== 'CUSTOM') {
    await generateTransitions(status.workflowId);
  }

  await logEvent(workflow.workspaceId, userId, 'workflow_status_deleted', 'workflow', status.workflowId, {
    workflowName: workflow.name,
    statusName: status.name,
  });
}

export async function reorderStatuses(workflowId: string, userId: string, orderedIds: string[]) {
  await assertWorkspaceOwner(workflowId, userId);

  const statuses = await prisma.workflowStatus.findMany({ where: { workflowId } });
  const statusIds = new Set(statuses.map((s) => s.id));

  for (const id of orderedIds) {
    if (!statusIds.has(id)) throw new AppError(400, `Status ${id} does not belong to this workflow`);
  }
  if (orderedIds.length !== statuses.length) {
    throw new AppError(400, 'Must provide all status IDs for reorder');
  }

  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.workflowStatus.update({ where: { id }, data: { position: i } }),
    ),
  );

  const workflow = await prisma.workflow.findUniqueOrThrow({ where: { id: workflowId } });
  if (workflow.mode !== 'CUSTOM') {
    await generateTransitions(workflowId);
  }
}

// ─── Transitions (CUSTOM mode) ────────────────────────────────────────────────

export async function addTransition(workflowId: string, userId: string, fromStatusId: string, toStatusId: string) {
  const workflow = await assertWorkspaceOwner(workflowId, userId);
  if (workflow.mode !== 'CUSTOM') {
    throw new AppError(400, 'Can only add transitions manually in CUSTOM mode');
  }

  const existing = await prisma.workflowTransition.findUnique({
    where: { workflowId_fromStatusId_toStatusId: { workflowId, fromStatusId, toStatusId } },
  });
  if (existing) throw new AppError(409, 'Transition already exists');

  return prisma.workflowTransition.create({
    data: { workflowId, fromStatusId, toStatusId },
    include: { fromStatus: true, toStatus: true },
  });
}

export async function deleteTransition(transitionId: string, userId: string) {
  const transition = await prisma.workflowTransition.findUnique({ where: { id: transitionId } });
  if (!transition) throw new AppError(404, 'Transition not found');

  const workflow = await assertWorkspaceOwner(transition.workflowId, userId);
  if (workflow.mode !== 'CUSTOM') {
    throw new AppError(400, 'Can only delete transitions manually in CUSTOM mode');
  }

  await prisma.workflowTransition.delete({ where: { id: transitionId } });
}

export async function regenerateTransitions(workflowId: string, userId: string) {
  const workflow = await assertWorkspaceOwner(workflowId, userId);
  if (workflow.mode === 'CUSTOM') {
    throw new AppError(400, 'Cannot auto-regenerate transitions in CUSTOM mode');
  }
  await generateTransitions(workflowId);
  return prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { transitions: { include: { fromStatus: true, toStatus: true } } },
  });
}
