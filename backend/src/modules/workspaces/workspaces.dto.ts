import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

export const createWorkspaceDto = z.object({
  name: stripHtml(z.string().min(1).max(100)),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: stripHtml(z.string().max(500)).optional(),
});

export const updateWorkspaceDto = z.object({
  name:         stripHtml(z.string().min(1).max(100)).optional(),
  description:  stripHtml(z.string().max(500)).optional(),
  isPrivate:    z.boolean().optional(),
  requireMfa:   z.boolean().optional(),
  mfaGraceDays: z.number().int().min(1).max(30).optional(),
});

export const addMemberDto = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const updateMemberRoleDto = z.object({
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']),
});

export const inviteByEmailDto = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const CANDIDATE_LIMIT_DEFAULT = 10;
export const CANDIDATE_LIMIT_MAX     = 20;
export const CANDIDATE_MIN_QUERY     = 2;
export const CANDIDATE_MAX_QUERY     = 100;

// Trim happens at DTO boundary so the rate-limit bucket is not charged
// for empty/whitespace requests that would fail validation in the service.
// CandidateSearchQueryDto reflects the parsed (post-trim) shape.
export const candidateSearchQueryDto = z.object({
  q: z
    .string()
    .max(CANDIDATE_MAX_QUERY, `Query must be at most ${CANDIDATE_MAX_QUERY} characters`)
    .transform((s) => s.trim())
    .refine((s) => s.length >= CANDIDATE_MIN_QUERY, {
      message: `Query must be at least ${CANDIDATE_MIN_QUERY} characters after trimming`,
    }),
  limit: z.coerce.number().int().min(1).max(CANDIDATE_LIMIT_MAX).default(CANDIDATE_LIMIT_DEFAULT),
});

export const workspaceIdParamDto = z.object({ id: z.string().uuid() });

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceDto>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceDto>;
export type AddMemberDto = z.infer<typeof addMemberDto>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleDto>;
export type InviteByEmailDto = z.infer<typeof inviteByEmailDto>;
export type CandidateSearchQueryDto = z.infer<typeof candidateSearchQueryDto>;
