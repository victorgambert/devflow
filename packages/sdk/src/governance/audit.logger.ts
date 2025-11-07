/**
 * Audit Logger - Phase 4 Security & Governance
 * Complete audit trail for all DevFlow operations
 */

import { createLogger } from '@soma-squad-ai/common';

const logger = createLogger('AuditLogger');

// ============================================
// Types
// ============================================

export enum AuditEventType {
  // Workflow Events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',

  // Agent Events
  AGENT_INVOKED = 'agent.invoked',
  AGENT_RESPONSE = 'agent.response',
  AGENT_ERROR = 'agent.error',
  AGENT_QUOTA_EXCEEDED = 'agent.quota_exceeded',

  // VCS Events
  BRANCH_CREATED = 'vcs.branch_created',
  COMMIT_CREATED = 'vcs.commit_created',
  PR_OPENED = 'vcs.pr_opened',
  PR_MERGED = 'vcs.pr_merged',
  PR_CLOSED = 'vcs.pr_closed',

  // File Events
  FILE_CREATED = 'file.created',
  FILE_MODIFIED = 'file.modified',
  FILE_DELETED = 'file.deleted',

  // Policy Events
  POLICY_VIOLATION = 'policy.violation',
  POLICY_WARNING = 'policy.warning',
  POLICY_OVERRIDE = 'policy.override',

  // Security Events
  SECURITY_SCAN = 'security.scan',
  SECURITY_ISSUE = 'security.issue',
  SECRET_DETECTED = 'security.secret_detected',

  // Governance Events
  CODEOWNERS_REQUIRED = 'governance.codeowners_required',
  REVIEW_REQUIRED = 'governance.review_required',
  APPROVAL_GRANTED = 'governance.approval_granted',
  APPROVAL_REJECTED = 'governance.approval_rejected',

  // Budget Events
  BUDGET_ALLOCATED = 'budget.allocated',
  BUDGET_CONSUMED = 'budget.consumed',
  BUDGET_WARNING = 'budget.warning',
  BUDGET_EXCEEDED = 'budget.exceeded',

  // Auto-Merge Events
  AUTO_MERGE_ELIGIBLE = 'auto_merge.eligible',
  AUTO_MERGE_BLOCKED = 'auto_merge.blocked',
  AUTO_MERGE_EXECUTED = 'auto_merge.executed',
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  result: 'success' | 'failure' | 'warning' | 'info';
  metadata?: Record<string, any>;
  context?: AuditContext;
  tags?: string[];
}

export interface AuditActor {
  type: 'user' | 'agent' | 'system' | 'workflow';
  id: string;
  name?: string;
  email?: string;
  ipAddress?: string;
}

export interface AuditResource {
  type: 'workflow' | 'file' | 'pr' | 'branch' | 'project' | 'task' | 'agent';
  id: string;
  name?: string;
  path?: string;
}

export interface AuditContext {
  projectId?: string;
  workflowId?: string;
  taskId?: string;
  prNumber?: number;
  branchName?: string;
  commitSha?: string;
}

export interface AuditQuery {
  types?: AuditEventType[];
  actorIds?: string[];
  resourceIds?: string[];
  startDate?: Date;
  endDate?: Date;
  result?: 'success' | 'failure' | 'warning' | 'info';
  tags?: string[];
  projectId?: string;
  limit?: number;
}

export interface AuditSummary {
  totalEvents: number;
  byType: Record<string, number>;
  byResult: Record<string, number>;
  violations: number;
  warnings: number;
  budgetConsumed: number;
  topActors: Array<{ actor: string; count: number }>;
}

// ============================================
// AuditLogger Class
// ============================================

export class AuditLogger {
  private events: AuditEvent[] = [];
  private persistToDatabase: boolean;

  constructor(persistToDatabase = true) {
    this.persistToDatabase = persistToDatabase;
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    // Store in memory
    this.events.push(fullEvent);

    // Log to console
    logger.info('Audit event', {
      type: fullEvent.type,
      actor: fullEvent.actor.id,
      resource: fullEvent.resource.id,
      result: fullEvent.result,
    });

    // Persist to database (TODO: implement)
    if (this.persistToDatabase) {
      await this.persistEvent(fullEvent);
    }

    // Alert on critical events
    if (this.isCriticalEvent(fullEvent)) {
      await this.alertOnCriticalEvent(fullEvent);
    }
  }

