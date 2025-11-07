/**
 * LLM Budget Manager - Phase 4 Security & Governance
 * Manages LLM usage quotas, costs, and budget enforcement
 */

import { createLogger } from '@soma-squad-ai/common';
import { auditLogger, AuditEventType } from './audit.logger';

const logger = createLogger('BudgetManager');

// ============================================
// Types
// ============================================

export interface LLMUsage {
  provider: 'anthropic' | 'openai' | 'cursor';
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
  projectId?: string;
  workflowId?: string;
}

export interface BudgetConfig {
  // Total budget limits
  daily?: number;
  weekly?: number;
  monthly?: number;
  perWorkflow?: number;
  perProject?: number;

  // Token limits
  maxTokensPerRequest?: number;
  maxTokensPerWorkflow?: number;
  maxTokensPerDay?: number;

  // Cost limits
  maxCostPerRequest?: number;
  maxCostPerWorkflow?: number;
  maxCostPerDay?: number;

  // Warning thresholds (percentage)
  warningThreshold?: number; // Default: 80%
  
  // Actions on limit exceeded
  blockOnExceeded?: boolean; // Default: true
  alertOnExceeded?: boolean; // Default: true
}

export interface BudgetStatus {
  period: 'daily' | 'weekly' | 'monthly' | 'workflow' | 'project';
  limit: number;
  consumed: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface CostBreakdown {
  totalCost: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
  byProject: Record<string, number>;
  totalTokens: number;
  requests: number;
}

// Pricing (USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  
  // OpenAI
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  
  // Default (if model unknown)
  'default': { input: 10.0, output: 30.0 },
};

// ============================================
// BudgetManager Class
// ============================================

export class BudgetManager {
  private config: BudgetConfig;
  private usage: LLMUsage[] = [];
  private currentWorkflowCosts: Map<string, number> = new Map();
  private currentProjectCosts: Map<string, number> = new Map();

  constructor(config: BudgetConfig) {
    this.config = {
      warningThreshold: 80,
      blockOnExceeded: true,
      alertOnExceeded: true,
      ...config,
    };
    logger.info('Budget manager initialized', this.config);
  }

  /**
   * Calculate cost for LLM usage
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model] || PRICING['default'];
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Record LLM usage
   */
  async recordUsage(
    provider: string,
    model: string,
    operation: string,
    inputTokens: number,
    outputTokens: number,
    context?: { projectId?: string; workflowId?: string },
  ): Promise<LLMUsage> {
    const cost = this.calculateCost(model, inputTokens, outputTokens);
    const totalTokens = inputTokens + outputTokens;

    const usage: LLMUsage = {
      provider: provider as any,
      model,
      operation,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      timestamp: new Date(),
      projectId: context?.projectId,
      workflowId: context?.workflowId,
    };

    this.usage.push(usage);

    // Update running totals
    if (context?.workflowId) {
      const currentCost = this.currentWorkflowCosts.get(context.workflowId) || 0;
      this.currentWorkflowCosts.set(context.workflowId, currentCost + cost);
    }

    if (context?.projectId) {
      const currentCost = this.currentProjectCosts.get(context.projectId) || 0;
      this.currentProjectCosts.set(context.projectId, currentCost + cost);
    }

    // Log to audit
    await auditLogger.logAgentResponse(
      provider,
      model,
      operation,
      inputTokens,
      outputTokens,
      cost,
      { projectId: context?.projectId, workflowId: context?.workflowId },
    );

    logger.info('LLM usage recorded', {
      provider,
      model,
      operation,
      cost: `$${cost.toFixed(4)}`,
      tokens: totalTokens,
    });

    return usage;
  }

  /**
   * Check if operation is within budget
   */
  async checkBudget(
    estimatedTokens: number,
    context?: { projectId?: string; workflowId?: string },
  ): Promise<{ allowed: boolean; reason?: string; status: BudgetStatus[] }> {
    const estimatedCost = this.calculateCost('default', estimatedTokens, estimatedTokens);
    const statuses: BudgetStatus[] = [];

    // Check workflow budget
    if (context?.workflowId && this.config.perWorkflow) {
      const consumed = this.currentWorkflowCosts.get(context.workflowId) || 0;
      const newTotal = consumed + estimatedCost;
      
      const status = this.getBudgetStatus('workflow', this.config.perWorkflow, newTotal);
      statuses.push(status);

      if (status.status === 'exceeded' && this.config.blockOnExceeded) {
        return {
          allowed: false,
          reason: `Workflow budget exceeded ($${newTotal.toFixed(2)} / $${this.config.perWorkflow})`,
          status: statuses,
        };
      }
    }

    // Check project budget
    if (context?.projectId && this.config.perProject) {
      const consumed = this.currentProjectCosts.get(context.projectId) || 0;
      const newTotal = consumed + estimatedCost;
      
      const status = this.getBudgetStatus('project', this.config.perProject, newTotal);
      statuses.push(status);

      if (status.status === 'exceeded' && this.config.blockOnExceeded) {
        return {
          allowed: false,
          reason: `Project budget exceeded ($${newTotal.toFixed(2)} / $${this.config.perProject})`,
          status: statuses,
        };
      }
    }

    // Check daily budget
    if (this.config.daily) {
      const dailyCost = this.getDailySpend();
      const newTotal = dailyCost + estimatedCost;
      
      const status = this.getBudgetStatus('daily', this.config.daily, newTotal);
      statuses.push(status);

      if (status.status === 'exceeded' && this.config.blockOnExceeded) {
        return {
          allowed: false,
          reason: `Daily budget exceeded ($${newTotal.toFixed(2)} / $${this.config.daily})`,
          status: statuses,
        };
      }
    }

    // Check token limits
    if (this.config.maxTokensPerRequest && estimatedTokens > this.config.maxTokensPerRequest) {
      return {
        allowed: false,
        reason: `Request exceeds max tokens (${estimatedTokens} / ${this.config.maxTokensPerRequest})`,
        status: statuses,
      };
    }

    // Log warnings
    for (const status of statuses) {
      if (status.status === 'warning') {
        await auditLogger.log({
          type: AuditEventType.BUDGET_WARNING,
          actor: { type: 'system', id: 'budget-manager' },
          resource: { type: 'project', id: context?.projectId || 'unknown' },
          action: `Budget warning: ${status.period}`,
          result: 'warning',
          metadata: status,
          context,
          tags: ['budget', 'warning'],
        });
      }
    }

    return { allowed: true, status: statuses };
  }

