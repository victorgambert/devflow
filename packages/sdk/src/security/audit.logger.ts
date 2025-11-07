/**
 * Audit Logger - Phase 4: Complete Traceability
 * Logs all operations for audit trail
 */

import { createLogger } from '@soma-squad-ai/common';

const logger = createLogger('AuditLogger');

// ============================================
// Types
// ============================================

export enum AuditEventType {
  // Workflow events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  
  // File operations
  FILE_READ = 'file.read',
  FILE_WRITE = 'file.write',
  FILE_DELETE = 'file.delete',
  
  // Git operations
  BRANCH_CREATED = 'git.branch_created',
  COMMIT_CREATED = 'git.commit_created',
  PR_CREATED = 'git.pr_created',
  PR_MERGED = 'git.pr_merged',
  
  // Agent operations
  AGENT_INVOCATION = 'agent.invocation',
  CODE_GENERATED = 'agent.code_generated',
  TESTS_GENERATED = 'agent.tests_generated',
  FIX_GENERATED = 'agent.fix_generated',
  
  // Security events
  POLICY_VIOLATION = 'security.policy_violation',
  SECRET_DETECTED = 'security.secret_detected',
  CODEOWNERS_CHECK = 'security.codeowners_check',
  
  // Budget events
  LLM_CALL = 'budget.llm_call',
  QUOTA_WARNING = 'budget.quota_warning',
  QUOTA_EXCEEDED = 'budget.quota_exceeded',
  
  // Review events
  REVIEW_REQUIRED = 'review.required',
  REVIEW_APPROVED = 'review.approved',
  REVIEW_REJECTED = 'review.rejected',
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  actor: string; // User, system, agent
  resource: string; // File, PR, workflow, etc.
  action: string;
  metadata?: Record<string, any>;
  result: 'success' | 'failure' | 'warning';
  duration?: number;
  error?: string;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  types?: AuditEventType[];
  actors?: string[];
  resources?: string[];
  results?: ('success' | 'failure' | 'warning')[];
}

// ============================================
// AuditLogger Class
// ============================================

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents = 10000; // Keep last 10k events in memory

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(auditEvent);

    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console (structured)
    logger.info('Audit event', {
      eventId: auditEvent.id,
      type: auditEvent.type,
      actor: auditEvent.actor,
      resource: auditEvent.resource,
      result: auditEvent.result,
    });

    // TODO: Persist to database or external audit service
  }

  /**
   * Log workflow start
   */
  logWorkflowStart(workflowId: string, projectId: string, taskId: string, actor: string): void {
    this.log({
      type: AuditEventType.WORKFLOW_STARTED,
      actor,
      resource: `workflow:${workflowId}`,
      action: 'start',
      metadata: { projectId, taskId },
      result: 'success',
    });
  }

  /**
   * Log workflow completion
   */
  logWorkflowComplete(
    workflowId: string,
    duration: number,
    metrics: Record<string, any>,
  ): void {
    this.log({
      type: AuditEventType.WORKFLOW_COMPLETED,
      actor: 'system',
      resource: `workflow:${workflowId}`,
      action: 'complete',
      metadata: metrics,
      result: 'success',
      duration,
    });
  }

  /**
   * Log file write operation
   */
  logFileWrite(filePath: string, actor: string, reason: string): void {
    this.log({
      type: AuditEventType.FILE_WRITE,
      actor,
      resource: `file:${filePath}`,
      action: 'write',
      metadata: { reason },
      result: 'success',
    });
  }

  /**
   * Log agent invocation
   */
  logAgentInvocation(
    provider: string,
    model: string,
    operation: string,
    duration: number,
    inputTokens: number,
    outputTokens: number,
    cost?: number,
  ): void {
    this.log({
      type: AuditEventType.AGENT_INVOCATION,
      actor: `agent:${provider}`,
      resource: model,
      action: operation,
      metadata: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
      },
      result: 'success',
      duration,
    });
  }

  /**
   * Log policy violation
   */
  logPolicyViolation(
    violationType: string,
    resource: string,
    actor: string,
    details: any,
  ): void {
    this.log({
      type: AuditEventType.POLICY_VIOLATION,
      actor,
      resource,
      action: 'policy_check',
      metadata: { violationType, details },
      result: 'failure',
    });
  }

  /**
   * Log secret detection
   */
  logSecretDetected(filePath: string, secretType: string, actor: string): void {
    this.log({
      type: AuditEventType.SECRET_DETECTED,
      actor,
      resource: `file:${filePath}`,
      action: 'secret_scan',
      metadata: { secretType },
      result: 'warning',
    });
  }

  /**
   * Log LLM call for budget tracking
   */
  logLLMCall(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
  ): void {
    this.log({
      type: AuditEventType.LLM_CALL,
      actor: `llm:${provider}`,
      resource: model,
      action: 'api_call',
      metadata: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
      },
      result: 'success',
    });
  }

  /**
   * Log quota exceeded
   */
  logQuotaExceeded(quotaType: string, current: number, limit: number): void {
    this.log({
      type: AuditEventType.QUOTA_EXCEEDED,
      actor: 'system',
      resource: `quota:${quotaType}`,
      action: 'quota_check',
      metadata: { current, limit, exceeded: current - limit },
      result: 'failure',
    });
  }

  /**
   * Query audit events
   */
  query(query: AuditQuery): AuditEvent[] {
    return this.events.filter(event => {
      // Filter by date range
      if (query.startDate && event.timestamp < query.startDate) {
        return false;
      }
      if (query.endDate && event.timestamp > query.endDate) {
        return false;
      }

      // Filter by types
      if (query.types && !query.types.includes(event.type)) {
        return false;
      }

      // Filter by actors
      if (query.actors && !query.actors.includes(event.actor)) {
        return false;
      }

      // Filter by resources
      if (query.resources && !query.resources.some(r => event.resource.includes(r))) {
        return false;
      }

      // Filter by results
      if (query.results && !query.results.includes(event.result)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get events summary
   */
  getSummary(query?: AuditQuery): {
    total: number;
    byType: Record<string, number>;
    byResult: Record<string, number>;
    byActor: Record<string, number>;
  } {
    const events = query ? this.query(query) : this.events;

    const summary = {
      total: events.length,
      byType: {} as Record<string, number>,
      byResult: {} as Record<string, number>,
      byActor: {} as Record<string, number>,
    };

    for (const event of events) {
      // Count by type
      summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;

      // Count by result
      summary.byResult[event.result] = (summary.byResult[event.result] || 0) + 1;

      // Count by actor
      summary.byActor[event.actor] = (summary.byActor[event.actor] || 0) + 1;
    }

    return summary;
  }

  /**
   * Export events (for external audit systems)
   */
  export(query?: AuditQuery): string {
    const events = query ? this.query(query) : this.events;
    return JSON.stringify(events, null, 2);
  }

  /**
   * Clear all events (use with caution!)
   */
  clear(): void {
    logger.warn('Clearing all audit events');
    this.events = [];
  }

  // Private helpers

  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();



