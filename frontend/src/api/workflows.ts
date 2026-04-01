import api from './client';
import type { Workflow, WorkflowStatus, WorkflowTransition } from '../types';

export async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  const { data } = await api.get<Workflow[]>(`/workspaces/${workspaceId}/workflows`);
  return data;
}

export async function createWorkflow(workspaceId: string, payload: {
  name: string;
  mode?: 'FORWARD_ONLY' | 'BIDIRECTIONAL' | 'CUSTOM';
  statuses?: { name: string; color: string; category: string }[];
}): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workspaces/${workspaceId}/workflows`, payload);
  return data;
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
  const { data } = await api.get<Workflow>(`/workflows/${workflowId}`);
  return data;
}

export async function updateWorkflow(workflowId: string, payload: {
  name?: string;
  mode?: 'FORWARD_ONLY' | 'BIDIRECTIONAL' | 'CUSTOM';
}): Promise<Workflow> {
  const { data } = await api.patch<Workflow>(`/workflows/${workflowId}`, payload);
  return data;
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await api.delete(`/workflows/${workflowId}`);
}

export async function addStatus(workflowId: string, payload: {
  name: string;
  color: string;
  category: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  position?: number;
}): Promise<WorkflowStatus> {
  const { data } = await api.post<WorkflowStatus>(`/workflows/${workflowId}/statuses`, payload);
  return data;
}

export async function updateStatus(statusId: string, payload: {
  name?: string;
  color?: string;
  category?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}): Promise<WorkflowStatus> {
  const { data } = await api.patch<WorkflowStatus>(`/workflow-statuses/${statusId}`, payload);
  return data;
}

export async function deleteStatus(statusId: string): Promise<void> {
  await api.delete(`/workflow-statuses/${statusId}`);
}

export async function reorderStatuses(workflowId: string, order: string[]): Promise<void> {
  await api.patch(`/workflows/${workflowId}/statuses/reorder`, { order });
}

export async function addTransition(workflowId: string, fromStatusId: string, toStatusId: string): Promise<WorkflowTransition> {
  const { data } = await api.post<WorkflowTransition>(`/workflows/${workflowId}/transitions`, { fromStatusId, toStatusId });
  return data;
}

export async function deleteTransition(transitionId: string): Promise<void> {
  await api.delete(`/workflow-transitions/${transitionId}`);
}

export async function regenerateTransitions(workflowId: string): Promise<Workflow> {
  const { data } = await api.post<Workflow>(`/workflows/${workflowId}/regenerate-transitions`);
  return data;
}
