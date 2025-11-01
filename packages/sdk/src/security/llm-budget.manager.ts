/**
 * LLM Budget Manager - Phase 4: Token & Cost Management
 * Tracks LLM usage, enforces quotas, and manages budgets
 */

import { createLogger } from '@devflow/common';
import { auditLogger, AuditEventType } from './audit.logger';

const logger = createLogger('LLMBudgetManager');

// ============================================
// Types
// ============================================

export interface LLMUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}

export interface LLMQuota {
  // Token limits
  maxTokensPerCall?: number;
  maxTokensPerHour?: number;
  maxTokensPerDay?: number;
  maxTokensPerMonth?: number;
  
  // Cost limits (USD)
  maxCostPerCall?: number;
  maxCostPerHour?: number;
  maxCostPerDay?: number;
  maxCostPerMonth?: number;
  
  // Rate limiting
  maxCallsPerMinute?: number;
  maxCallsPerHour?: number;
}

export interface BudgetStatus {
  period: 'hour' | 'day' | 'month';
  current: {
    tokens: number;
    cost: number;
    calls: number;
  };
  limits: {
    tokens?: number;
    cost?: number;
    calls?: number;
  };
  percentUsed: {
    tokens?: number;
    cost?: number;
    calls?: number;
  };
  exceeded: boolean;
}

// Pricing (as of Nov 2024, USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  
  // OpenAI
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
};

// ============================================
// LLMBudgetManager Class
// ============================================

export class LLMBudgetManager {
  private usageHistory: LLMUsage[] = [];
  private quota: LLMQuota;
  private callTimestamps: Date[] = [];

  constructor(quota: LLMQuota = {}) {
    this.quota = {
      // Default quotas
      maxTokensPerCall: 100000,
      maxTokensPerDay: 1000000,
      maxCostPerDay: 50.00,
      maxCallsPerMinute: 10,
      ...quota,
    };
  }

  /**
   * Check if an LLM call is allowed under current quotas
   */
  async checkQuota(
    provider: string,
    model: string,
    estimatedInputTokens: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check rate limiting
    const rateCheck = this.checkRateLimit();
    if (!rateCheck.allowed) {
      return rateCheck;
    }

    // Check per-call token limit
    if (this.quota.maxTokensPerCall && estimatedInputTokens > this.quota.maxTokensPerCall) {
      const reason = `Input tokens (${estimatedInputTokens}) exceeds per-call limit (${this.quota.maxTokensPerCall})`;
      logger.warn(reason);
      auditLogger.logQuotaExceeded('tokens_per_call', estimatedInputTokens, this.quota.maxTokensPerCall);
      return { allowed: false, reason };
    }

    // Check daily token limit
    if (this.quota.maxTokensPerDay) {
      const dayStatus = this.getStatus('day');
      const projectedTokens = dayStatus.current.tokens + estimatedInputTokens * 2; // Estimate output ~= input

      if (projectedTokens > (this.quota.maxTokensPerDay || Infinity)) {
        const reason = `Daily token quota would be exceeded: ${projectedTokens}/${this.quota.maxTokensPerDay}`;
        logger.warn(reason);
        auditLogger.logQuotaExceeded('tokens_per_day', projectedTokens, this.quota.maxTokensPerDay);
        return { allowed: false, reason };
      }
    }

    // Check daily cost limit
    if (this.quota.maxCostPerDay) {
      const dayStatus = this.getStatus('day');
      const estimatedCost = this.calculateCost(model, estimatedInputTokens, estimatedInputTokens); // Rough estimate
      const projectedCost = dayStatus.current.cost + estimatedCost;

      if (projectedCost > (this.quota.maxCostPerDay || Infinity)) {
        const reason = `Daily cost quota would be exceeded: $${projectedCost.toFixed(2)}/$${this.quota.maxCostPerDay.toFixed(2)}`;
        logger.warn(reason);
        auditLogger.logQuotaExceeded('cost_per_day', projectedCost, this.quota.maxCostPerDay);
        return { allowed: false, reason };
      }
    }

    return { allowed: true };
  }

  /**
   * Record LLM usage after a call
   */
  recordUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const cost = this.calculateCost(model, inputTokens, outputTokens);

    const usage: LLMUsage = {
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      timestamp: new Date(),
    };

    this.usageHistory.push(usage);
    this.callTimestamps.push(new Date());

    // Log to audit
    auditLogger.logLLMCall(provider, model, inputTokens, outputTokens, cost);

