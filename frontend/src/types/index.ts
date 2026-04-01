// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  loginCount?: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export type WorkspaceRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  // joined fields
  role?: WorkspaceRole;
  memberCount?: number;
  members?: WorkspaceMember[];
  workflows?: Workflow[];
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export type WorkflowMode = 'FORWARD_ONLY' | 'BIDIRECTIONAL' | 'CUSTOM';
export type StatusCategory = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface WorkflowStatus {
  id: string;
  workflowId: string;
  name: string;
  color: string;
  position: number;
  category: StatusCategory;
}

export interface WorkflowTransition {
  id: string;
  workflowId: string;
  fromStatusId: string;
  toStatusId: string;
  fromStatus?: WorkflowStatus;
  toStatus?: WorkflowStatus;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  mode: WorkflowMode;
  isDefault: boolean;
  createdAt: string;
  statuses: WorkflowStatus[];
  transitions?: WorkflowTransition[];
}
