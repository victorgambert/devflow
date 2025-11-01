/**
 * GitHub Provider Integration Tests
 */

import { GitHubProvider } from '../github.provider';

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  const token = process.env.GITHUB_TOKEN || 'test-token';
  const testRepo = { owner: 'test-owner', repo: 'test-repo' };

  beforeEach(() => {
    provider = new GitHubProvider(token);
  });

  describe('Repository Operations', () => {
    it('should get repository information', async () => {
      if (!process.env.GITHUB_TOKEN) {
        console.log('Skipping test: GITHUB_TOKEN not set');
        return;
      }

      const repo = await provider.getRepository(testRepo.owner, testRepo.repo);
      
      expect(repo).toBeDefined();
      expect(repo.owner).toBe(testRepo.owner);
      expect(repo.name).toBe(testRepo.repo);
      expect(repo.url).toContain('github.com');
    });
  });

  describe('Branch Operations', () => {
    it('should get branch information', async () => {
      if (!process.env.GITHUB_TOKEN) {
        console.log('Skipping test: GITHUB_TOKEN not set');
        return;
      }

      const branch = await provider.getBranch(testRepo.owner, testRepo.repo, 'main');
      
      expect(branch).toBeDefined();
      expect(branch.name).toBe('main');
      expect(branch.sha).toBeDefined();
    });

    it('should create and delete a branch', async () => {
      if (!process.env.GITHUB_TOKEN || process.env.NODE_ENV === 'production') {
        console.log('Skipping test: requires GITHUB_TOKEN and non-production env');
        return;
      }

      const branchName = `test-branch-${Date.now()}`;

      // Create branch
      const branch = await provider.createBranch(testRepo.owner, testRepo.repo, {
        name: branchName,
        from: 'main',
      });

      expect(branch.name).toBe(branchName);

      // Delete branch
      await provider.deleteBranch(testRepo.owner, testRepo.repo, branchName);
    });
  });

  describe('Pull Request Operations', () => {
    it('should get pull request', async () => {
      if (!process.env.GITHUB_TOKEN) {
        console.log('Skipping test: GITHUB_TOKEN not set');
        return;
      }

      // Assuming PR #1 exists in test repo
      const pr = await provider.getPullRequest(testRepo.owner, testRepo.repo, 1);
      
      expect(pr).toBeDefined();
      expect(pr.number).toBe(1);
      expect(pr.url).toContain('github.com');
    });
  });

  describe('File Operations', () => {
    it('should get file content', async () => {
      if (!process.env.GITHUB_TOKEN) {
        console.log('Skipping test: GITHUB_TOKEN not set');
        return;
      }

      const content = await provider.getFileContent(
        testRepo.owner,
        testRepo.repo,
        'README.md',
      );
      
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
    });
  });
});

