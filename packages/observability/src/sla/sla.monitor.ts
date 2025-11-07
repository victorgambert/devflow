/**
 * SLA Monitor - Phase 5: Observability
 * SLA tracking, violation detection, and alerting
 */

import { createLogger } from '../logging/structured.logger';
import {
  recordAlert,
  updateSlaCompliance,
  alertsTotal,
} from '../metrics/prometheus.metrics';

const logger = createLogger('SLAMonitor');

// ============================================
// Types
// ============================================

export interface SLADefinition {
  name: string;
  description: string;
  metric: string;
  threshold: number;
  unit: string;
  comparison: 'lt' | 'lte' | 'gt' | 'gte'; // less than, less than or equal, etc.
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
}

export interface SLAViolation {
  slaName: string;
  timestamp: Date;
  actual: number;
  threshold: number;
  severity: string;
  projectId?: string;
  ticketId?: string;
  metadata?: Record<string, any>;
}

export interface SLAStatus {
  slaName: string;
  compliant: boolean;
  current: number;
  threshold: number;
  lastViolation?: Date;
  violationCount: number;
  compliancePercent: number;
}

// ============================================
// Default SLAs
// ============================================

export const DEFAULT_SLAS: Record<string, SLADefinition> = {
  // Workflow SLAs
  workflow_duration: {
    name: 'workflow_duration',
    description: 'Total workflow duration from start to completion',
    metric: 'workflow_duration_seconds',
    threshold: parseInt(process.env.SLA_WORKFLOW_DURATION_SECONDS || '3600', 10), // 1 hour
    unit: 'seconds',
    comparison: 'lte',
    severity: 'warning',
    enabled: true,
  },

  spec_generation_duration: {
    name: 'spec_generation_duration',
    description: 'Spec generation duration',
    metric: 'state_duration_seconds{state="spec_generation"}',
    threshold: parseInt(process.env.SLA_SPEC_DURATION_SECONDS || '300', 10), // 5 minutes
    unit: 'seconds',
    comparison: 'lte',
    severity: 'warning',
    enabled: true,
  },

  code_generation_duration: {
    name: 'code_generation_duration',
    description: 'Code generation duration',
    metric: 'state_duration_seconds{state="code_generation"}',
    threshold: parseInt(process.env.SLA_CODE_DURATION_SECONDS || '600', 10), // 10 minutes
    unit: 'seconds',
    comparison: 'lte',
    severity: 'warning',
    enabled: true,
  },

  ci_duration: {
    name: 'ci_duration',
    description: 'CI check duration',
    metric: 'ci_duration_seconds',
    threshold: parseInt(process.env.SLA_CI_DURATION_SECONDS || '1800', 10), // 30 minutes
    unit: 'seconds',
    comparison: 'lte',
    severity: 'warning',
    enabled: true,
  },

  // Agent SLAs
  agent_latency: {
    name: 'agent_latency',
    description: 'Agent operation latency',
    metric: 'agent_latency_seconds',
    threshold: parseInt(process.env.SLA_AGENT_LATENCY_SECONDS || '120', 10), // 2 minutes
    unit: 'seconds',
    comparison: 'lte',
    severity: 'warning',
    enabled: true,
  },

  // Budget SLAs
  llm_daily_cost: {
    name: 'llm_daily_cost',
    description: 'Daily LLM cost limit',
    metric: 'llm_cost_usd{period="day"}',
    threshold: parseFloat(process.env.SLA_LLM_DAILY_COST_USD || '50.0'),
    unit: 'usd',
    comparison: 'lte',
    severity: 'critical',
    enabled: true,
  },

  budget_remaining: {
    name: 'budget_remaining',
    description: 'Budget remaining threshold',
    metric: 'budget_remaining_percent',
    threshold: parseFloat(process.env.SLA_BUDGET_REMAINING_PERCENT || '10.0'),
    unit: 'percent',
    comparison: 'gte',
    severity: 'warning',
    enabled: true,
  },

  // Quality SLAs
  test_success_rate: {
    name: 'test_success_rate',
    description: 'Test success rate',
    metric: 'test_success_rate_percent',
    threshold: parseFloat(process.env.SLA_TEST_SUCCESS_RATE || '90.0'),
    unit: 'percent',
    comparison: 'gte',
    severity: 'warning',
    enabled: true,
  },

  coverage_threshold: {
    name: 'coverage_threshold',
    description: 'Code coverage threshold',
    metric: 'coverage_percent',
    threshold: parseFloat(process.env.SLA_COVERAGE_THRESHOLD || '80.0'),
    unit: 'percent',
    comparison: 'gte',
    severity: 'info',
    enabled: true,
  },

  // Error Rate SLAs
  workflow_failure_rate: {
    name: 'workflow_failure_rate',
    description: 'Workflow failure rate',
    metric: 'workflow_failure_rate_percent',
    threshold: parseFloat(process.env.SLA_WORKFLOW_FAILURE_RATE || '10.0'),
    unit: 'percent',
    comparison: 'lte',
    severity: 'critical',
    enabled: true,
  },
};

