/**
 * Project Adapter - Universal project interface (Phase 3 Enhanced)
 * Reads and executes .devflow.yml commands with guardrails
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'yaml';
import {
  DevflowProfile,
  CommandResult,
  GuardrailsValidationResult,
  GuardrailsViolation,
} from './devflow-profile.types';
import { createLogger, ConfigurationError, DEVFLOW_CONFIG_FILE } from '@devflow/common';

const execAsync = promisify(exec);

export class ProjectAdapter {
  private profile?: DevflowProfile;
  private workspacePath: string;
  private logger = createLogger('ProjectAdapter');

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Load and validate .devflow.yml configuration
   */
  async loadProfile(): Promise<DevflowProfile> {
    this.logger.info('Loading DevFlow profile', { workspacePath: this.workspacePath });

    const configPath = path.join(this.workspacePath, DEVFLOW_CONFIG_FILE);

    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const rawProfile = yaml.parse(configContent);

      // TODO: Validate with Zod schema (from @devflow/common)
      this.profile = rawProfile as DevflowProfile;

      this.logger.info('DevFlow profile loaded', { project: this.profile.project.name });
      return this.profile;
    } catch (error) {
      this.logger.error('Failed to load DevFlow profile', error as Error);
      throw new ConfigurationError(`Failed to load ${DEVFLOW_CONFIG_FILE}`, {
        workspacePath: this.workspacePath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get loaded profile
   */
  getProfile(): DevflowProfile {
    if (!this.profile) {
      throw new ConfigurationError('Profile not loaded. Call loadProfile() first');
    }
    return this.profile;
  }

  /**
   * Execute a standard command from .devflow.yml
   */
  async executeCommand(
    commandName: keyof DevflowProfile['commands'],
    options?: { timeout?: number; env?: Record<string, string> },
  ): Promise<CommandResult> {
    if (!this.profile) {
      throw new ConfigurationError('Profile not loaded. Call loadProfile() first');
    }

    const command = this.profile.commands[commandName];
    if (!command) {
      throw new ConfigurationError(`Command '${String(commandName)}' not found in profile`);
    }

    if (typeof command !== 'string') {
      throw new ConfigurationError(`Command '${String(commandName)}' must be a string`);
    }

    return this.executeRawCommand(command, options);
  }

  /**
   * Execute a custom command from .devflow.yml
   */
  async executeCustomCommand(
    commandName: string,
    options?: { timeout?: number; env?: Record<string, string> },
  ): Promise<CommandResult> {
    if (!this.profile) {
      throw new ConfigurationError('Profile not loaded');
    }

    const command = this.profile.commands.custom?.[commandName];
    if (!command) {
      throw new ConfigurationError(`Custom command '${commandName}' not found in profile`);
    }

    return this.executeRawCommand(command, options);
  }

  /**
   * Execute raw command with guardrails
   */
  async executeRawCommand(
    command: string,
    options?: { timeout?: number; env?: Record<string, string> },
  ): Promise<CommandResult> {
    this.logger.info('Executing command', { command });

    const timeout = options?.timeout || this.profile?.advanced?.timeout || 1800000; // 30 min default
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspacePath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout,
        env: {
          ...process.env,
          ...options?.env,
        },
      });

      const duration = Date.now() - startTime;

      this.logger.info('Command executed successfully', { command, duration });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        duration,
        command,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.logger.error('Command failed', error, { command, duration });

      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        duration,
        command,
      };
    }
  }

  /**
   * Validate file paths against guardrails
   */
  async validateFilePaths(filePaths: string[]): Promise<GuardrailsValidationResult> {
    if (!this.profile?.guardrails) {
      // No guardrails configured, allow everything
      return { valid: true, violations: [] };
    }

    const violations: GuardrailsViolation[] = [];
    const guardrails = this.profile.guardrails;

    for (const filePath of filePaths) {
      // Normalize path
      const normalizedPath = path.normalize(filePath);

      // Check forbidden paths
      if (guardrails.forbidden_paths) {
        for (const forbidden of guardrails.forbidden_paths) {
          if (this.matchesPattern(normalizedPath, forbidden)) {
            violations.push({
              type: 'forbidden_path',
              message: `File '${filePath}' matches forbidden path pattern '${forbidden}'`,
              details: { filePath, pattern: forbidden },
            });
          }
        }
      }

      // Check allowed write paths
      if (guardrails.allow_write_paths && guardrails.allow_write_paths.length > 0) {
        const isAllowed = guardrails.allow_write_paths.some((allowedPath: string) =>
          this.matchesPattern(normalizedPath, allowedPath),
        );

        if (!isAllowed) {
          violations.push({
            type: 'outside_allowed_paths',
            message: `File '${filePath}' is outside allowed write paths`,
            details: { filePath, allowedPaths: guardrails.allow_write_paths },
          });
        }
      }

      // Check file size (if file exists)
      if (guardrails.max_file_size_kb) {
        try {
          const fullPath = path.join(this.workspacePath, filePath);
          const stats = await fs.stat(fullPath);
          const sizeKb = stats.size / 1024;

          if (sizeKb > guardrails.max_file_size_kb) {
            violations.push({
              type: 'file_too_large',
              message: `File '${filePath}' (${sizeKb.toFixed(2)}KB) exceeds max size ${guardrails.max_file_size_kb}KB`,
              details: { filePath, sizeKb, maxSizeKb: guardrails.max_file_size_kb },
            });
          }
        } catch {
          // File doesn't exist yet, skip size check
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Check if commit count exceeds limit
   */
  async validateCommitCount(currentCount: number): Promise<GuardrailsValidationResult> {
    if (!this.profile?.guardrails?.max_commits) {
      return { valid: true, violations: [] };
    }

    if (currentCount >= this.profile.guardrails.max_commits) {
      return {
        valid: false,
        violations: [
          {
            type: 'max_commits_exceeded',
            message: `Commit count (${currentCount}) exceeds maximum (${this.profile.guardrails.max_commits})`,
            details: { currentCount, maxCommits: this.profile.guardrails.max_commits },
          },
        ],
      };
    }

    return { valid: true, violations: [] };
  }

  /**
   * Validate changes against total changes limit
   */
  async validateChangesSize(additions: number, deletions: number): Promise<GuardrailsValidationResult> {
    if (!this.profile?.guardrails?.max_total_changes) {
      return { valid: true, violations: [] };
    }

    const totalChanges = additions + deletions;
    const maxChanges = this.profile.guardrails.max_total_changes;

    if (totalChanges > maxChanges) {
      return {
        valid: false,
        violations: [
          {
            type: 'too_many_changes',
            message: `Total changes (${totalChanges}) exceeds maximum (${maxChanges})`,
            details: { additions, deletions, totalChanges, maxChanges },
          },
        ],
      };
    }

    return { valid: true, violations: [] };
  }

  /**
   * Get project structure as a tree string
   */
  async getProjectStructure(maxDepth = 3): Promise<string> {
    this.logger.info('Getting project structure', { maxDepth });

    const ignored = this.profile?.files.ignore || ['node_modules', 'dist', '.git'];
    const tree: string[] = [];

    const walk = async (dir: string, depth: number, prefix = '') => {
      if (depth > maxDepth) return;

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip ignored patterns
        if (ignored.some((pattern) => entry.name.includes(pattern))) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        tree.push(`${prefix}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`);

        if (entry.isDirectory() && depth < maxDepth) {
          await walk(fullPath, depth + 1, prefix + '  ');
        }
      }
    };

    await walk(this.workspacePath, 0);
    return tree.join('\n');
  }

  /**
   * Read file from workspace
   */
  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.workspacePath, filePath);
    this.logger.info('Reading file', { filePath });

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      this.logger.error('Failed to read file', error as Error, { filePath });
      throw error;
    }
  }

  /**
   * Write file to workspace (with guardrails validation)
   */
  async writeFile(filePath: string, content: string, skipValidation = false): Promise<void> {
    const fullPath = path.join(this.workspacePath, filePath);
    this.logger.info('Writing file', { filePath });

    // Validate against guardrails
    if (!skipValidation) {
      const validation = await this.validateFilePaths([filePath]);
      if (!validation.valid) {
        throw new ConfigurationError('Guardrails violation', {
          violations: validation.violations,
        });
      }
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      this.logger.error('Failed to write file', error as Error, { filePath });
      throw error;
    }
  }

  /**
   * Check if quality gates pass
   */
  async checkQualityGates(results: Record<string, CommandResult>): Promise<boolean> {
    if (!this.profile) {
      throw new ConfigurationError('Profile not loaded');
    }

    const required = this.profile.quality_gates.required;
    const allPassed = required.every((gate: string) => results[gate]?.success);

    this.logger.info('Quality gates check', { allPassed, required });

    return allPassed;
  }

  /**
   * Get acceptance criteria from task (if configured in Notion)
   */
  getAcceptanceCriteria(task: any): string[] {
    if (!this.profile?.notion?.field_mapping.acceptance_criteria) {
      return [];
    }

    const acField = this.profile.notion.field_mapping.acceptance_criteria;
    const criteria = task.metadata?.[acField] || task.acceptanceCriteria || [];

    if (typeof criteria === 'string') {
      return criteria.split('\n').filter((line: string) => line.trim());
    }

    return Array.isArray(criteria) ? criteria : [];
  }

  // Private helpers

  private matchesPattern(filePath: string, patternStr: string): boolean {
    // Simple glob matching (can be enhanced with a proper glob library)
    const regexPattern = patternStr
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(filePath);
  }
}
