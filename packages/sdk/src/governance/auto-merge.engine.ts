/**
 * Auto-Merge Rules Engine - Phase 4 Security & Governance
 * Determines if PR can be automatically merged based on rules
 */

import { createLogger } from '@soma-squad-ai/common';
import { auditLogger, AuditEventType } from './audit.logger';
import { PolicyCheckResult } from './policy.guard';

const logger = createLogger('AutoMergeEngine');

// ============================================
// Types
// ============================================

export interface AutoMergeConfig {
  enabled: boolean;
  
  // Required conditions
  requireAllChecksPass: boolean;
  requireReviews: boolean;
  minReviews: number;
  requireCodeownersApproval: boolean;
  
  // Quality gates
  minCoverage?: number;
  maxFailedTests?: number;
  requireLintPass: boolean;
  requireBuildPass: boolean;
  
  // Security gates
  allowWithSecurityWarnings: boolean;
  allowWithPolicyViolations: boolean;
  
  // Limitations
  maxFilesChanged?: number;
  maxLinesChanged?: number;
  maxCommits?: number;
  
  // Timing
  mergeDelay?: number; // Wait N seconds before merging
  mergeSchedule?: {
    allowedHours?: [number, number]; // e.g., [9, 17] for 9am-5pm
    allowedDays?: string[]; // e.g., ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    timezone?: string;
  };
  
  // Labels
  requireLabels?: string[];
  blockingLabels?: string[];
  
  // Override
  overrideWith?: string; // Label that overrides rules (e.g., 'force-merge')
}

export interface PRStatus {
  number: number;
  title: string;
  author: string;
  createdAt: Date;
  
  // Checks
  checksPass: boolean;
  checks: Array<{
    name: string;
    status: 'success' | 'failure' | 'pending';
    conclusion?: string;
  }>;
  
  // Reviews
  reviews: Array<{
    author: string;
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  }>;
  approvedBy: string[];
  changesRequestedBy: string[];
  
  // Quality
  coverage?: number;
  failedTests?: number;
  lintPassed?: boolean;
  buildPassed?: boolean;
  
  // Changes
  filesChanged: number;
  additions: number;
  deletions: number;
  commits: number;
  
  // Labels
  labels: string[];
  
  // Security
  securityWarnings: number;
  policyViolations: PolicyCheckResult;
  
  // CODEOWNERS
  codeownersRequired: string[];
  codeownersApproved: string[];
}

export interface AutoMergeDecision {
  canMerge: boolean;
  reason: string;
  blockers: string[];
  warnings: string[];
  metadata: {
    allChecksPassed: boolean;
    hasRequiredReviews: boolean;
    hasCodeownersApproval: boolean;
    meetsQualityGates: boolean;
    withinLimits: boolean;
    inAllowedSchedule: boolean;
  };
}

// ============================================
// AutoMergeEngine Class
// ============================================

export class AutoMergeEngine {
  private config: AutoMergeConfig;

  constructor(config: AutoMergeConfig) {
    this.config = config;
    logger.info('Auto-merge engine initialized', { enabled: config.enabled });
  }