// ============================================
// SLAMonitor Class
// ============================================

export class SLAMonitor {
  private slas: Map<string, SLADefinition>;
  private violations: SLAViolation[];
  private statusMap: Map<string, SLAStatus>;
  private alertCallbacks: Array<(violation: SLAViolation) => void>;

  constructor(customSlas?: Record<string, SLADefinition>) {
    this.slas = new Map();
    this.violations = [];
    this.statusMap = new Map();
    this.alertCallbacks = [];

    // Load default SLAs
    Object.entries(DEFAULT_SLAS).forEach(([name, sla]) => {
      this.slas.set(name, sla);
      this.statusMap.set(name, {
        slaName: name,
        compliant: true,
        current: 0,
        threshold: sla.threshold,
        violationCount: 0,
        compliancePercent: 100,
      });
    });

    // Load custom SLAs
    if (customSlas) {
      Object.entries(customSlas).forEach(([name, sla]) => {
        this.slas.set(name, sla);
        this.statusMap.set(name, {
          slaName: name,
          compliant: true,
          current: 0,
          threshold: sla.threshold,
          violationCount: 0,
          compliancePercent: 100,
        });
      });
    }

    logger.info('SLA Monitor initialized', {
      slaCount: this.slas.size,
      slaNames: Array.from(this.slas.keys()),
    });
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (violation: SLAViolation) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Check SLA compliance
   */
  checkSLA(
    slaName: string,
    actualValue: number,
    context?: {
      projectId?: string;
      ticketId?: string;
      metadata?: Record<string, any>;
    },
  ): boolean {
    const sla = this.slas.get(slaName);
    if (!sla || !sla.enabled) {
      return true; // Consider compliant if SLA not defined or disabled
    }

    const isCompliant = this.evaluateCompliance(sla, actualValue);
    const status = this.statusMap.get(slaName)!;

    // Update status
    status.current = actualValue;
    status.compliant = isCompliant;

    if (!isCompliant) {
      // SLA violation detected
      status.lastViolation = new Date();
      status.violationCount++;

      const violation: SLAViolation = {
        slaName,
        timestamp: new Date(),
        actual: actualValue,
        threshold: sla.threshold,
        severity: sla.severity,
        projectId: context?.projectId,
        ticketId: context?.ticketId,
        metadata: context?.metadata,
      };

      this.violations.push(violation);

      // Log violation
      logger.slaViolation(slaName, actualValue, sla.threshold, {
        severity: sla.severity,
        unit: sla.unit,
        ...context,
      });

      // Record metrics
      recordAlert(
        context?.projectId || 'unknown',
        'sla_violation',
        sla.severity,
      );

      // Trigger alerts
      this.alertCallbacks.forEach(callback => {
        try {
          callback(violation);
        } catch (error) {
          logger.error('Alert callback failed', error as Error);
        }
      });
    }

    // Update compliance percentage (last 100 checks)
    const recentViolations = this.violations
      .filter(v => v.slaName === slaName)
      .filter(v => v.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000) // Last 24h
      .length;
    
    status.compliancePercent = Math.max(0, 100 - (recentViolations / 100) * 100);

    // Update Prometheus gauge
    updateSlaCompliance(
      context?.projectId || 'global',
      slaName,
      status.compliancePercent,
    );

    return isCompliant;
  }

  /**
   * Evaluate compliance based on comparison operator
   */
  private evaluateCompliance(sla: SLADefinition, actual: number): boolean {
    switch (sla.comparison) {
      case 'lt':
        return actual < sla.threshold;
      case 'lte':
        return actual <= sla.threshold;
      case 'gt':
        return actual > sla.threshold;
      case 'gte':
        return actual >= sla.threshold;
      default:
        return true;
    }
  }

  /**
   * Get SLA status
   */
  getStatus(slaName: string): SLAStatus | undefined {
    return this.statusMap.get(slaName);
  }

  /**
   * Get all SLA statuses
   */
  getAllStatuses(): SLAStatus[] {
    return Array.from(this.statusMap.values());
  }

  /**
   * Get recent violations
   */
  getViolations(since?: Date): SLAViolation[] {
    if (!since) {
      return [...this.violations];
    }
    return this.violations.filter(v => v.timestamp >= since);
  }

  /**
   * Get violations for specific SLA
   */
  getViolationsForSLA(slaName: string, since?: Date): SLAViolation[] {
    let violations = this.violations.filter(v => v.slaName === slaName);
    if (since) {
      violations = violations.filter(v => v.timestamp >= since);
    }
    return violations;
  }

  /**
   * Reset SLA statistics
   */
  reset(slaName?: string): void {
    if (slaName) {
      const status = this.statusMap.get(slaName);
      if (status) {
        status.violationCount = 0;
        status.compliancePercent = 100;
        status.lastViolation = undefined;
      }
      this.violations = this.violations.filter(v => v.slaName !== slaName);
    } else {
      this.violations = [];
      this.statusMap.forEach(status => {
        status.violationCount = 0;
        status.compliancePercent = 100;
        status.lastViolation = undefined;
      });
    }
  }

  /**
   * Get SLA summary
   */
  getSummary(): {
    total: number;
    compliant: number;
    violated: number;
    avgCompliance: number;
    criticalViolations: number;
    warningViolations: number;
  } {
    const statuses = Array.from(this.statusMap.values());
    const compliant = statuses.filter(s => s.compliant).length;
    const avgCompliance =
      statuses.reduce((sum, s) => sum + s.compliancePercent, 0) / statuses.length;

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentViolations = this.getViolations(last24h);
    const criticalViolations = recentViolations.filter(v => v.severity === 'critical').length;
    const warningViolations = recentViolations.filter(v => v.severity === 'warning').length;

    return {
      total: statuses.length,
      compliant,
      violated: statuses.length - compliant,
      avgCompliance,
      criticalViolations,
      warningViolations,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const slaMonitor = new SLAMonitor();

// ============================================
// Helper Functions
// ============================================

/**
 * Check workflow duration SLA
 */
export function checkWorkflowDurationSLA(
  durationSeconds: number,
  projectId: string,
  ticketId: string,
): boolean {
  return slaMonitor.checkSLA('workflow_duration', durationSeconds, {
    projectId,
    ticketId,
  });
}

/**
 * Check agent latency SLA
 */
export function checkAgentLatencySLA(
  latencySeconds: number,
  provider: string,
  operation: string,
  projectId: string,
): boolean {
  return slaMonitor.checkSLA('agent_latency', latencySeconds, {
    projectId,
    metadata: { provider, operation },
  });
}

/**
 * Check budget SLA
 */
export function checkBudgetSLA(
  remaining: number,
  projectId: string,
): boolean {
  return slaMonitor.checkSLA('budget_remaining', remaining, {
    projectId,
  });
}

/**
 * Check CI duration SLA
 */
export function checkCiDurationSLA(
  durationSeconds: number,
  projectId: string,
): boolean {
  return slaMonitor.checkSLA('ci_duration', durationSeconds, {
    projectId,
  });
}