  /**
   * Log workflow started
   */
  async logWorkflowStarted(
    workflowId: string,
    projectId: string,
    taskId: string,
    actor: AuditActor,
  ): Promise<void> {
    await this.log({
      type: AuditEventType.WORKFLOW_STARTED,
      actor,
      resource: { type: 'workflow', id: workflowId },
      action: 'Started workflow',
      result: 'success',
      context: { projectId, workflowId, taskId },
      tags: ['workflow'],
    });
  }

  /**
   * Log agent invocation
   */
  async logAgentInvoked(
    agentProvider: string,
    model: string,
    operation: string,
    inputTokens: number,
    context: AuditContext,
  ): Promise<void> {
    await this.log({
      type: AuditEventType.AGENT_INVOKED,
      actor: { type: 'agent', id: agentProvider, name: model },
      resource: { type: 'agent', id: agentProvider },
      action: `Agent invoked: ${operation}`,
      result: 'success',
      metadata: { operation, inputTokens },
      context,
      tags: ['agent', agentProvider],
    });
  }

  /**
   * Log agent response
   */
  async logAgentResponse(
    agentProvider: string,
    model: string,
    operation: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    context: AuditContext,
  ): Promise<void> {
    await this.log({
      type: AuditEventType.AGENT_RESPONSE,
      actor: { type: 'agent', id: agentProvider, name: model },
      resource: { type: 'agent', id: agentProvider },
      action: `Agent responded: ${operation}`,
      result: 'success',
      metadata: { operation, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost },
      context,
      tags: ['agent', agentProvider, 'usage'],
    });
  }

  /**
   * Log policy violation
   */
  async logPolicyViolation(
    violationType: string,
    message: string,
    file: string,
    severity: 'error' | 'warning',
    context: AuditContext,
  ): Promise<void> {
    await this.log({
      type: AuditEventType.POLICY_VIOLATION,
      actor: { type: 'system', id: 'policy-guard' },
      resource: { type: 'file', id: file, path: file },
      action: `Policy violation: ${violationType}`,
      result: severity === 'error' ? 'failure' : 'warning',
      metadata: { violationType, message, severity },
      context,
      tags: ['policy', 'violation', violationType],
    });
  }

  /**
   * Log security issue
   */
  async logSecurityIssue(
    issueType: string,
    message: string,
    file: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    context: AuditContext,
  ): Promise<void> {
    await this.log({
      type: AuditEventType.SECURITY_ISSUE,
      actor: { type: 'system', id: 'security-scanner' },
      resource: { type: 'file', id: file, path: file },
      action: `Security issue detected: ${issueType}`,
      result: 'failure',
      metadata: { issueType, message, severity },
      context,
      tags: ['security', 'issue', issueType, severity],
    });
  }

  /**
   * Log budget consumption
   */
  async logBudgetConsumed(
    projectId: string,
    amount: number,
    remaining: number,
    threshold: number,
  ): Promise<void> {
    const result = remaining < threshold ? 'warning' : 'info';

    await this.log({
      type: AuditEventType.BUDGET_CONSUMED,
      actor: { type: 'system', id: 'budget-manager' },
      resource: { type: 'project', id: projectId },
      action: 'Budget consumed',
      result,
      metadata: { amount, remaining, threshold, percentage: (remaining / (remaining + amount)) * 100 },
      context: { projectId },
      tags: ['budget', 'usage'],
    });
  }

  /**
   * Log auto-merge decision
   */
  async logAutoMergeDecision(
    prNumber: number,
    eligible: boolean,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    await this.log({
      type: eligible ? AuditEventType.AUTO_MERGE_ELIGIBLE : AuditEventType.AUTO_MERGE_BLOCKED,
      actor: { type: 'system', id: 'auto-merge-engine' },
      resource: { type: 'pr', id: String(prNumber) },
      action: eligible ? 'Auto-merge eligible' : 'Auto-merge blocked',
      result: eligible ? 'success' : 'warning',
      metadata: { eligible, reason },
      context: { ...context, prNumber },
      tags: ['auto-merge'],
    });
  }

