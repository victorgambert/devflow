/**
 * Merge Policy Manager - Phase 4: Auto-Merge Rules
 * Manages merge policies and determines when auto-merge is allowed
 */

import { createLogger } from '@soma-squad-ai/common';
import { PolicyGuard } from './policy.guard';
import { auditLogger, AuditEventType } from './audit.logger';

const logger = createLogger('MergePolicyManager');

// ============================================
// Types
// ============================================

export interface MergePolicy {
  // Review requirements
  requireReviews: boolean;
  minimumApprovals: number;
  requireCodeOwnerApproval: boolean;
  dismissStaleReviews: boolean;
  
  // Status checks
  requireStatusChecks: boolean;
  requiredChecks: string[];
  requireAllChecksPass: boolean;
  
  // Quality gates
  requireCoverageThreshold?: number;
  requireAllTestsPass: boolean;
  requireLintPass: boolean;
  requireBuildPass: boolean;
  
  // Security
  requireSecurityScan: boolean;
  blockOnSecurityIssues: boolean;
  blockOnSecrets: boolean;
  
  // Auto-merge
  enableAutoMerge: boolean;
  autoMergeDelay?: number; // Delay in seconds before auto-merge
  autoMergeOnlyIfAuthor?: string[]; // Only auto-merge for these authors
  autoMergeOnlyForLabels?: string[]; // Only auto-merge if PR has these labels
}

export interface MergeEligibility {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  checks: {
    reviewsApproved: boolean;
    statusChecksPassed: boolean;
    qualityGatesPassed: boolean;
    securityPassed: boolean;
    policyPassed: boolean;
  };
}

export interface MergeDecision {
  action: 'merge' | 'wait' | 'block';
  reason: string;
  eligibility: MergeEligibility;
  autoMerge: boolean;
  autoMergeAt?: Date;
}

// ============================================
// MergePolicyManager Class
// ============================================

export class MergePolicyManager {
  private policy: MergePolicy;
  private policyGuard: PolicyGuard;

  constructor(policy: MergePolicy, policyGuard: PolicyGuard) {
    this.policy = policy;
    this.policyGuard = policyGuard;
  }

  /**
   * Determine if PR can be merged
   */
  async canMerge(prData: {
    number: number;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    files: string[];
    reviews: Array<{ user: string; state: 'approved' | 'changes_requested' | 'commented' }>;
    statusChecks: Array<{ name: string; state: 'success' | 'failure' | 'pending' }>;
    labels: string[];
    coverage?: number;
    testResults?: { passed: boolean; failed: number };
    lintResults?: { passed: boolean };
    buildResults?: { passed: boolean };
    securityScan?: { passed: boolean; issues: number };
    secrets?: string[];
  }): Promise<MergeDecision> {
    logger.info('Evaluating merge eligibility', { prNumber: prData.number });

    const eligibility = await this.evaluateEligibility(prData);

    // Determine action
    if (!eligibility.eligible) {
      return {
        action: 'block',
        reason: eligibility.reasons.join('; '),
        eligibility,
        autoMerge: false,
      };
    }

    // Check auto-merge conditions
    if (this.policy.enableAutoMerge && this.canAutoMerge(prData)) {
      const autoMergeAt = this.policy.autoMergeDelay
        ? new Date(Date.now() + this.policy.autoMergeDelay * 1000)
        : new Date();

      auditLogger.log({
        type: AuditEventType.REVIEW_APPROVED,
        actor: 'system',
        resource: `pr:${prData.number}`,
        action: 'auto_merge_scheduled',
        metadata: { autoMergeAt, eligibility },
        result: 'success',
      });

      return {
        action: 'merge',
        reason: 'All conditions met for auto-merge',
        eligibility,
        autoMerge: true,
        autoMergeAt,
      };
    }

    // Manual merge required
    return {
      action: 'wait',
      reason: 'Manual approval required for merge',
      eligibility,
      autoMerge: false,
    };
  }

  /**
   * Evaluate merge eligibility against all policies
   */
  private async evaluateEligibility(prData: any): Promise<MergeEligibility> {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Check reviews
    const reviewsApproved = this.checkReviews(prData, reasons);

    // Check status checks
    const statusChecksPassed = this.checkStatusChecks(prData, reasons);

    // Check quality gates
    const qualityGatesPassed = this.checkQualityGates(prData, reasons, warnings);

    // Check security
    const securityPassed = this.checkSecurity(prData, reasons);

    // Check policies (CODEOWNERS, branch protection)
    const policyValidation = await this.policyGuard.validateMergeRequest(
      prData.sourceBranch,
      prData.targetBranch,
      prData.files,
      prData.author,
    );
    const policyPassed = policyValidation.allowed;

    if (!policyPassed) {
      reasons.push(...policyValidation.violations.map(v => v.message));
    }
    if (policyValidation.warnings.length > 0) {
      warnings.push(...policyValidation.warnings.map(w => w.message));
    }

    const eligible =
      reviewsApproved &&
      statusChecksPassed &&
      qualityGatesPassed &&
      securityPassed &&
      policyPassed;

    return {
      eligible,
      reasons,
      warnings,
      checks: {
        reviewsApproved,
        statusChecksPassed,
        qualityGatesPassed,
        securityPassed,
        policyPassed,
      },
    };
  }

