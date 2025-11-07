/**
 * Security Scanner - Phase 4: Secrets & Vulnerability Detection
 * Scans code for secrets, vulnerabilities, and security issues
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '@soma-squad-ai/common';
import { auditLogger, AuditEventType } from './audit.logger';

const logger = createLogger('SecurityScanner');

// ============================================
// Types
// ============================================

export interface SecurityIssue {
  type: 'secret' | 'vulnerability' | 'hardcoded_credential' | 'insecure_pattern';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  column?: number;
  message: string;
  matched: string;
  recommendation?: string;
}

export interface ScanResult {
  passed: boolean;
  issues: SecurityIssue[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<string, number>;
  };
}

// ============================================
// Secret Patterns
// ============================================

const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical' as const,
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key\s*=\s*['"  ]([A-Za-z0-9/+=]{40})['"]/gi,
    severity: 'critical' as const,
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical' as const,
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    severity: 'critical' as const,
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9a-zA-Z-]{10,48}/g,
    severity: 'high' as const,
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    severity: 'critical' as const,
  },
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key\s*[:=]\s*['"  ]([a-zA-Z0-9_\-]{16,})['"]/gi,
    severity: 'high' as const,
  },
  {
    name: 'Generic Secret',
    pattern: /secret\s*[:=]\s*['"  ]([a-zA-Z0-9_\-]{8,})['"]/gi,
    severity: 'high' as const,
  },
  {
    name: 'Password',
    pattern: /password\s*[:=]\s*['"  ]([^\s'"]{4,})['"]/gi,
    severity: 'high' as const,
  },
  {
    name: 'Connection String',
    pattern: /(mongodb|mysql|postgresql|postgres):\/\/[^\s'"]+/gi,
    severity: 'high' as const,
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'medium' as const,
  },
];

// ============================================
// Insecure Patterns
// ============================================

const INSECURE_PATTERNS = [
  {
    name: 'Eval Usage',
    pattern: /\beval\s*\(/g,
    severity: 'high' as const,
    recommendation: 'Avoid using eval() as it can execute arbitrary code',
  },
  {
    name: 'Weak Crypto',
    pattern: /\b(MD5|SHA1)\s*\(/gi,
    severity: 'medium' as const,
    recommendation: 'Use stronger hashing algorithms like SHA-256 or bcrypt',
  },
  {
    name: 'SQL Injection Risk',
    pattern: /execute\s*\(\s*['"  ].*\$\{/g,
    severity: 'high' as const,
    recommendation: 'Use parameterized queries to prevent SQL injection',
  },
  {
    name: 'Insecure Random',
    pattern: /Math\.random\(\)/g,
    severity: 'low' as const,
    recommendation: 'Use crypto.randomBytes() for security-sensitive random values',
  },
];

// ============================================
// SecurityScanner Class
// ============================================

export class SecurityScanner {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Scan files for security issues
   */
  async scanFiles(filePaths: string[]): Promise<ScanResult> {
    logger.info('Scanning files for security issues', { fileCount: filePaths.length });

    const issues: SecurityIssue[] = [];

    for (const filePath of filePaths) {
      const fileIssues = await this.scanFile(filePath);
      issues.push(...fileIssues);
    }

    // Calculate summary
    const summary = {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      byType: {} as Record<string, number>,
    };

    for (const issue of issues) {
      summary.byType[issue.type] = (summary.byType[issue.type] || 0) + 1;
    }

    const passed = summary.critical === 0 && summary.high === 0;

    logger.info('Security scan complete', {
      passed,
      total: summary.total,
      critical: summary.critical,
      high: summary.high,
    });

    // Log to audit
    if (!passed) {
      auditLogger.log({
        type: AuditEventType.SECRET_DETECTED,
        actor: 'system',
        resource: 'security_scan',
        action: 'scan',
        metadata: { summary, issues: issues.slice(0, 10) }, // First 10 issues
        result: 'warning',
      });
    }

    return {
      passed,
      issues,
      summary,
    };
  }

  /**
   * Scan a single file
   */
  private async scanFile(filePath: string): Promise<SecurityIssue[]> {
    const fullPath = path.join(this.workspacePath, filePath);
    const issues: SecurityIssue[] = [];

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Scan for secrets
      for (const pattern of SECRET_PATTERNS) {
        const secretIssues = this.scanPattern(
          filePath,
          lines,
          pattern.pattern,
          'secret',
          pattern.severity,
          `Potential ${pattern.name} detected`,
          'Remove hardcoded secrets and use environment variables',
        );
        issues.push(...secretIssues);
      }

      // Scan for insecure patterns
      for (const pattern of INSECURE_PATTERNS) {
        const insecureIssues = this.scanPattern(
          filePath,
          lines,
          pattern.pattern,
          'insecure_pattern',
          pattern.severity,
          `${pattern.name} detected`,
          pattern.recommendation,
        );
        issues.push(...insecureIssues);
      }

      // Scan for hardcoded credentials
      const credentialIssues = this.scanHardcodedCredentials(filePath, lines);
      issues.push(...credentialIssues);
    } catch (error) {
      logger.warn('Failed to scan file', error as Error, { filePath });
    }

    return issues;
  }

  /**
   * Scan content for a pattern
   */
  private scanPattern(
    filePath: string,
    lines: string[],
    pattern: RegExp,
    type: SecurityIssue['type'],
    severity: SecurityIssue['severity'],
    message: string,
    recommendation?: string,
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.matchAll(new RegExp(pattern.source, pattern.flags));

      for (const match of matches) {
        issues.push({
          type,
          severity,
          file: filePath,
          line: i + 1,
          column: match.index,
          message,
          matched: match[0].substring(0, 50), // Truncate for safety
          recommendation,
        });

        // Log critical issues
        if (severity === 'critical') {
          auditLogger.logSecretDetected(filePath, message, 'security_scanner');
        }
      }
    }

    return issues;
  }

  /**
   * Scan for hardcoded credentials
   */
  private scanHardcodedCredentials(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    const credentialPatterns = [
      { key: 'username', value: /username\s*[:=]\s*['"  ]([a-zA-Z0-9_]+)['"]/gi },
      { key: 'user', value: /user\s*[:=]\s*['"  ]([a-zA-Z0-9_]+)['"]/gi },
      { key: 'admin', value: /admin\s*[:=]\s*['"  ]([a-zA-Z0-9_]+)['"]/gi },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        continue;
      }

      for (const pattern of credentialPatterns) {
        const matches = line.matchAll(pattern.value);

        for (const match of matches) {
          // Check if password on same or nearby lines
          const contextLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
          const hasPassword = contextLines.some(l => /password\s*[:=]/i.test(l));

          if (hasPassword) {
            issues.push({
              type: 'hardcoded_credential',
              severity: 'high',
              file: filePath,
              line: i + 1,
              message: `Potential hardcoded credentials detected (${pattern.key})`,
              matched: match[0],
              recommendation: 'Use environment variables or secure credential management',
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Scan dependencies for known vulnerabilities (stub)
   */
  async scanDependencies(): Promise<ScanResult> {
    logger.info('Scanning dependencies for vulnerabilities');

    // TODO: Integrate with npm audit, snyk, or similar tools

    return {
      passed: true,
      issues: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byType: {},
      },
    };
  }

  /**
   * Quick check for common secrets in files
   */
  async quickScan(files: string[]): Promise<string[]> {
    const secretsFound: string[] = [];

    for (const file of files) {
      try {
        const fullPath = path.join(this.workspacePath, file);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Quick check for high-confidence patterns
        const highConfidencePatterns = [
          /AKIA[0-9A-Z]{16}/,
          /ghp_[a-zA-Z0-9]{36}/,
          /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/,
        ];

        for (const pattern of highConfidencePatterns) {
          if (pattern.test(content)) {
            secretsFound.push(file);
            break;
          }
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return secretsFound;
  }
}



