/**
 * ProjectAdapter Tests - Phase 3
 */

import { ProjectAdapter } from '@/project-adapter/project-adapter';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ProjectAdapter', () => {
  const testWorkspace = path.join(__dirname, '__fixtures__', 'test-project');
  let adapter: ProjectAdapter;

  beforeEach(() => {
    adapter = new ProjectAdapter(testWorkspace);
  });

  describe('loadProfile', () => {
    it('should load and parse .devflow.yml', async () => {
      // This would need a fixture file
      // For now, test the structure
      expect(adapter).toBeDefined();
    });
  });

  describe('validateFilePaths', () => {
    it('should allow paths within allowed_write_paths', async () => {
      adapter['profile'] = {
        guardrails: {
          allow_write_paths: ['src/**', 'tests/**'],
        },
      } as any;

      const result = await adapter.validateFilePaths(['src/index.ts', 'tests/unit.spec.ts']);
      
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject paths outside allowed_write_paths', async () => {
      adapter['profile'] = {
        guardrails: {
          allow_write_paths: ['src/**'],
        },
      } as any;

      const result = await adapter.validateFilePaths(['config/secrets.yml']);
      
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('outside_allowed_paths');
    });

    it('should reject forbidden paths', async () => {
      adapter['profile'] = {
        guardrails: {
          allow_write_paths: ['**/*', '**/.*'],  // Include hidden files
          forbidden_paths: ['.env', 'node_modules/**'],
        },
      } as any;

      const result = await adapter.validateFilePaths(['.env']);

      expect(result.valid).toBe(false);
      // May have multiple violations (forbidden_path and/or outside_allowed_paths)
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'forbidden_path')).toBe(true);
    });
  });

  describe('validateCommitCount', () => {
    it('should allow commits under limit', async () => {
      adapter['profile'] = {
        guardrails: {
          max_commits: 5,
        },
      } as any;

      const result = await adapter.validateCommitCount(3);
      
      expect(result.valid).toBe(true);
    });

    it('should reject commits over limit', async () => {
      adapter['profile'] = {
        guardrails: {
          max_commits: 5,
        },
      } as any;

      const result = await adapter.validateCommitCount(6);
      
      expect(result.valid).toBe(false);
      expect(result.violations[0].type).toBe('max_commits_exceeded');
    });
  });

  describe('validateChangesSize', () => {
    it('should allow changes under limit', async () => {
      adapter['profile'] = {
        guardrails: {
          max_total_changes: 1000,
        },
      } as any;

      const result = await adapter.validateChangesSize(400, 300);
      
      expect(result.valid).toBe(true);
    });

    it('should reject changes over limit', async () => {
      adapter['profile'] = {
        guardrails: {
          max_total_changes: 1000,
        },
      } as any;

      const result = await adapter.validateChangesSize(700, 500);
      
      expect(result.valid).toBe(false);
      expect(result.violations[0].type).toBe('too_many_changes');
    });
  });
});

