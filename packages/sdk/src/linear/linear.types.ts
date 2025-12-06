/**
 * Linear Types - Type definitions for Linear integration
 */

// ============================================
// Configuration
// ============================================

export interface LinearConfig {
  apiKey: string;
  webhookSecret?: string;
  triggerStatus?: string;
  nextStatus?: string;
}

// ============================================
// Linear Data Types
// ============================================

export interface LinearState {
  id: string;
  name: string;
  color: string;
  type: string;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email?: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "ENG-123"
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state?: LinearState;
  team?: LinearTeam;
  assignee?: LinearUser;
  creator?: LinearUser;
  labels?: LinearLabel[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Webhook Types
// ============================================

export type WebhookAction = 'create' | 'update' | 'remove';

export type WebhookResourceType = 'Issue' | 'Comment' | 'Project' | 'Cycle' | 'IssueLabel';

export interface LinearUpdatedFrom {
  state?: LinearState;
  title?: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
}

export interface LinearWebhookPayload {
  action: WebhookAction;
  type: WebhookResourceType;
  data: LinearIssue;
  updatedFrom?: LinearUpdatedFrom;
  url: string;
  createdAt: string;
}

// ============================================
// Query Types
// ============================================

export interface LinearQueryOptions {
  teamId?: string;
  states?: string[];
  assigneeId?: string;
  priority?: number;
  first?: number;
  after?: string;
}

// ============================================
// Internal Task Mapping
// ============================================

export interface LinearTask {
  id: string;
  linearId: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
  labels: string[];
  url: string;
  createdAt: Date;
  updatedAt: Date;
}
