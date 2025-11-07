/**
 * Policy Guard - Phase 4: Security & Governance
 * Validates operations against security policies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger, ConfigurationError } from '@soma-squad-ai/common';
import { SomaSquadAIProfile } from '../project-adapter/soma-squad-ai-profile.types';

const logger = createLogger('PolicyGuard');

// ============================================
// Types
// ============================================

export interface PolicyViolation {
  type: 'codeowners' | 'branch_protection' | 'forbidden_pattern' | 'max_iterations' | 'secret_detected' | 'vulnerability';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  details?: any;
}

export interface PolicyValidationResult {
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
}

export interface CodeownersRule {
  pattern: string;
  owners: string[];
}

export interface BranchProtectionRules {
  require_pull_request: boolean;
  require_reviews: boolean;
  required_approvals: number;
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  require_status_checks: boolean;
  required_status_checks: string[];
  enforce_admins: boolean;
  allow_force_pushes: boolean;
  allow_deletions: boolean;
}

// ============================================
// PolicyGuard Class
// ============================================

export class PolicyGuard {
  private profile: SomaSquadAIProfile;
  private workspacePath: string;
  private codeownersRules: CodeownersRule[] = [];

  constructor(profile: SomaSquadAIProfile, workspacePath: string) {
    this.profile = profile;
    this.workspacePath = workspacePath;
  }

  /**
   * Initialize - Load CODEOWNERS if enabled
   */
  async initialize(): Promise<void> {
    logger.info('Initializing PolicyGuard');

    if (this.profile.guardrails?.codeowners?.enabled) {
      await this.loadCodeowners();
    }
  }

  /**
   * Validate file modifications against policies
   */
  async validateFileModifications(files: string[], author: string): Promise<PolicyValidationResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    // Check CODEOWNERS
    if (this.profile.guardrails?.codeowners?.enabled) {
      const codeownersViolations = await this.checkCodeowners(files, author);
      violations.push(...codeownersViolations.filter(v => v.severity === 'error'));
      warnings.push(...codeownersViolations.filter(v => v.severity === 'warning'));
    }

    // Check forbidden patterns
    const patternViolations = await this.checkForbiddenPatterns(files);
    violations.push(...patternViolations);

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate merge request against policies
   */
  async validateMergeRequest(
    sourceBranch: string,
    targetBranch: string,
    files: string[],
    author: string,
  ): Promise<PolicyValidationResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    // Check branch protection
    const branchProtectionViolations = await this.checkBranchProtection(targetBranch);
    violations.push(...branchProtectionViolations);

    // Check file modifications
    const fileValidation = await this.validateFileModifications(files, author);
    violations.push(...fileValidation.violations);
    warnings.push(...fileValidation.warnings);

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate workflow iteration count
   */
  validateIterationCount(currentCount: number): PolicyValidationResult {
    const maxIterations = this.profile.advanced?.retry?.max_attempts || 3;

    if (currentCount >= maxIterations) {
      return {
        allowed: false,
        violations: [
          {
            type: 'max_iterations',
            severity: 'error',
            message: `Maximum iterations (${maxIterations}) reached. Current: ${currentCount}`,
            details: { currentCount, maxIterations },
          },
        ],
        warnings: [],
      };
    }

    // Warning at 80% threshold
    if (currentCount >= maxIterations * 0.8) {
      return {
        allowed: true,
        violations: [],
        warnings: [
          {
            type: 'max_iterations',
            severity: 'warning',
            message: `Approaching max iterations: ${currentCount}/${maxIterations}`,
            details: { currentCount, maxIterations },
          },
        ],
      };
    }

    return { allowed: true, violations: [], warnings: [] };
  }

  /**
   * Check if files require CODEOWNERS approval
   */
  private async checkCodeowners(files: string[], author: string): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    for (const file of files) {
      const owners = this.getFileOwners(file);

      if (owners.length > 0 && !owners.includes(author)) {
        const severity = this.profile.guardrails?.codeowners?.require_approval ? 'error' : 'warning';

        violations.push({
          type: 'codeowners',
          severity,
          message: `File '${file}' requires approval from: ${owners.join(', ')}`,
          file,
          details: { requiredOwners: owners, author },
        });
      }
    }

    return violations;
  }

  /**
   * Check forbidden file patterns
   */
  private async checkForbiddenPatterns(files: string[]): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];
    const forbiddenPatterns = [
      /\.env$/i,
      /\.env\..+$/i,
      /secret/i,
      /password/i,
      /api[-_]?key/i,
      /token/i,
      /\.pem$/,
      /\.key$/,
      /\.pfx$/,
      /\.p12$/,
    ];

    for (const file of files) {
      const basename = path.basename(file);

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(basename)) {
          violations.push({
            type: 'forbidden_pattern',
            severity: 'error',
            message: `File '${file}' matches forbidden pattern: ${pattern}`,
            file,
            details: { pattern: pattern.toString() },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check branch protection rules
   */
  private async checkBranchProtection(targetBranch: string): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    // Check if merging to protected branch (main, master, production)
    const protectedBranches = ['main', 'master', 'production', 'prod'];

    if (protectedBranches.includes(targetBranch)) {
      // For now, just log - real validation would check GitHub API
      logger.info('Merging to protected branch', { targetBranch });

      // Add warning if no explicit branch protection config
      violations.push({
        type: 'branch_protection',
        severity: 'warning',
        message: `Merging to protected branch '${targetBranch}'. Ensure branch protection rules are configured.`,
        details: { targetBranch },
      });
    }

    return violations;
  }

  /**
   * Load CODEOWNERS file
   */
  private async loadCodeowners(): Promise<void> {
    const codeownersPath = path.join(
      this.workspacePath,
      this.profile.guardrails?.codeowners?.path || '.github/CODEOWNERS',
    );

    try {
      const content = await fs.readFile(codeownersPath, 'utf-8');
      this.codeownersRules = this.parseCodeowners(content);
      logger.info('CODEOWNERS loaded', { rulesCount: this.codeownersRules.length });
    } catch (error) {
      logger.warn('Failed to load CODEOWNERS', error as Error);
      this.codeownersRules = [];
    }
  }

  /**
   * Parse CODEOWNERS file
   */
  private parseCodeowners(content: string): CodeownersRule[] {
    const rules: CodeownersRule[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse: "pattern @owner1 @owner2"
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const pattern = parts[0];
      const owners = parts.slice(1).filter(o => o.startsWith('@')).map(o => o.substring(1));

      if (owners.length > 0) {
        rules.push({ pattern, owners });
      }
    }

    return rules;
  }

  /**
   * Get owners for a specific file
   */
  private getFileOwners(filePath: string): string[] {
    const owners: string[] = [];

    // Match from most specific to least specific
    const sortedRules = [...this.codeownersRules].reverse();

    for (const rule of sortedRules) {
      if (this.matchesCodeownersPattern(filePath, rule.pattern)) {
        owners.push(...rule.owners);
        break; // Use most specific match
      }
    }

    return [...new Set(owners)]; // Deduplicate
  }

  /**
   * Match file against CODEOWNERS pattern
   */
  private matchesCodeownersPattern(filePath: string, pattern: string): boolean {
    // Simple glob matching
    // TODO: Use a proper glob library for production

    // Exact match
    if (pattern === filePath) {
      return true;
    }

    // Directory match: "docs/" matches "docs/README.md"
    if (pattern.endsWith('/') && filePath.startsWith(pattern)) {
      return true;
    }

    // Wildcard match: "*.js" matches "index.js"
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');

      return new RegExp(`^${regexPattern}$`).test(filePath);
    }

    return false;
  }

  /**
   * Get branch protection rules (stub for GitHub API integration)
   */
  async getBranchProtectionRules(branch: string): Promise<BranchProtectionRules | null> {
    // TODO: Integrate with GitHub API to fetch real rules
    logger.info('Fetching branch protection rules', { branch });

    // Default rules for protected branches
    if (['main', 'master', 'production'].includes(branch)) {
      return {
        require_pull_request: true,
        require_reviews: true,
        required_approvals: 1,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        require_status_checks: true,
        required_status_checks: ['ci', 'tests'],
        enforce_admins: false,
        allow_force_pushes: false,
        allow_deletions: false,
      };
    }

    return null;
  }
}



