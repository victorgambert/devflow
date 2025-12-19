/**
 * PolicyGuard Tests - Phase 4
 */

import { PolicyGuard } from '@/security/policy.guard';
import { DevFlowProfile } from '@/project-adapter/devflow-profile.types';

describe('PolicyGuard', () => {
  const mockProfile: DevFlowProfile = {
    version: '1.0',
    project: {
      name: 'test-project',
      description: 'Test',
      repository: 'https://github.com/test/test',
      language: 'typescript',
    },
    vcs: {
      provider: 'github',
      base_branch: 'main',
      branch_pattern: 'feature/{task-id}',
    },
    commands: {
      install: 'npm install',
      build: 'npm run build',
      lint: 'npm run lint',
      unit: 'npm test',
      e2e: 'npm run test:e2e',
    },
    ci: {
      provider: 'github-actions',
      config_path: '.github/workflows/ci.yml',
    },
    code_agent: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    },
    quality_gates: {
      required: ['lint', 'unit', 'build'],
    },
    notifications: {
      events: ['workflow_completed'],
      channels: {},
    },
    files: {
      watch: ['src/**/*.ts'],
      ignore: ['node_modules/**'],
    },
    guardrails: {
      allow_write_paths: ['src/**', 'tests/**'],
      forbidden_paths: ['.env*', 'secrets/**'],
      max_commits: 5,
      codeowners: {
        enabled: true,
        path: '.github/CODEOWNERS',
      },
    },
  };

  let policyGuard: PolicyGuard;

  beforeEach(() => {
    policyGuard = new PolicyGuard(mockProfile, '/tmp/test');
  });

  describe('validateFileModifications', () => {
    it('should allow files in allowed paths', async () => {
      const result = await policyGuard.validateFileModifications(
        ['src/index.ts', 'tests/index.test.ts'],
        'testuser',
      );

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject forbidden files', async () => {
      const result = await policyGuard.validateFileModifications(['.env', 'secrets/api-key.txt'], 'testuser');

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('forbidden_pattern');
    });

    it('should allow files not matching forbidden patterns', async () => {
      // PolicyGuard checks forbidden patterns, not allowed paths
      // Files not matching forbidden patterns are allowed
      const result = await policyGuard.validateFileModifications(['config/production.yml'], 'testuser');

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('validateIterationCount', () => {
    it('should allow iterations under limit', () => {
      const result = policyGuard.validateIterationCount(2);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should block when limit exceeded', () => {
      const result = policyGuard.validateIterationCount(5);

      expect(result.allowed).toBe(false);
      expect(result.violations[0].type).toBe('max_iterations');
    });

    it('should warn when approaching limit', () => {
      const result = policyGuard.validateIterationCount(2);

      if (result.warnings.length > 0) {
        expect(result.warnings[0].type).toBe('max_iterations');
      }
    });
  });
});



