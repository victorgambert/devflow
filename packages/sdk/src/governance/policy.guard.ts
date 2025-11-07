/**
 * Policy Guard - Phase 4 Security & Governance
 * Enforces write policies, CODEOWNERS, branch protection, and security rules
 */

import { createLogger } from '@soma-squad-ai/common';
import * as path from 'path';
import { GuardrailsConfig } from '../project-adapter/soma-squad-ai-profile.types';

const logger = createLogger('PolicyGuard');

// ============================================
// Types
// ============================================

export interface PolicyViolation {
  type: 
    | 'forbidden_path'
    | 'outside_allowed_paths'
    | 'codeowners_required'
    | 'max_commits_exceeded'
    | 'max_file_size'
    | 'max_changes'
    | 'branch_protected'
    | 'security_issue'
    | 'compliance_failed';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  details?: any;
  remediation?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
}

export interface CodeOwner {
  pattern: string;
  owners: string[];
}

export interface BranchProtectionRule {
  pattern: string;
  requiresReview: boolean;
  requiredReviewers: number;
  requiresStatusChecks: boolean;
  requiredStatusChecks: string[];
  enforceAdmins: boolean;
  allowForcePush: boolean;
  allowDeletions: boolean;
}

export interface SecurityPolicy {
  scanForSecrets: boolean;
  scanForVulnerabilities: boolean;
  allowedLicenses?: string[];
  forbiddenPatterns?: RegExp[];
  maxComplexity?: number;
}

// ============================================
// PolicyGuard Class
// ============================================

export class PolicyGuard {
  private guardrails?: GuardrailsConfig;
  private codeowners: CodeOwner[] = [];
  private branchProtection: BranchProtectionRule[] = [];
  private securityPolicy?: SecurityPolicy;
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Initialize with guardrails config
   */
  setGuardrails(guardrails: GuardrailsConfig) {
    this.guardrails = guardrails;
    logger.info('Guardrails configured', {
      allowedPaths: guardrails.allow_write_paths?.length,
      forbiddenPaths: guardrails.forbidden_paths?.length,
      maxCommits: guardrails.max_commits,
    });
  }

  /**
   * Load and parse CODEOWNERS file
   */
  async loadCodeowners(content: string): Promise<void> {
    this.codeowners = this.parseCodeowners(content);
    logger.info('CODEOWNERS loaded', { entries: this.codeowners.length });
  }

  /**
   * Set branch protection rules
   */
  setBranchProtection(rules: BranchProtectionRule[]): void {
    this.branchProtection = rules;
    logger.info('Branch protection rules set', { rules: rules.length });
  }

  /**
   * Set security policy
   */
  setSecurityPolicy(policy: SecurityPolicy): void {
    this.securityPolicy = policy;
    logger.info('Security policy set', policy);
  }

  /**
   * Check if file write is allowed
   */
  async checkFileWrite(filePath: string, content?: string): Promise<PolicyCheckResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    const normalizedPath = path.normalize(filePath);

    // 1. Check forbidden paths
    if (this.guardrails?.forbidden_paths) {
      for (const forbidden of this.guardrails.forbidden_paths) {
        if (this.matchesPattern(normalizedPath, forbidden)) {
          violations.push({
            type: 'forbidden_path',
            severity: 'error',
            message: `Writing to '${filePath}' is forbidden`,
            file: filePath,
            details: { pattern: forbidden },
            remediation: 'Remove this file from changes or update guardrails.forbidden_paths',
          });
        }
      }
    }

    // 2. Check allowed paths
    if (this.guardrails?.allow_write_paths && this.guardrails.allow_write_paths.length > 0) {
      const isAllowed = this.guardrails.allow_write_paths.some((allowedPath) =>
        this.matchesPattern(normalizedPath, allowedPath),
      );

      if (!isAllowed) {
        violations.push({
          type: 'outside_allowed_paths',
          severity: 'error',
          message: `File '${filePath}' is outside allowed write paths`,
          file: filePath,
          details: { allowedPaths: this.guardrails.allow_write_paths },
          remediation: 'Add path pattern to guardrails.allow_write_paths',
        });
      }
    }

    // 3. Check CODEOWNERS
    const requiredOwners = this.getRequiredOwners(normalizedPath);
    if (requiredOwners.length > 0 && this.guardrails?.codeowners?.require_approval) {
      warnings.push({
        type: 'codeowners_required',
        severity: 'warning',
        message: `File '${filePath}' requires review from: ${requiredOwners.join(', ')}`,
        file: filePath,
        details: { owners: requiredOwners },
        remediation: 'Ensure required reviewers approve PR',
      });
    }

    // 4. Check file size
    if (content && this.guardrails?.max_file_size_kb) {
      const sizeKb = Buffer.byteLength(content, 'utf8') / 1024;
      if (sizeKb > this.guardrails.max_file_size_kb) {
        violations.push({
          type: 'max_file_size',
          severity: 'error',
          message: `File '${filePath}' (${sizeKb.toFixed(2)}KB) exceeds max size ${this.guardrails.max_file_size_kb}KB`,
          file: filePath,
          details: { sizeKb, maxSizeKb: this.guardrails.max_file_size_kb },
          remediation: 'Split file into smaller modules or increase max_file_size_kb',
        });
      }
    }

