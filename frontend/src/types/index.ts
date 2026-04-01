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
  role?: WorkspaceRole;
  memberCount?: number;
  members?: WorkspaceMember[];
  workflows?: Workflow[];
  boards?: Board[];
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

// ─── Boards ───────────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  workspaceId: string;
  workflowId: string;
  name: string;
  prefix: string;
  description?: string;
  createdAt: string;
  workflow: Workflow;
  tasks?: Task[];
  _count?: { tasks: number };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  category: StatusCategory;
}

export interface Task {
  id: string;
  boardId: string;
  statusId: string;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  startDate?: string;
  assigneeId?: string;
  creatorId: string;
  orderIndex: number;
  issueKey: string;
  issueNumber: number;
  parentId?: string;
  depth: number;
  createdAt: string;
  updatedAt: string;
  // joined
  status?: TaskStatus;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'>;
  creator?: Pick<User, 'id' | 'name' | 'avatar'>;
  parent?: { id: string; title: string; issueKey: string };
  children?: Task[];
  _count?: { children: number };
}
