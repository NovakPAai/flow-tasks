import { prisma } from '../../prisma/client.js';

export async function globalSearch(userId: string, q: string, limit = 5) {
  const term = q.trim();
  if (!term) return { tasks: [], boards: [], workspaces: [] };

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true, role: true },
  });
  if (memberships.length === 0) return { tasks: [], boards: [], workspaces: [] };

  const allWorkspaceIds = memberships.map((m) => m.workspaceId);

  // For VIEWER-role memberships, private boards and private workspaces are hidden
  const viewerWorkspaceIds = memberships
    .filter((m) => m.role === 'VIEWER')
    .map((m) => m.workspaceId);

  // Board visibility filter: hide isPrivate boards in workspaces where caller is VIEWER
  const boardVisibility = viewerWorkspaceIds.length > 0
    ? {
        OR: [
          { isPrivate: false },
          { workspaceId: { notIn: viewerWorkspaceIds } },
        ],
      }
    : {};

  // Workspace visibility: hide isPrivate workspaces for VIEWERs
  const wsVisibility = viewerWorkspaceIds.length > 0
    ? {
        OR: [
          { isPrivate: false },
          { id: { notIn: viewerWorkspaceIds } },
        ],
      }
    : {};

  const [tasks, boards, workspaces] = await Promise.all([
    prisma.task.findMany({
      where: {
        board: {
          workspaceId: { in: allWorkspaceIds },
          ...boardVisibility,
        },
        parentId: null,
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { issueKey: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        issueKey: true,
        title: true,
        priority: true,
        updatedAt: true,
        status: { select: { id: true, name: true, color: true, category: true } },
        board: {
          select: {
            id: true, name: true, prefix: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),

    prisma.board.findMany({
      where: {
        workspaceId: { in: allWorkspaceIds },
        name: { contains: term, mode: 'insensitive' },
        ...boardVisibility,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, prefix: true,
        workspace: { select: { id: true, name: true, slug: true } },
      },
    }),

    prisma.workspace.findMany({
      where: {
        id: { in: allWorkspaceIds },
        name: { contains: term, mode: 'insensitive' },
        ...wsVisibility,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return { tasks, boards, workspaces };
}
