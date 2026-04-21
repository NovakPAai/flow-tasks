import { z } from 'zod';
import { stripHtml } from '../../shared/utils/sanitize.js';

const statusInputSchema = z.object({
  name: stripHtml(z.string().min(1).max(100)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  category: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
});

export const createWorkflowDto = z.object({
  name: stripHtml(z.string().min(1).max(100)),
  mode: z.enum(['FORWARD_ONLY', 'BIDIRECTIONAL', 'CUSTOM']).default('BIDIRECTIONAL'),
  statuses: z.array(statusInputSchema).min(1).max(20).optional(),
});

export const updateWorkflowDto = z.object({
  name: stripHtml(z.string().min(1).max(100)).optional(),
  mode: z.enum(['FORWARD_ONLY', 'BIDIRECTIONAL', 'CUSTOM']).optional(),
  isDefault: z.boolean().optional(),
});

export const addStatusDto = z.object({
  name: stripHtml(z.string().min(1).max(100)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  category: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
  position: z.number().int().min(0).optional(),
});

export const updateStatusDto = z.object({
  name: stripHtml(z.string().min(1).max(100)).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  position: z.number().int().min(0).optional(),
});

export const reorderStatusesDto = z.object({
  order: z.array(z.string().uuid()),
});

export const addTransitionDto = z.object({
  fromStatusId: z.string().uuid(),
  toStatusId: z.string().uuid(),
});

export type CreateWorkflowDto = z.infer<typeof createWorkflowDto>;
export type UpdateWorkflowDto = z.infer<typeof updateWorkflowDto>;
export type AddStatusDto = z.infer<typeof addStatusDto>;
export type UpdateStatusDto = z.infer<typeof updateStatusDto>;
