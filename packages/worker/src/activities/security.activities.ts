/**
 * Security Activities - Phase 4: Security Checks & Policy Validation
 */

import { createLogger } from '@soma-squad-ai/common';
import {
  PolicyGuard,
  SecurityScanner,
  MergePolicyManager,
  MergePolicy,
  auditLogger,
} from '@soma-squad-ai/sdk';
import { ProjectAdapter } from '@soma-squad-ai/sdk';

const logger = createLogger('SecurityActivities');

// ============================================
// Policy Validation
// ============================================

export interface ValidateFileModificationsInput {
  projectId: string;
  workspacePath: string;
  files: string[];
  author: string;
}

export interface ValidateFileModificationsOutput {
  allowed: boolean;
  violations: any[];
  warnings: any[];
}

export async function validateFileModifications(
  input: ValidateFileModificationsInput,
): Promise<ValidateFileModificationsOutput> {
  logger.info('Validating file modifications', {
    projectId: input.projectId,
    fileCount: input.files.length,
  });

  try {
    // Load project configuration
    const adapter = new ProjectAdapter(input.workspacePath);
    await adapter.loadProfile();
    const profile = adapter.getProfile();

    // Create policy guard
    const policyGuard = new PolicyGuard(profile, input.workspacePath);
    await policyGuard.initialize();

    // Validate
    const result = await policyGuard.validateFileModifications(input.files, input.author);

    // Log violations
    if (result.violations.length > 0) {
      for (const violation of result.violations) {
        auditLogger.logPolicyViolation(
          violation.type,
          violation.file || 'multiple_files',
          input.author,
          violation.details,
        );
      }
    }

    return {
      allowed: result.allowed,
      violations: result.violations,
      warnings: result.warnings,
    };
  } catch (error) {
    logger.error('Failed to validate file modifications', error as Error);
    throw error;
  }
}

// ============================================
// Security Scanning
// ============================================

export interface ScanForSecretsInput {
  projectId: string;
  workspacePath: string;
  files: string[];
}

export interface ScanForSecretsOutput {
  passed: boolean;
  issues: any[];
  summary: {
    total: number;
    critical: number;
    high: number;
  };
}

export async function scanForSecrets(input: ScanForSecretsInput): Promise<ScanForSecretsOutput> {
  logger.info('Scanning for secrets', {
    projectId: input.projectId,
    fileCount: input.files.length,
  });

  try {
    const scanner = new SecurityScanner(input.workspacePath);
    const result = await scanner.scanFiles(input.files);

    logger.info('Security scan complete', {
      passed: result.passed,
      issueCount: result.issues.length,
    });

    return {
      passed: result.passed,
      issues: result.issues,
      summary: {
        total: result.summary.total,
        critical: result.summary.critical,
        high: result.summary.high,
      },
    };
  } catch (error) {
    logger.error('Failed to scan for secrets', error as Error);
    throw error;
  }
}

// ============================================
// Merge Policy Evaluation
// ============================================

export interface EvaluateMergePolicyInput {
  projectId: string;
  workspacePath: string;
  prNumber: number;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  files: string[];
  reviews: Array<{ user: string; state: 'approved' | 'changes_requested' | 'commented' }>;
  statusChecks: Array<{ name: string; state: 'success' | 'failure' | 'pending' }>;
  labels: string[];
  coverage?: number;
  testResults?: { passed: boolean; failed: number };
}

export interface EvaluateMergePolicyOutput {
  action: 'merge' | 'wait' | 'block';
  reason: string;
  eligible: boolean;
  autoMerge: boolean;
  autoMergeAt?: Date;
}

export async function evaluateMergePolicy(
  input: EvaluateMergePolicyInput,
): Promise<EvaluateMergePolicyOutput> {
  logger.info('Evaluating merge policy', {
    projectId: input.projectId,
    prNumber: input.prNumber,
  });

  try {
    // Load project configuration
    const adapter = new ProjectAdapter(input.workspacePath);
    await adapter.loadProfile();
    const profile = adapter.getProfile();

    // Create managers
    const policyGuard = new PolicyGuard(profile, input.workspacePath);
    await policyGuard.initialize();

    // Default merge policy (can be configured in profile)
    const mergePolicy: MergePolicy = {
      requireReviews: true,
      minimumApprovals: 1,
      requireCodeOwnerApproval: profile.guardrails?.codeowners?.require_approval || false,
      dismissStaleReviews: true,
      requireStatusChecks: true,
      requiredChecks: ['ci', 'tests'],
      requireAllChecksPass: true,
      requireAllTestsPass: true,
      requireLintPass: true,
      requireBuildPass: true,
      requireSecurityScan: true,
      blockOnSecurityIssues: true,
      blockOnSecrets: true,
      enableAutoMerge: false, // Disabled by default
    };

    const mergePolicyManager = new MergePolicyManager(mergePolicy, policyGuard);

    // Evaluate
    const decision = await mergePolicyManager.canMerge({
      number: input.prNumber,
      author: input.author,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      files: input.files,
      reviews: input.reviews,
      statusChecks: input.statusChecks,
      labels: input.labels,
      coverage: input.coverage,
      testResults: input.testResults,
    });

    logger.info('Merge policy evaluated', {
      action: decision.action,
      eligible: decision.eligibility.eligible,
      autoMerge: decision.autoMerge,
    });

    return {
      action: decision.action,
      reason: decision.reason,
      eligible: decision.eligibility.eligible,
      autoMerge: decision.autoMerge,
      autoMergeAt: decision.autoMergeAt,
    };
  } catch (error) {
    logger.error('Failed to evaluate merge policy', error as Error);
    throw error;
  }
}

// ============================================
// Audit Trail
// ============================================

export interface LogAuditEventInput {
  type: string;
  actor: string;
  resource: string;
  action: string;
  metadata?: Record<string, any>;
  result: 'success' | 'failure' | 'warning';
  duration?: number;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  auditLogger.log({
    type: input.type as any,
    actor: input.actor,
    resource: input.resource,
    action: input.action,
    metadata: input.metadata,
    result: input.result,
    duration: input.duration,
  });
}

// ============================================
// Workflow Metrics
// ============================================

export interface GetAuditSummaryInput {
  startDate?: Date;
  endDate?: Date;
}

export interface GetAuditSummaryOutput {
  total: number;
  byType: Record<string, number>;
  byResult: Record<string, number>;
  byActor: Record<string, number>;
}

export async function getAuditSummary(input: GetAuditSummaryInput): Promise<GetAuditSummaryOutput> {
  const summary = auditLogger.getSummary({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  return summary;
}