  /**
   * Evaluate if PR can be auto-merged
   */
  async evaluate(prStatus: PRStatus, context: { projectId?: string; workflowId?: string }): Promise<AutoMergeDecision> {
    if (!this.config.enabled) {
      return {
        canMerge: false,
        reason: 'Auto-merge is disabled',
        blockers: ['Auto-merge disabled in configuration'],
        warnings: [],
        metadata: this.getEmptyMetadata(),
      };
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Check for override label
    if (this.config.overrideWith && prStatus.labels.includes(this.config.overrideWith)) {
      logger.warn('Auto-merge override detected', { pr: prStatus.number, label: this.config.overrideWith });
      
      await auditLogger.log({
        type: AuditEventType.AUTO_MERGE_ELIGIBLE,
        actor: { type: 'system', id: 'auto-merge-engine' },
        resource: { type: 'pr', id: String(prStatus.number) },
        action: 'Auto-merge override',
        result: 'warning',
        metadata: { label: this.config.overrideWith },
        context: { ...context, prNumber: prStatus.number },
        tags: ['auto-merge', 'override'],
      });

      return {
        canMerge: true,
        reason: `Override label '${this.config.overrideWith}' present`,
        blockers: [],
        warnings: ['Manual override - bypassing all checks'],
        metadata: this.getEmptyMetadata(),
      };
    }

    // 1. Check blocking labels
    if (this.config.blockingLabels) {
      const blockingLabelsPresent = prStatus.labels.filter((label) =>
        this.config.blockingLabels!.includes(label),
      );
      
      if (blockingLabelsPresent.length > 0) {
        blockers.push(`Blocking labels present: ${blockingLabelsPresent.join(', ')}`);
      }
    }

    // 2. Check required labels
    if (this.config.requireLabels) {
      const missingLabels = this.config.requireLabels.filter((label) =>
        !prStatus.labels.includes(label),
      );
      
      if (missingLabels.length > 0) {
        blockers.push(`Missing required labels: ${missingLabels.join(', ')}`);
      }
    }

    // 3. Check all CI checks pass
    const allChecksPassed = prStatus.checksPass && 
      prStatus.checks.every((c) => c.status === 'success');
    
    if (this.config.requireAllChecksPass && !allChecksPassed) {
      const failedChecks = prStatus.checks
        .filter((c) => c.status !== 'success')
        .map((c) => c.name);
      blockers.push(`CI checks failed: ${failedChecks.join(', ')}`);
    }

    // 4. Check reviews
    const hasRequiredReviews = this.checkReviews(prStatus);
    if (this.config.requireReviews && !hasRequiredReviews) {
      blockers.push(`Insufficient reviews (${prStatus.approvedBy.length} / ${this.config.minReviews} required)`);
    }

    if (prStatus.changesRequestedBy.length > 0) {
      blockers.push(`Changes requested by: ${prStatus.changesRequestedBy.join(', ')}`);
    }

    // 5. Check CODEOWNERS approval
    const hasCodeownersApproval = this.checkCodeownersApproval(prStatus);
    if (this.config.requireCodeownersApproval && !hasCodeownersApproval) {
      const missingOwners = prStatus.codeownersRequired.filter(
        (owner) => !prStatus.codeownersApproved.includes(owner),
      );
      blockers.push(`CODEOWNERS approval missing from: ${missingOwners.join(', ')}`);
    }

    // 6. Check quality gates
    const meetsQualityGates = this.checkQualityGates(prStatus, warnings);
    if (!meetsQualityGates) {
      blockers.push('Quality gates not met');
    }

    // 7. Check limits
    const withinLimits = this.checkLimits(prStatus, blockers);

    // 8. Check security/policy
    if (!this.config.allowWithSecurityWarnings && prStatus.securityWarnings > 0) {
      blockers.push(`${prStatus.securityWarnings} security warning(s) detected`);
    }

    if (!this.config.allowWithPolicyViolations && prStatus.policyViolations.violations.length > 0) {
      blockers.push(`${prStatus.policyViolations.violations.length} policy violation(s) detected`);
    }

    // 9. Check schedule
    const inAllowedSchedule = this.checkSchedule();
    if (!inAllowedSchedule) {
      blockers.push('Outside allowed merge schedule');
    }

    // Determine result
    const canMerge = blockers.length === 0;
    const reason = canMerge
      ? 'All auto-merge conditions met'
      : `Blocked: ${blockers[0]}`;

    const decision: AutoMergeDecision = {
      canMerge,
      reason,
      blockers,
      warnings,
      metadata: {
        allChecksPassed,
        hasRequiredReviews,
        hasCodeownersApproval,
        meetsQualityGates,
        withinLimits,
        inAllowedSchedule,
      },
    };

    // Log decision
    await auditLogger.logAutoMergeDecision(
      prStatus.number,
      canMerge,
      reason,
      { ...context, prNumber: prStatus.number },
    );

    logger.info('Auto-merge evaluation complete', {
      pr: prStatus.number,
      canMerge,
      blockers: blockers.length,
      warnings: warnings.length,
    });

    return decision;
  }

  /**
   * Check if PR has required reviews
   */
  private checkReviews(prStatus: PRStatus): boolean {
    if (!this.config.requireReviews) {
      return true;
    }

    const approvedCount = prStatus.approvedBy.length;
    return approvedCount >= this.config.minReviews;
  }

  /**
   * Check if required CODEOWNERS have approved
   */
  private checkCodeownersApproval(prStatus: PRStatus): boolean {
    if (!this.config.requireCodeownersApproval) {
      return true;
    }

    // All required codeowners must have approved
    return prStatus.codeownersRequired.every((owner) =>
      prStatus.codeownersApproved.includes(owner),
    );
  }

  /**
   * Check quality gates
   */
  private checkQualityGates(prStatus: PRStatus, warnings: string[]): boolean {
    let passed = true;

    // Coverage
    if (this.config.minCoverage && prStatus.coverage !== undefined) {
      if (prStatus.coverage < this.config.minCoverage) {
        warnings.push(`Coverage ${prStatus.coverage}% below minimum ${this.config.minCoverage}%`);
        passed = false;
      }
    }

    // Failed tests
    if (this.config.maxFailedTests !== undefined && prStatus.failedTests !== undefined) {
      if (prStatus.failedTests > this.config.maxFailedTests) {
        warnings.push(`${prStatus.failedTests} tests failed (max: ${this.config.maxFailedTests})`);
        passed = false;
      }
    }

    // Lint
    if (this.config.requireLintPass && prStatus.lintPassed === false) {
      warnings.push('Lint checks failed');
      passed = false;
    }

    // Build
    if (this.config.requireBuildPass && prStatus.buildPassed === false) {
      warnings.push('Build failed');
      passed = false;
    }

    return passed;
  }

  /**
   * Check limits
   */
  private checkLimits(prStatus: PRStatus, blockers: string[]): boolean {
    let withinLimits = true;

    if (this.config.maxFilesChanged && prStatus.filesChanged > this.config.maxFilesChanged) {
      blockers.push(`Too many files changed (${prStatus.filesChanged} / ${this.config.maxFilesChanged})`);
      withinLimits = false;
    }

    if (this.config.maxLinesChanged) {
      const totalLines = prStatus.additions + prStatus.deletions;
      if (totalLines > this.config.maxLinesChanged) {
        blockers.push(`Too many lines changed (${totalLines} / ${this.config.maxLinesChanged})`);
        withinLimits = false;
      }
    }

    if (this.config.maxCommits && prStatus.commits > this.config.maxCommits) {
      blockers.push(`Too many commits (${prStatus.commits} / ${this.config.maxCommits})`);
      withinLimits = false;
    }

    return withinLimits;
  }

  /**
   * Check if current time is within allowed schedule
   */
  private checkSchedule(): boolean {
    if (!this.config.mergeSchedule) {
      return true;
    }

    const now = new Date();
    const schedule = this.config.mergeSchedule;

    // Check allowed hours
    if (schedule.allowedHours) {
      const [startHour, endHour] = schedule.allowedHours;
      const currentHour = now.getHours();
      
      if (currentHour < startHour || currentHour >= endHour) {
        return false;
      }
    }

    // Check allowed days
    if (schedule.allowedDays && schedule.allowedDays.length > 0) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = days[now.getDay()];
      
      if (!schedule.allowedDays.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  private getEmptyMetadata() {
    return {
      allChecksPassed: false,
      hasRequiredReviews: false,
      hasCodeownersApproval: false,
      meetsQualityGates: false,
      withinLimits: false,
      inAllowedSchedule: false,
    };
  }
}