    // 5. Security checks
    if (content && this.securityPolicy) {
      const securityIssues = await this.scanForSecurityIssues(filePath, content);
      violations.push(...securityIssues);
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Check if commit count is within limit
   */
  checkCommitCount(currentCount: number): PolicyCheckResult {
    const violations: PolicyViolation[] = [];

    if (this.guardrails?.max_commits && currentCount >= this.guardrails.max_commits) {
      violations.push({
        type: 'max_commits_exceeded',
        severity: 'error',
        message: `Commit count (${currentCount}) exceeds maximum (${this.guardrails.max_commits})`,
        details: { currentCount, maxCommits: this.guardrails.max_commits },
        remediation: 'Workflow will be terminated. Consider increasing max_commits or optimizing code generation.',
      });
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings: [],
    };
  }

  /**
   * Check if total changes are within limit
   */
  checkChangesSize(additions: number, deletions: number): PolicyCheckResult {
    const violations: PolicyViolation[] = [];
    const totalChanges = additions + deletions;

    if (this.guardrails?.max_total_changes && totalChanges > this.guardrails.max_total_changes) {
      violations.push({
        type: 'max_changes',
        severity: 'error',
        message: `Total changes (${totalChanges}) exceeds maximum (${this.guardrails.max_total_changes})`,
        details: { additions, deletions, totalChanges, maxChanges: this.guardrails.max_total_changes },
        remediation: 'Split changes into multiple PRs or increase max_total_changes',
      });
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings: [],
    };
  }

  /**
   * Check branch protection rules
   */
  checkBranchProtection(branchName: string, operation: 'push' | 'force-push' | 'delete'): PolicyCheckResult {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    const matchingRules = this.branchProtection.filter((rule) =>
      this.matchesPattern(branchName, rule.pattern),
    );

    for (const rule of matchingRules) {
      // Check force push
      if (operation === 'force-push' && !rule.allowForcePush) {
        violations.push({
          type: 'branch_protected',
          severity: 'error',
          message: `Force push to '${branchName}' is not allowed`,
          details: { rule: rule.pattern },
          remediation: 'Use regular push or update branch protection settings',
        });
      }

      // Check deletion
      if (operation === 'delete' && !rule.allowDeletions) {
        violations.push({
          type: 'branch_protected',
          severity: 'error',
          message: `Deleting branch '${branchName}' is not allowed`,
          details: { rule: rule.pattern },
          remediation: 'Branch is protected and cannot be deleted',
        });
      }

      // Check required reviews
      if (rule.requiresReview) {
        warnings.push({
          type: 'branch_protected',
          severity: 'warning',
          message: `Branch '${branchName}' requires ${rule.requiredReviewers} review(s)`,
          details: { requiredReviewers: rule.requiredReviewers },
          remediation: 'Ensure PR has required approvals before merging',
        });
      }

      // Check status checks
      if (rule.requiresStatusChecks) {
        warnings.push({
          type: 'branch_protected',
          severity: 'warning',
          message: `Branch '${branchName}' requires status checks: ${rule.requiredStatusChecks.join(', ')}`,
          details: { requiredChecks: rule.requiredStatusChecks },
          remediation: 'Ensure all status checks pass before merging',
        });
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Comprehensive policy check for multiple files
   */
  async checkBatch(files: Array<{ path: string; content?: string }>): Promise<PolicyCheckResult> {
    const allViolations: PolicyViolation[] = [];
    const allWarnings: PolicyViolation[] = [];

    for (const file of files) {
      const result = await this.checkFileWrite(file.path, file.content);
      allViolations.push(...result.violations);
      allWarnings.push(...result.warnings);
    }

    return {
      allowed: allViolations.length === 0,
      violations: allViolations,
      warnings: allWarnings,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private parseCodeowners(content: string): CodeOwner[] {
    const codeowners: CodeOwner[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse pattern and owners
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const pattern = parts[0];
      const owners = parts.slice(1).filter((owner) => owner.startsWith('@'));

      if (owners.length > 0) {
        codeowners.push({ pattern, owners });
      }
    }

    return codeowners;
  }

  private getRequiredOwners(filePath: string): string[] {
    const owners: string[] = [];

    for (const entry of this.codeowners) {
      if (this.matchesPattern(filePath, entry.pattern)) {
        owners.push(...entry.owners);
      }
    }

    return [...new Set(owners)]; // Deduplicate
  }

  private async scanForSecurityIssues(filePath: string, content: string): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    if (!this.securityPolicy) {
      return violations;
    }

    // 1. Scan for secrets
    if (this.securityPolicy.scanForSecrets) {
      const secretPatterns = [
        { pattern: /(?:password|passwd|pwd)\s*=\s*["']([^"']+)["']/gi, name: 'Hardcoded Password' },
        { pattern: /(?:api[_-]?key|apikey)\s*=\s*["']([^"']+)["']/gi, name: 'API Key' },
        { pattern: /(?:secret|token)\s*=\s*["']([^"']+)["']/gi, name: 'Secret/Token' },
        { pattern: /(?:private[_-]?key)\s*=\s*["']([^"']+)["']/gi, name: 'Private Key' },
        { pattern: /sk-[a-zA-Z0-9]{32,}/g, name: 'OpenAI API Key' },
        { pattern: /ghp_[a-zA-Z0-9]{36,}/g, name: 'GitHub Token' },
      ];

      for (const { pattern, name } of secretPatterns) {
        if (pattern.test(content)) {
          violations.push({
            type: 'security_issue',
            severity: 'error',
            message: `Potential ${name} detected in '${filePath}'`,
            file: filePath,
            details: { issueType: name },
            remediation: 'Remove hardcoded secrets and use environment variables',
          });
        }
      }
    }

    // 2. Forbidden patterns
    if (this.securityPolicy.forbiddenPatterns) {
      for (const pattern of this.securityPolicy.forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push({
            type: 'security_issue',
            severity: 'error',
            message: `Forbidden pattern detected in '${filePath}'`,
            file: filePath,
            details: { pattern: pattern.source },
            remediation: 'Remove forbidden code pattern',
          });
        }
      }
    }

    return violations;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob matching (enhanced from Phase 3)
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