  /**
   * Query audit events
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let results = [...this.events];

    // Filter by types
    if (query.types && query.types.length > 0) {
      results = results.filter((e) => query.types!.includes(e.type));
    }

    // Filter by actor IDs
    if (query.actorIds && query.actorIds.length > 0) {
      results = results.filter((e) => query.actorIds!.includes(e.actor.id));
    }

    // Filter by resource IDs
    if (query.resourceIds && query.resourceIds.length > 0) {
      results = results.filter((e) => query.resourceIds!.includes(e.resource.id));
    }

    // Filter by date range
    if (query.startDate) {
      results = results.filter((e) => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter((e) => e.timestamp <= query.endDate!);
    }

    // Filter by result
    if (query.result) {
      results = results.filter((e) => e.result === query.result);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) =>
        query.tags!.some((tag) => e.tags?.includes(tag)),
      );
    }

    // Filter by project
    if (query.projectId) {
      results = results.filter((e) => e.context?.projectId === query.projectId);
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get audit summary
   */
  async getSummary(projectId?: string): Promise<AuditSummary> {
    let events = this.events;
    if (projectId) {
      events = events.filter((e) => e.context?.projectId === projectId);
    }

    const byType: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};
    let violations = 0;
    let warnings = 0;
    let budgetConsumed = 0;

    for (const event of events) {
      // By type
      byType[event.type] = (byType[event.type] || 0) + 1;

      // By result
      byResult[event.result] = (byResult[event.result] || 0) + 1;

      // Violations and warnings
      if (event.type === AuditEventType.POLICY_VIOLATION) {
        if (event.result === 'failure') violations++;
        if (event.result === 'warning') warnings++;
      }

      // Budget consumed
      if (event.type === AuditEventType.BUDGET_CONSUMED) {
        budgetConsumed += event.metadata?.amount || 0;
      }

      // Actor counts
      actorCounts[event.actor.id] = (actorCounts[event.actor.id] || 0) + 1;
    }

    // Top actors
    const topActors = Object.entries(actorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([actor, count]) => ({ actor, count }));

    return {
      totalEvents: events.length,
      byType,
      byResult,
      violations,
      warnings,
      budgetConsumed,
      topActors,
    };
  }

  /**
   * Export audit trail
   */
  async export(format: 'json' | 'csv', query?: AuditQuery): Promise<string> {
    const events = query ? await this.query(query) : this.events;

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    // CSV format
    const headers = [
      'ID',
      'Timestamp',
      'Type',
      'Actor',
      'Resource',
      'Action',
      'Result',
      'Project',
      'Workflow',
    ];
    const rows = events.map((e) => [
      e.id,
      e.timestamp.toISOString(),
      e.type,
      e.actor.id,
      e.resource.id,
      e.action,
      e.result,
      e.context?.projectId || '',
      e.context?.workflowId || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ============================================
  // Private Helpers
  // ============================================

  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private async persistEvent(event: AuditEvent): Promise<void> {
    // TODO: Persist to PostgreSQL via Prisma
    // await prisma.auditLog.create({ data: event });
  }

  private isCriticalEvent(event: AuditEvent): boolean {
    const criticalTypes = [
      AuditEventType.SECURITY_ISSUE,
      AuditEventType.SECRET_DETECTED,
      AuditEventType.BUDGET_EXCEEDED,
      AuditEventType.WORKFLOW_FAILED,
    ];

    return criticalTypes.includes(event.type) || event.result === 'failure';
  }

  private async alertOnCriticalEvent(event: AuditEvent): Promise<void> {
    // TODO: Send alerts via Slack/Email
    const error = new Error(`Critical audit event: ${event.type} - ${event.action}`);
    logger.error(`Critical audit event`, error);
    logger.info('Event details', { type: event.type, action: event.action, result: event.result });
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

