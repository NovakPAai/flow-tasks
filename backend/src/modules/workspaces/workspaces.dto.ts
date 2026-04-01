import { z } from 'zod';

export const createWorkspaceDto = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
});

export const updateWorkspaceDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const addMemberDto = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const updateMemberRoleDto = z.object({
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']),
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceDto>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceDto>;
export type AddMemberDto = z.infer<typeof addMemberDto>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleDto>;
