/**
 * Usage Metering Service - Phase 10
 * Tracks and records usage metrics for billing
 */

import { PrismaClient } from '@prisma/client';

// Local type definitions (normally from Prisma schema)
export enum UsageType {
  AI_REQUESTS = 'AI_REQUESTS',
  WORKFLOW_RUNS = 'WORKFLOW_RUNS',
  CI_MINUTES = 'CI_MINUTES',
  STORAGE = 'STORAGE',
  USERS = 'USERS',
  TICKET_PROCESSED = 'TICKET_PROCESSED',
  LLM_TOKENS_INPUT = 'LLM_TOKENS_INPUT',
  LLM_TOKENS_OUTPUT = 'LLM_TOKENS_OUTPUT',
  PREVIEW_DEPLOY = 'PREVIEW_DEPLOY',
  PREVIEW_HOURS = 'PREVIEW_HOURS',
  STORAGE_GB_HOURS = 'STORAGE_GB_HOURS',
  API_CALLS = 'API_CALLS',
}

export interface UsageMetric {
  organizationId: string;
  type: UsageType;
  quantity: number;
  unit: string;
  unitPrice: number;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface UsageSummary {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  breakdown: UsageBreakdown[];
  totalCost: number;
}

export interface UsageBreakdown {
  type: UsageType;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

/**
 * Pricing table (can be moved to config/database)
 */
export const USAGE_PRICING = {
  [UsageType.AI_REQUESTS]: { unit: 'request', price: 0.10 },          // $0.10 per AI request
  [UsageType.WORKFLOW_RUNS]: { unit: 'run', price: 0.05 },            // $0.05 per workflow run
  [UsageType.CI_MINUTES]: { unit: 'minute', price: 0.01 },            // $0.01 per minute
  [UsageType.STORAGE]: { unit: 'gb', price: 0.10 },                   // $0.10 per GB
  [UsageType.USERS]: { unit: 'user', price: 10.00 },                  // $10.00 per user
  [UsageType.TICKET_PROCESSED]: { unit: 'ticket', price: 0.50 },      // $0.50 per ticket
  [UsageType.LLM_TOKENS_INPUT]: { unit: 'token', price: 0.000003 },   // $3 per 1M tokens
  [UsageType.LLM_TOKENS_OUTPUT]: { unit: 'token', price: 0.000015 },  // $15 per 1M tokens
  [UsageType.PREVIEW_DEPLOY]: { unit: 'deploy', price: 0.10 },        // $0.10 per deploy
  [UsageType.PREVIEW_HOURS]: { unit: 'hour', price: 0.05 },           // $0.05 per hour
  [UsageType.STORAGE_GB_HOURS]: { unit: 'gb-hour', price: 0.001 },    // $0.001 per GB·hour
  [UsageType.API_CALLS]: { unit: 'call', price: 0.0001 },             // $0.0001 per call
};

export class UsageMeteringService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a usage metric
   */
  async record(metric: UsageMetric): Promise<void> {
    const pricing = USAGE_PRICING[metric.type];
    const unitPrice = metric.unitPrice ?? pricing.price;
    const totalCost = metric.quantity * unitPrice;

    const now = new Date();
    const periodStart = metric.periodStart ?? now;
    const periodEnd = metric.periodEnd ?? now;

    await this.prisma.usageRecord.create({
      data: {
        organizationId: metric.organizationId,
        type: metric.type,
        quantity: metric.quantity,
        unit: metric.unit ?? pricing.unit,
        unitPrice,
        totalCost,
        resourceId: metric.resourceId,
        resourceType: metric.resourceType,
        metadata: metric.metadata as any,
        periodStart,
        periodEnd,
      },
    });
  }

