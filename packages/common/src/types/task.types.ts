/**
 * Task Types from Notion and Internal Tracking
 */

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  TESTING = 'testing',
  DONE = 'done',
  BLOCKED = 'blocked',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Task {
  id: string;
  projectId: string;
  notionId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  epic?: string;
  storyPoints?: number;
  labels?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskSpec {
  taskId: string;
  content: string;
  architecture: string[];
  implementationSteps: string[];
  testingStrategy: string;
  risks: string[];
  estimatedTime?: number;
  dependencies?: string[];
  createdAt: Date;
}

export interface TaskImplementation {
  taskId: string;
  specId: string;
  branch: string;
  commits: string[];
  files: TaskFile[];
  prUrl?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface TaskFile {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
  diff?: string;
}

