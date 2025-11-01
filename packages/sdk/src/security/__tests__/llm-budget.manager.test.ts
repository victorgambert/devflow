/**
 * LLMBudgetManager Tests - Phase 4
 */

import { LLMBudgetManager } from '../llm-budget.manager';

describe('LLMBudgetManager', () => {
  let budgetManager: LLMBudgetManager;

  beforeEach(() => {
    budgetManager = new LLMBudgetManager({
      maxTokensPerCall: 50000,
      maxTokensPerDay: 500000,
      maxCostPerDay: 10.0,
      maxCallsPerMinute: 5,
    });
  });

  describe('checkQuota', () => {
    it('should allow call within limits', async () => {
      const result = await budgetManager.checkQuota('anthropic', 'claude-3-5-sonnet-20241022', 10000);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block call exceeding per-call limit', async () => {
      const result = await budgetManager.checkQuota('anthropic', 'claude-3-5-sonnet-20241022', 60000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-call limit');
    });

    it('should block when daily quota would be exceeded', async () => {
      // Record large usage
      for (let i = 0; i < 10; i++) {
        budgetManager.recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 25000, 25000);
      }

      const result = await budgetManager.checkQuota('anthropic', 'claude-3-5-sonnet-20241022', 25000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token quota');
    });
  });

  describe('recordUsage', () => {
    it('should record usage correctly', () => {
      budgetManager.recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 10000, 5000);

      const summary = budgetManager.getSummary();
      expect(summary.total.tokens).toBe(15000);
      expect(summary.total.calls).toBe(1);
      expect(summary.total.cost).toBeGreaterThan(0);
    });

    it('should calculate costs correctly', () => {
      budgetManager.recordUsage('claude-3-5-sonnet-20241022', 'anthropic', 1000000, 1000000);

      const summary = budgetManager.getSummary();
      // 1M input tokens * $3/1M + 1M output tokens * $15/1M = $18
      expect(summary.total.cost).toBeCloseTo(18, 1);
    });
  });

  describe('getStatus', () => {
    it('should return correct status for day', () => {
      budgetManager.recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 10000, 5000);

      const status = budgetManager.getStatus('day');

      expect(status.period).toBe('day');
      expect(status.current.tokens).toBe(15000);
      expect(status.current.calls).toBe(1);
      expect(status.exceeded).toBe(false);
    });

    it('should detect exceeded limits', () => {
      // Exceed daily limit
      for (let i = 0; i < 50; i++) {
        budgetManager.recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 10000, 10000);
      }

      const status = budgetManager.getStatus('day');

      expect(status.exceeded).toBe(true);
      expect(status.current.tokens).toBeGreaterThan(status.limits.tokens || 0);
    });
  });

  describe('rate limiting', () => {
    it('should enforce per-minute rate limit', async () => {
      // Make 5 calls (at limit)
      for (let i = 0; i < 5; i++) {
        budgetManager.recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 1000, 1000);
      }

      // 6th call should be blocked
      const result = await budgetManager.checkQuota('anthropic', 'claude-3-5-sonnet-20241022', 1000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit');
    });
  });
});