  /**
   * Record ticket processed
   */
  async recordTicketProcessed(organizationId: string, workflowId: string): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.TICKET_PROCESSED,
      quantity: 1,
      unit: 'ticket',
      unitPrice: USAGE_PRICING[UsageType.TICKET_PROCESSED].price,
      resourceId: workflowId,
      resourceType: 'workflow',
    });
  }

  /**
   * Record CI minutes
   */
  async recordCIMinutes(
    organizationId: string,
    ciRunId: string,
    minutes: number
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.CI_MINUTES,
      quantity: minutes,
      unit: 'minute',
      unitPrice: USAGE_PRICING[UsageType.CI_MINUTES].price,
      resourceId: ciRunId,
      resourceType: 'ci_run',
    });
  }

  /**
   * Record LLM tokens (input)
   */
  async recordLLMTokensInput(
    organizationId: string,
    workflowId: string,
    tokens: number,
    provider: string,
    model: string
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.LLM_TOKENS_INPUT,
      quantity: tokens,
      unit: 'token',
      unitPrice: USAGE_PRICING[UsageType.LLM_TOKENS_INPUT].price,
      resourceId: workflowId,
      resourceType: 'workflow',
      metadata: { provider, model },
    });
  }

  /**
   * Record LLM tokens (output)
   */
  async recordLLMTokensOutput(
    organizationId: string,
    workflowId: string,
    tokens: number,
    provider: string,
    model: string
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.LLM_TOKENS_OUTPUT,
      quantity: tokens,
      unit: 'token',
      unitPrice: USAGE_PRICING[UsageType.LLM_TOKENS_OUTPUT].price,
      resourceId: workflowId,
      resourceType: 'workflow',
      metadata: { provider, model },
    });
  }

  /**
   * Record preview deployment
   */
  async recordPreviewDeploy(
    organizationId: string,
    previewId: string,
    provider: string
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.PREVIEW_DEPLOY,
      quantity: 1,
      unit: 'deploy',
      unitPrice: USAGE_PRICING[UsageType.PREVIEW_DEPLOY].price,
      resourceId: previewId,
      resourceType: 'preview',
      metadata: { provider },
    });
  }

  /**
   * Record preview hours (usually called periodically or on teardown)
   */
  async recordPreviewHours(
    organizationId: string,
    previewId: string,
    hours: number
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.PREVIEW_HOURS,
      quantity: hours,
      unit: 'hour',
      unitPrice: USAGE_PRICING[UsageType.PREVIEW_HOURS].price,
      resourceId: previewId,
      resourceType: 'preview',
    });
  }

  /**
   * Record storage usage (GB·hours)
   */
  async recordStorageGBHours(
    organizationId: string,
    gbHours: number
  ): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.STORAGE_GB_HOURS,
      quantity: gbHours,
      unit: 'gb-hour',
      unitPrice: USAGE_PRICING[UsageType.STORAGE_GB_HOURS].price,
    });
  }

  /**
   * Record API calls
   */
  async recordAPICall(organizationId: string, endpoint?: string): Promise<void> {
    await this.record({
      organizationId,
      type: UsageType.API_CALLS,
      quantity: 1,
      unit: 'call',
      unitPrice: USAGE_PRICING[UsageType.API_CALLS].price,
      metadata: { endpoint },
    });
  }

  /**
   * Get usage summary for an organization in a period
   */
  async getUsageSummary(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageSummary> {
    const records = await this.prisma.usageRecord.findMany({
      where: {
        organizationId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
    });

    // Group by type
    const breakdownMap = new Map<UsageType, UsageBreakdown>();
    
    for (const record of records) {
      const existing = breakdownMap.get(record.type);
      if (existing) {
        existing.quantity += record.quantity;
        existing.totalCost += record.totalCost;
      } else {
        breakdownMap.set(record.type, {
          type: record.type,
          quantity: record.quantity,
          unit: record.unit,
          unitPrice: record.unitPrice,
          totalCost: record.totalCost,
        });
      }
    }

    const breakdown = Array.from(breakdownMap.values());
    const totalCost = breakdown.reduce((sum, b) => sum + b.totalCost, 0);

    return {
      organizationId,
      periodStart,
      periodEnd,
      breakdown,
      totalCost,
    };
  }

  /**
   * Check if organization is within quota
   */
  async checkQuota(organizationId: string): Promise<{
    withinQuota: boolean;
    tokenUsage: number;
    tokenQuota: number;
    costUsage: number;
    costQuota: number;
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Get current month usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const summary = await this.getUsageSummary(organizationId, periodStart, periodEnd);

    // Calculate token usage (input + output)
    const tokenUsage = summary.breakdown
      .filter(b => b.type === UsageType.LLM_TOKENS_INPUT || b.type === UsageType.LLM_TOKENS_OUTPUT)
      .reduce((sum, b) => sum + b.quantity, 0);

    const withinTokenQuota = tokenUsage <= org.tokenQuota;
    const withinCostQuota = summary.totalCost <= org.costQuota;

    return {
      withinQuota: withinTokenQuota && withinCostQuota,
      tokenUsage,
      tokenQuota: org.tokenQuota,
      costUsage: summary.totalCost,
      costQuota: org.costQuota,
    };
  }

  /**
   * Get top consuming resources
   */
  async getTopConsumers(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    limit: number = 10
  ): Promise<Array<{ resourceId: string; resourceType: string; totalCost: number }>> {
    const records = await this.prisma.usageRecord.findMany({
      where: {
        organizationId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        resourceId: { not: null },
      },
    });

    // Group by resource
    const resourceMap = new Map<string, { resourceId: string; resourceType: string; totalCost: number }>();
    
    for (const record of records) {
      if (!record.resourceId) continue;
      
      const key = `${record.resourceType}:${record.resourceId}`;
      const existing = resourceMap.get(key);
      
      if (existing) {
        existing.totalCost += record.totalCost;
      } else {
        resourceMap.set(key, {
          resourceId: record.resourceId,
          resourceType: record.resourceType || 'unknown',
          totalCost: record.totalCost,
        });
      }
    }

    // Sort by cost and take top N
    return Array.from(resourceMap.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }
}



