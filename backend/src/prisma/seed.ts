import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding FlowTask database...');

  const password = await hashPassword('Password1');

  // ─── Users ────────────────────────────────────────────────────────────────
  const superadmin = await prisma.user.upsert({
    where: { email: 'novak.pavel@flowtask.dev' },
    update: {},
    create: { email: 'novak.pavel@flowtask.dev', password, name: 'Pavel Novak' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@flowtask.dev' },
    update: {},
    create: { email: 'admin@flowtask.dev', password, name: 'Alex Admin' },
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'user@flowtask.dev' },
    update: {},
    create: { email: 'user@flowtask.dev', password, name: 'Dev User' },
  });

  // ─── Sample registration request ─────────────────────────────────────────
  await prisma.registrationRequest.upsert({
    where: { email: 'petr.petrov@flowtask.dev' },
    update: {},
    create: { email: 'petr.petrov@flowtask.dev', password, name: 'Пётр Петров', status: 'PENDING' },
  });

  void superadmin;

  // ─── Workspace ────────────────────────────────────────────────────────────
  const existingWs = await prisma.workspace.findUnique({ where: { slug: 'demo' } });
  if (existingWs) {
    console.log('Demo workspace already exists, skipping detailed seed.');
    console.log('Users: admin@flowtask.dev, user@flowtask.dev (password: Password1)');
    return;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'demo',
      description: 'Демонстрационное рабочее пространство FlowTask',
      creatorId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: devUser.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // ─── Labels ───────────────────────────────────────────────────────────────
  const [_bugLabel, featureLabel, docsLabel] = await Promise.all([
    prisma.label.create({ data: { workspaceId: workspace.id, name: 'bug', color: '#EF4444' } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: 'feature', color: '#4F6EF7' } }),
    prisma.label.create({ data: { workspaceId: workspace.id, name: 'docs', color: '#10B981' } }),
  ]);

  // ─── Workflow (BIDIRECTIONAL with 4 statuses) ─────────────────────────────
  const workflow = await prisma.workflow.create({
    data: {
      workspaceId: workspace.id,
      name: 'Default',
      mode: 'BIDIRECTIONAL',
      isDefault: true,
      statuses: {
        create: [
          { name: 'Backlog',     color: '#4A5578', position: 0, category: 'OPEN' },
          { name: 'In Progress', color: '#4F6EF7', position: 1, category: 'IN_PROGRESS' },
          { name: 'Review',      color: '#F59E0B', position: 2, category: 'IN_PROGRESS' },
          { name: 'Done',        color: '#10B981', position: 3, category: 'DONE' },
        ],
      },
    },
    include: { statuses: { orderBy: { position: 'asc' } } },
  });

  const [sBacklog, sInProgress, sReview, sDone] = workflow.statuses;

  // BIDIRECTIONAL: every status can transition to every other
  const statusIds = workflow.statuses.map((s) => s.id);
  const transitions = statusIds.flatMap((from) =>
    statusIds.filter((to) => to !== from).map((to) => ({ workflowId: workflow.id, fromStatusId: from, toStatusId: to })),
  );
  await prisma.workflowTransition.createMany({ data: transitions });

  // ─── Boards ───────────────────────────────────────────────────────────────
  const devBoard = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      workflowId: workflow.id,
      name: 'Development',
      prefix: 'DEV',
      description: 'Backend & frontend разработка',
      nextNumber: 1,
    },
  });

  const opsBoard = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      workflowId: workflow.id,
      name: 'Operations',
      prefix: 'OPS',
      description: 'Инфраструктура и DevOps',
      nextNumber: 1,
    },
  });

  // ─── Helper: create task with auto issueKey ───────────────────────────────
  async function createTask(boardId: string, data: {
    title: string;
    description?: string;
    statusId: string;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    creatorId: string;
    assigneeId?: string;
    dueDate?: Date;
    orderIndex: number;
  }) {
    const board = await prisma.board.update({
      where: { id: boardId },
      data: { nextNumber: { increment: 1 } },
      select: { prefix: true, nextNumber: true },
    });
    const issueNumber = board.nextNumber - 1;
    const issueKey = `${board.prefix}-${issueNumber}`;

    return prisma.task.create({
      data: { ...data, boardId, issueKey, issueNumber, path: '/', depth: 0 },
    });
  }

  // ─── Dev board tasks ──────────────────────────────────────────────────────
  const t1 = await createTask(devBoard.id, {
    title: 'Bootstrap FlowTask репозиторий',
    description: 'Создать структуру проекта, настроить Docker Compose, Prisma, Express + React.',
    statusId: sDone.id,
    priority: 'HIGH',
    creatorId: admin.id,
    assigneeId: admin.id,
    orderIndex: 0,
  });

  const t2 = await createTask(devBoard.id, {
    title: 'Реализовать Kanban Board с DnD',
    description: 'Перетаскивание задач между колонками с валидацией workflow-переходов.',
    statusId: sDone.id,
    priority: 'HIGH',
    creatorId: admin.id,
    assigneeId: devUser.id,
    orderIndex: 1,
  });

  const t3 = await createTask(devBoard.id, {
    title: 'Добавить фильтры на доску',
    description: 'Фильтрация по исполнителю, приоритету, статусу, метке и сроку.',
    statusId: sInProgress.id,
    priority: 'MEDIUM',
    creatorId: admin.id,
    assigneeId: devUser.id,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    orderIndex: 0,
  });

  const t4 = await createTask(devBoard.id, {
    title: 'Настройки рабочего пространства',
    description: 'Управление участниками, ролями и метками.',
    statusId: sReview.id,
    priority: 'MEDIUM',
    creatorId: admin.id,
    assigneeId: admin.id,
    orderIndex: 0,
  });

  const t5 = await createTask(devBoard.id, {
    title: 'Написать README и документацию по деплою',
    description: 'Инструкция по локальному запуску и деплою на VPS.',
    statusId: sBacklog.id,
    priority: 'LOW',
    creatorId: devUser.id,
    orderIndex: 0,
  });

  // ─── Ops board tasks ──────────────────────────────────────────────────────
  await createTask(opsBoard.id, {
    title: 'Настроить Docker Compose для prod',
    statusId: sInProgress.id,
    priority: 'HIGH',
    creatorId: admin.id,
    assigneeId: admin.id,
    orderIndex: 0,
  });

  await createTask(opsBoard.id, {
    title: 'Настроить nginx + SSL',
    statusId: sBacklog.id,
    priority: 'MEDIUM',
    creatorId: admin.id,
    orderIndex: 0,
  });

  // ─── Labels on tasks ──────────────────────────────────────────────────────
  await prisma.taskLabel.createMany({
    data: [
      { taskId: t1.id, labelId: featureLabel.id },
      { taskId: t2.id, labelId: featureLabel.id },
      { taskId: t3.id, labelId: featureLabel.id },
      { taskId: t4.id, labelId: featureLabel.id },
      { taskId: t5.id, labelId: docsLabel.id },
    ],
  });

  // ─── Comments ─────────────────────────────────────────────────────────────
  await prisma.comment.createMany({
    data: [
      { taskId: t2.id, authorId: admin.id, body: 'Отлично сработано! DnD работает плавно.' },
      { taskId: t2.id, authorId: devUser.id, body: 'Добавил валидацию переходов на фронте и бэке.' },
      { taskId: t3.id, authorId: admin.id, body: 'Не забудь добавить фильтр по метке.' },
    ],
  });

  // ─── Checklist ────────────────────────────────────────────────────────────
  const checklist = await prisma.checklist.create({
    data: {
      taskId: t4.id,
      title: 'Чеклист настроек',
      orderIndex: 0,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      { checklistId: checklist.id, title: 'Форма редактирования workspace', isDone: true,  orderIndex: 0 },
      { checklistId: checklist.id, title: 'Управление участниками',          isDone: true,  orderIndex: 1 },
      { checklistId: checklist.id, title: 'Управление метками',              isDone: false, orderIndex: 2 },
      { checklistId: checklist.id, title: 'Удаление workspace',              isDone: false, orderIndex: 3 },
    ],
  });

  console.log('');
  console.log('✅ Seed complete!');
  console.log('   Users:     admin@flowtask.dev / user@flowtask.dev (password: Password1)');
  console.log('   Workspace: demo');
  console.log('   Boards:    DEV (7 tasks), OPS (2 tasks)');
  console.log('   Labels:    bug, feature, docs');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
