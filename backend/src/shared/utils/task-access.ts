import type { Prisma } from '@prisma/client';

/**
 * Prisma WHERE clause that limits task queries to rows visible to userId.
 * A task is accessible when the user is a member of the workspace that owns
 * the board the task belongs to.
 *
 * Use this in every findMany/count that lists tasks so access control
 * stays in one place rather than scattered across service methods.
 */
export function accessibleTaskWhere(userId: string): Prisma.TaskWhereInput {
  return {
    board: {
      workspace: {
        members: { some: { userId } },
      },
    },
  };
}

/** Returns whether the user has access to a specific workspace. */
export function canAccessWorkspace(
  userId: string,
  members: { userId: string }[],
): boolean {
  return members.some((m) => m.userId === userId);
}