  /**
   * Get budget status for period
   */
  getBudgetStatus(period: string, limit: number, consumed: number): BudgetStatus {
    const remaining = Math.max(0, limit - consumed);
    const percentage = (consumed / limit) * 100;
    
    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= (this.config.warningThreshold || 80)) {
      status = 'warning';
    }

    return {
      period: period as any,
      limit,
      consumed,
      remaining,
      percentage,
      status,
    };
  }

  /**
   * Get daily spend
   */
  getDailySpend(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.usage
      .filter((u) => u.timestamp >= today)
      .reduce((sum, u) => sum + u.cost, 0);
  }

  /**
   * Get weekly spend
   */
  getWeeklySpend(): number {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.usage
      .filter((u) => u.timestamp >= weekAgo)
      .reduce((sum, u) => sum + u.cost, 0);
  }

  /**
   * Get monthly spend
   */
  getMonthlySpend(): number {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return this.usage
      .filter((u) => u.timestamp >= monthAgo)
      .reduce((sum, u) => sum + u.cost, 0);
  }

  /**
   * Get workflow spend
   */
  getWorkflowSpend(workflowId: string): number {
    return this.currentWorkflowCosts.get(workflowId) || 0;
  }

  /**
   * Get project spend
   */
  getProjectSpend(projectId: string): number {
    return this.currentProjectCosts.get(projectId) || 0;
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown(startDate?: Date, endDate?: Date): CostBreakdown {
    let filtered = this.usage;

    if (startDate) {
      filtered = filtered.filter((u) => u.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((u) => u.timestamp <= endDate);
    }

    const breakdown: CostBreakdown = {
      totalCost: 0,
      byProvider: {},
      byModel: {},
      byOperation: {},
      byProject: {},
      totalTokens: 0,
      requests: filtered.length,
    };

    for (const usage of filtered) {
      breakdown.totalCost += usage.cost;
      breakdown.totalTokens += usage.totalTokens;

      breakdown.byProvider[usage.provider] = (breakdown.byProvider[usage.provider] || 0) + usage.cost;
      breakdown.byModel[usage.model] = (breakdown.byModel[usage.model] || 0) + usage.cost;
      breakdown.byOperation[usage.operation] = (breakdown.byOperation[usage.operation] || 0) + usage.cost;
      
      if (usage.projectId) {
        breakdown.byProject[usage.projectId] = (breakdown.byProject[usage.projectId] || 0) + usage.cost;
      }
    }

    return breakdown;
  }

  /**
   * Reset workflow budget
   */
  resetWorkflowBudget(workflowId: string): void {
    this.currentWorkflowCosts.delete(workflowId);
    logger.info('Workflow budget reset', { workflowId });
  }

  /**
   * Get usage report
   */
  getUsageReport(): {
    daily: BudgetStatus | null;
    weekly: BudgetStatus | null;
    monthly: BudgetStatus | null;
    breakdown: CostBreakdown;
    topProjects: Array<{ projectId: string; cost: number }>;
    topModels: Array<{ model: string; cost: number }>;
  } {
    const breakdown = this.getCostBreakdown();

    // Top projects
    const topProjects = Object.entries(breakdown.byProject)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([projectId, cost]) => ({ projectId, cost }));

    // Top models
    const topModels = Object.entries(breakdown.byModel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([model, cost]) => ({ model, cost }));

    return {
      daily: this.config.daily
        ? this.getBudgetStatus('daily', this.config.daily, this.getDailySpend())
        : null,
      weekly: this.config.weekly
        ? this.getBudgetStatus('weekly', this.config.weekly, this.getWeeklySpend())
        : null,
      monthly: this.config.monthly
        ? this.getBudgetStatus('monthly', this.config.monthly, this.getMonthlySpend())
        : null,
      breakdown,
      topProjects,
      topModels,
    };
  }

  /**
   * Export usage data
   */
  exportUsage(format: 'json' | 'csv', startDate?: Date, endDate?: Date): string {
    let filtered = this.usage;

    if (startDate) {
      filtered = filtered.filter((u) => u.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((u) => u.timestamp <= endDate);
    }

    if (format === 'json') {
      return JSON.stringify(filtered, null, 2);
    }

    // CSV
    const headers = [
      'Timestamp',
      'Provider',
      'Model',
      'Operation',
      'Input Tokens',
      'Output Tokens',
      'Total Tokens',
      'Cost (USD)',
      'Project ID',
      'Workflow ID',
    ];

    const rows = filtered.map((u) => [
      u.timestamp.toISOString(),
      u.provider,
      u.model,
      u.operation,
      u.inputTokens,
      u.outputTokens,
      u.totalTokens,
      u.cost.toFixed(6),
      u.projectId || '',
      u.workflowId || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

