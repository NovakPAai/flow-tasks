// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  avatar?: string;
  loginCount?: number;
  createdAt?: string;
  isSuperadmin?: boolean;
}

// ─── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUserStats {
  workspaces: number;
  boards: number;
  tasks: number;
  members: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  loginCount: number;
  lastLoginAt?: string;
  createdAt: string;
  isSuperadmin: boolean;
  stats?: AdminUserStats;
}

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RegistrationRequest {
  id: string;
  email: string;
  name: string;
  status: RegistrationStatus;
  createdAt: string;
  reviewedAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export type WorkspaceRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export interface WorkspaceEvent {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

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
  isPrivate: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  role?: WorkspaceRole;
  memberCount?: number;
  boardCount?: number;
  taskCount?: number;
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
  isPrivate: boolean;
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

export interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  _count?: { tasks: number };
}

export interface TaskLabel {
  taskId: string;
  labelId: string;
  label: Label;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  isDone: boolean;
  orderIndex: number;
}

export interface Checklist {
  id: string;
  taskId: string;
  title: string;
  orderIndex: number;
  items: ChecklistItem[];
}

export interface TaskHistory {
  id: string;
  taskId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
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
  labels?: TaskLabel[];
  comments?: Comment[];
  checklists?: Checklist[];
  _count?: { children: number };
}