    // Log warning if approaching limits
    const dayStatus = this.getStatus('day');
    if (dayStatus.percentUsed.cost && dayStatus.percentUsed.cost > 80) {
      logger.warn('Approaching daily cost limit', {
        used: dayStatus.current.cost,
        limit: dayStatus.limits.cost,
        percent: dayStatus.percentUsed.cost,
      });

      auditLogger.log({
        type: AuditEventType.QUOTA_WARNING,
        actor: 'system',
        resource: 'budget:daily_cost',
        action: 'quota_check',
        metadata: dayStatus,
        result: 'warning',
      });
    }

    // Clean old usage (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.usageHistory = this.usageHistory.filter(u => u.timestamp >= thirtyDaysAgo);
  }

  /**
   * Get budget status for a period
   */
  getStatus(period: 'hour' | 'day' | 'month'): BudgetStatus {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodUsage = this.usageHistory.filter(u => u.timestamp >= startTime);

    const current = {
      tokens: periodUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      cost: periodUsage.reduce((sum, u) => sum + u.cost, 0),
      calls: periodUsage.length,
    };

    const limits = {
      tokens: period === 'day' ? this.quota.maxTokensPerDay : period === 'hour' ? this.quota.maxTokensPerHour : this.quota.maxTokensPerMonth,
      cost: period === 'day' ? this.quota.maxCostPerDay : period === 'hour' ? this.quota.maxCostPerHour : this.quota.maxCostPerMonth,
    };

    const percentUsed = {
      tokens: limits.tokens ? (current.tokens / limits.tokens) * 100 : undefined,
      cost: limits.cost ? (current.cost / limits.cost) * 100 : undefined,
    };

    const exceeded = 
      (limits.tokens !== undefined && current.tokens > limits.tokens) ||
      (limits.cost !== undefined && current.cost > limits.cost);

    return {
      period,
      current,
      limits,
      percentUsed,
      exceeded,
    };
  }

  /**
   * Get usage summary
   */
  getSummary(): {
    total: { tokens: number; cost: number; calls: number };
    byProvider: Record<string, { tokens: number; cost: number; calls: number }>;
    byModel: Record<string, { tokens: number; cost: number; calls: number }>;
    last24h: { tokens: number; cost: number; calls: number };
  } {
    const summary = {
      total: { tokens: 0, cost: 0, calls: this.usageHistory.length },
      byProvider: {} as Record<string, { tokens: number; cost: number; calls: number }>,
      byModel: {} as Record<string, { tokens: number; cost: number; calls: number }>,
      last24h: { tokens: 0, cost: 0, calls: 0 },
    };

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const usage of this.usageHistory) {
      // Total
      summary.total.tokens += usage.totalTokens;
      summary.total.cost += usage.cost;

      // By provider
      if (!summary.byProvider[usage.provider]) {
        summary.byProvider[usage.provider] = { tokens: 0, cost: 0, calls: 0 };
      }
      summary.byProvider[usage.provider].tokens += usage.totalTokens;
      summary.byProvider[usage.provider].cost += usage.cost;
      summary.byProvider[usage.provider].calls++;

      // By model
      if (!summary.byModel[usage.model]) {
        summary.byModel[usage.model] = { tokens: 0, cost: 0, calls: 0 };
      }
      summary.byModel[usage.model].tokens += usage.totalTokens;
      summary.byModel[usage.model].cost += usage.cost;
      summary.byModel[usage.model].calls++;

      // Last 24h
      if (usage.timestamp >= dayAgo) {
        summary.last24h.tokens += usage.totalTokens;
        summary.last24h.cost += usage.cost;
        summary.last24h.calls++;
      }
    }

    return summary;
  }

  /**
   * Calculate cost for tokens
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model];
    if (!pricing) {
      logger.warn('Unknown model pricing', { model });
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): { allowed: boolean; reason?: string } {
    const now = new Date();

    // Clean old timestamps
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    this.callTimestamps = this.callTimestamps.filter(t => t >= oneHourAgo);

    // Check per-minute limit
    if (this.quota.maxCallsPerMinute) {
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const callsLastMinute = this.callTimestamps.filter(t => t >= oneMinuteAgo).length;

      if (callsLastMinute >= this.quota.maxCallsPerMinute) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${callsLastMinute}/${this.quota.maxCallsPerMinute} calls per minute`,
        };
      }
    }

    // Check per-hour limit
    if (this.quota.maxCallsPerHour) {
      const callsLastHour = this.callTimestamps.length;

      if (callsLastHour >= this.quota.maxCallsPerHour) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${callsLastHour}/${this.quota.maxCallsPerHour} calls per hour`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Reset quotas (for testing)
   */
  reset(): void {
    this.usageHistory = [];
    this.callTimestamps = [];
    logger.info('Budget manager reset');
  }
}

