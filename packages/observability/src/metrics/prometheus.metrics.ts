/**
 * Prometheus Metrics - Phase 5: Observability
 * Centralized metrics collection for API and Worker
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// ============================================
// Registry Setup
// ============================================

export const metricsRegistry = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'soma_squad_ai_',
  labels: { app: 'soma_squad_ai' },
});

// ============================================
// Counters
// ============================================

/**
 * Tickets total by state
 */
export const ticketsTotal = new Counter({
  name: 'soma_squad_ai_tickets_total',
  help: 'Total number of tickets processed by state',
  labelNames: ['state', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * Agent commits total by provider
 */
export const agentCommitsTotal = new Counter({
  name: 'soma_squad_ai_agent_commits_total',
  help: 'Total number of commits made by agents',
  labelNames: ['provider', 'project_id', 'phase'],
  registers: [metricsRegistry],
});

/**
 * CI checks total by status
 */
export const ciChecksTotal = new Counter({
  name: 'soma_squad_ai_ci_checks_total',
  help: 'Total number of CI checks by status',
  labelNames: ['status', 'project_id', 'check_type'],
  registers: [metricsRegistry],
});

/**
 * Alerts total by type
 */
export const alertsTotal = new Counter({
  name: 'soma_squad_ai_alerts_total',
  help: 'Total number of alerts triggered',
  labelNames: ['type', 'severity', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * Workflow executions total
 */
export const workflowExecutionsTotal = new Counter({
  name: 'soma_squad_ai_workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['status', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * Policy violations total
 */
export const policyViolationsTotal = new Counter({
  name: 'soma_squad_ai_policy_violations_total',
  help: 'Total number of policy violations',
  labelNames: ['type', 'severity', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * Security issues total
 */
export const securityIssuesTotal = new Counter({
  name: 'soma_squad_ai_security_issues_total',
  help: 'Total number of security issues detected',
  labelNames: ['type', 'severity', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * LLM API calls total
 */
export const llmApiCallsTotal = new Counter({
  name: 'soma_squad_ai_llm_api_calls_total',
  help: 'Total number of LLM API calls',
  labelNames: ['provider', 'model', 'operation'],
  registers: [metricsRegistry],
});

/**
 * LLM tokens total
 */
export const llmTokensTotal = new Counter({
  name: 'soma_squad_ai_llm_tokens_total',
  help: 'Total number of LLM tokens used',
  labelNames: ['provider', 'model', 'type'], // type: input, output
  registers: [metricsRegistry],
});

// ============================================
// Histograms
// ============================================

/**
 * State duration in seconds
 */
export const stateDuration = new Histogram({
  name: 'soma_squad_ai_state_duration_seconds',
  help: 'Duration of time spent in each state',
  labelNames: ['state', 'project_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600], // 1s to 1h
  registers: [metricsRegistry],
});

/**
 * Workflow duration (Spec → Done)
 */
export const workflowDuration = new Histogram({
  name: 'soma_squad_ai_workflow_duration_seconds',
  help: 'Total duration of workflow from start to completion',
  labelNames: ['project_id', 'status'],
  buckets: [60, 300, 600, 1200, 1800, 3600, 7200, 14400], // 1min to 4h
  registers: [metricsRegistry],
});

/**
 * CI duration
 */
export const ciDuration = new Histogram({
  name: 'soma_squad_ai_ci_duration_seconds',
  help: 'Duration of CI checks',
  labelNames: ['project_id', 'status'],
  buckets: [10, 30, 60, 120, 300, 600, 900, 1800], // 10s to 30min
  registers: [metricsRegistry],
});

/**
 * Agent latency by phase
 */
export const agentLatency = new Histogram({
  name: 'soma_squad_ai_agent_latency_seconds',
  help: 'Latency of agent operations',
  labelNames: ['phase', 'provider', 'model'],
  buckets: [1, 5, 10, 20, 30, 60, 120, 180], // 1s to 3min
  registers: [metricsRegistry],
});

/**
 * API request duration
 */
export const apiRequestDuration = new Histogram({
  name: 'soma_squad_ai_api_request_duration_seconds',
  help: 'Duration of API requests',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Database query duration
 */
export const dbQueryDuration = new Histogram({
  name: 'soma_squad_ai_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [metricsRegistry],
});

// ============================================
// Gauges
// ============================================

/**
 * Tickets in progress by state
 */
export const ticketsInProgress = new Gauge({
  name: 'soma_squad_ai_tickets_in_progress',
  help: 'Number of tickets currently in each state',
  labelNames: ['state', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * LLM cost (current estimated)
 */
export const llmCostUsd = new Gauge({
  name: 'soma_squad_ai_llm_cost_usd',
  help: 'Current estimated LLM cost in USD',
  labelNames: ['provider', 'period'], // period: hour, day, month
  registers: [metricsRegistry],
});

/**
 * Retry pending count
 */
export const retryPending = new Gauge({
  name: 'soma_squad_ai_retry_pending',
  help: 'Number of workflows/tasks pending retry',
  labelNames: ['ticket_id', 'project_id', 'reason'],
  registers: [metricsRegistry],
});

/**
 * Active workflows
 */
export const activeWorkflows = new Gauge({
  name: 'soma_squad_ai_active_workflows',
  help: 'Number of currently active workflows',
  labelNames: ['project_id'],
  registers: [metricsRegistry],
});

/**
 * Queue size
 */
export const queueSize = new Gauge({
  name: 'soma_squad_ai_queue_size',
  help: 'Number of items in processing queue',
  labelNames: ['queue_name', 'project_id'],
  registers: [metricsRegistry],
});

/**
 * Budget remaining (percentage)
 */
export const budgetRemaining = new Gauge({
  name: 'soma_squad_ai_budget_remaining_percent',
  help: 'Percentage of budget remaining',
  labelNames: ['quota_type', 'project_id'], // quota_type: tokens, cost, calls
  registers: [metricsRegistry],
});

/**
 * SLA compliance (percentage)
 */
export const slaCompliance = new Gauge({
  name: 'soma_squad_ai_sla_compliance_percent',
  help: 'SLA compliance percentage',
  labelNames: ['sla_name', 'project_id'],
  registers: [metricsRegistry],
});

// ============================================
// Helper Functions
// ============================================

/**
 * Record workflow start
 */
export function recordWorkflowStart(projectId: string): void {
  activeWorkflows.inc({ project_id: projectId });
  workflowExecutionsTotal.inc({ status: 'started', project_id: projectId });
}

/**
 * Record workflow completion
 */
export function recordWorkflowComplete(
  projectId: string,
  durationSeconds: number,
  success: boolean,
): void {
  activeWorkflows.dec({ project_id: projectId });
  workflowExecutionsTotal.inc({
    status: success ? 'completed' : 'failed',
    project_id: projectId,
  });
  workflowDuration.observe(
    { project_id: projectId, status: success ? 'success' : 'failure' },
    durationSeconds,
  );
}

/**
 * Record state transition
 */
export function recordStateTransition(
  projectId: string,
  fromState: string,
  toState: string,
  durationSeconds: number,
): void {
  ticketsTotal.inc({ state: toState, project_id: projectId });
  stateDuration.observe({ state: fromState, project_id: projectId }, durationSeconds);
  ticketsInProgress.dec({ state: fromState, project_id: projectId });
  ticketsInProgress.inc({ state: toState, project_id: projectId });
}

/**
 * Record agent operation
 */
export function recordAgentOperation(
  provider: string,
  model: string,
  phase: string,
  durationSeconds: number,
  inputTokens: number,
  outputTokens: number,
): void {
  llmApiCallsTotal.inc({ provider, model, operation: phase });
  llmTokensTotal.inc({ provider, model, type: 'input' }, inputTokens);
  llmTokensTotal.inc({ provider, model, type: 'output' }, outputTokens);
  agentLatency.observe({ phase, provider, model }, durationSeconds);
}

/**
 * Record CI check
 */
export function recordCiCheck(
  projectId: string,
  checkType: string,
  status: string,
  durationSeconds: number,
): void {
  ciChecksTotal.inc({ status, project_id: projectId, check_type: checkType });
  ciDuration.observe({ project_id: projectId, status }, durationSeconds);
}

/**
 * Record alert
 */
export function recordAlert(projectId: string, type: string, severity: string): void {
  alertsTotal.inc({ type, severity, project_id: projectId });
}

/**
 * Record policy violation
 */
export function recordPolicyViolation(
  projectId: string,
  type: string,
  severity: string,
): void {
  policyViolationsTotal.inc({ type, severity, project_id: projectId });
}

/**
 * Record security issue
 */
export function recordSecurityIssue(projectId: string, type: string, severity: string): void {
  securityIssuesTotal.inc({ type, severity, project_id: projectId });
}

/**
 * Update LLM cost
 */
export function updateLlmCost(provider: string, period: string, costUsd: number): void {
  llmCostUsd.set({ provider, period }, costUsd);
}

/**
 * Update budget remaining
 */
export function updateBudgetRemaining(
  projectId: string,
  quotaType: string,
  percentRemaining: number,
): void {
  budgetRemaining.set({ quota_type: quotaType, project_id: projectId }, percentRemaining);
}

/**
 * Update SLA compliance
 */
export function updateSlaCompliance(
  projectId: string,
  slaName: string,
  percentCompliance: number,
): void {
  slaCompliance.set({ sla_name: slaName, project_id: projectId }, percentCompliance);
}

/**
 * Get metrics as Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}