  /**
   * Check review requirements
   */
  private checkReviews(prData: any, reasons: string[]): boolean {
    if (!this.policy.requireReviews) {
      return true;
    }

    const approvals = prData.reviews.filter((r: any) => r.state === 'approved');
    const changesRequested = prData.reviews.filter((r: any) => r.state === 'changes_requested');

    if (changesRequested.length > 0) {
      reasons.push(`${changesRequested.length} review(s) requesting changes`);
      return false;
    }

    if (approvals.length < this.policy.minimumApprovals) {
      reasons.push(`Insufficient approvals: ${approvals.length}/${this.policy.minimumApprovals}`);
      return false;
    }

    // TODO: Check if code owner approved (requires CODEOWNERS parsing)
    if (this.policy.requireCodeOwnerApproval) {
      logger.info('Code owner approval check pending implementation');
    }

    return true;
  }

  /**
   * Check status checks
   */
  private checkStatusChecks(prData: any, reasons: string[]): boolean {
    if (!this.policy.requireStatusChecks) {
      return true;
    }

    const failedChecks = prData.statusChecks.filter((c: any) => c.state === 'failure');
    const pendingChecks = prData.statusChecks.filter((c: any) => c.state === 'pending');

    if (failedChecks.length > 0) {
      reasons.push(`Failed checks: ${failedChecks.map((c: any) => c.name).join(', ')}`);
      return false;
    }

    if (this.policy.requireAllChecksPass && pendingChecks.length > 0) {
      reasons.push(`Pending checks: ${pendingChecks.map((c: any) => c.name).join(', ')}`);
      return false;
    }

    // Check required checks are present and passed
    for (const requiredCheck of this.policy.requiredChecks) {
      const check = prData.statusChecks.find((c: any) => c.name === requiredCheck);
      if (!check || check.state !== 'success') {
        reasons.push(`Required check '${requiredCheck}' not passed`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check quality gates
   */
  private checkQualityGates(prData: any, reasons: string[], _warnings: string[]): boolean {
    let passed = true;

    // Coverage threshold
    if (this.policy.requireCoverageThreshold && prData.coverage !== undefined) {
      if (prData.coverage < this.policy.requireCoverageThreshold) {
        reasons.push(
          `Coverage ${prData.coverage}% below threshold ${this.policy.requireCoverageThreshold}%`,
        );
        passed = false;
      }
    }

    // Tests
    if (this.policy.requireAllTestsPass && prData.testResults) {
      if (!prData.testResults.passed || prData.testResults.failed > 0) {
        reasons.push(`${prData.testResults.failed} test(s) failing`);
        passed = false;
      }
    }

    // Lint
    if (this.policy.requireLintPass && prData.lintResults) {
      if (!prData.lintResults.passed) {
        reasons.push('Linting errors present');
        passed = false;
      }
    }

    // Build
    if (this.policy.requireBuildPass && prData.buildResults) {
      if (!prData.buildResults.passed) {
        reasons.push('Build failing');
        passed = false;
      }
    }

    return passed;
  }

  /**
   * Check security requirements
   */
  private checkSecurity(prData: any, reasons: string[]): boolean {
    let passed = true;

    // Security scan
    if (this.policy.requireSecurityScan && prData.securityScan) {
      if (!prData.securityScan.passed && this.policy.blockOnSecurityIssues) {
        reasons.push(`${prData.securityScan.issues} security issue(s) found`);
        passed = false;
      }
    }

    // Secrets detection
    if (this.policy.blockOnSecrets && prData.secrets && prData.secrets.length > 0) {
      reasons.push(`${prData.secrets.length} secret(s) detected in code`);
      passed = false;
    }

    return passed;
  }

  /**
   * Check if PR can be auto-merged
   */
  private canAutoMerge(prData: any): boolean {
    // Check author whitelist
    if (this.policy.autoMergeOnlyIfAuthor && this.policy.autoMergeOnlyIfAuthor.length > 0) {
      if (!this.policy.autoMergeOnlyIfAuthor.includes(prData.author)) {
        logger.info('Auto-merge blocked: author not in whitelist', { author: prData.author });
        return false;
      }
    }

    // Check label requirements
    if (this.policy.autoMergeOnlyForLabels && this.policy.autoMergeOnlyForLabels.length > 0) {
      const hasRequiredLabel = this.policy.autoMergeOnlyForLabels.some(label =>
        prData.labels.includes(label),
      );

      if (!hasRequiredLabel) {
        logger.info('Auto-merge blocked: required labels not present', {
          required: this.policy.autoMergeOnlyForLabels,
          present: prData.labels,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get merge policy summary
   */
  getSummary(): any {
    return {
      policy: this.policy,
      strictness: this.calculateStrictness(),
    };
  }

  /**
   * Calculate policy strictness (0-100)
   */
  private calculateStrictness(): number {
    let score = 0;
    let maxScore = 0;

    // Review requirements (25 points)
    maxScore += 25;
    if (this.policy.requireReviews) score += 10;
    if (this.policy.minimumApprovals >= 2) score += 10;
    if (this.policy.requireCodeOwnerApproval) score += 5;

    // Status checks (25 points)
    maxScore += 25;
    if (this.policy.requireStatusChecks) score += 10;
    if (this.policy.requireAllChecksPass) score += 10;
    if (this.policy.requiredChecks.length >= 3) score += 5;

    // Quality gates (25 points)
    maxScore += 25;
    if (this.policy.requireAllTestsPass) score += 10;
    if (this.policy.requireLintPass) score += 5;
    if (this.policy.requireBuildPass) score += 5;
    if (this.policy.requireCoverageThreshold) score += 5;

    // Security (25 points)
    maxScore += 25;
    if (this.policy.requireSecurityScan) score += 10;
    if (this.policy.blockOnSecurityIssues) score += 10;
    if (this.policy.blockOnSecrets) score += 5;

    return Math.round((score / maxScore) * 100);
  }
}



