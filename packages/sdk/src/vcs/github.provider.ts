/**
 * GitHub VCS Provider Implementation
 */

import { Octokit } from '@octokit/rest';
import {
  Repository,
  Branch,
  PullRequest,
  Commit,
  FileChange,
  CreatePROptions,
  CreateBranchOptions,
  CommitOptions,
  PRStatus,
  createLogger,
} from '@soma-squad-ai/common';

import { VCSDriver } from './vcs.interface';

export class GitHubProvider implements VCSDriver {
  private octokit: Octokit;
  private logger = createLogger('GitHubProvider');

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    this.logger.info('Getting repository', { owner, repo });
    const { data } = await this.octokit.repos.get({ owner, repo });

    return {
      owner,
      name: repo,
      fullName: data.full_name,
      url: data.html_url,
      defaultBranch: data.default_branch,
    };
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    this.logger.info('Getting branch', { owner, repo, branch });
    const { data } = await this.octokit.repos.getBranch({ owner, repo, branch });

    return {
      name: data.name,
      sha: data.commit.sha,
      protected: data.protected,
    };
  }

  async createBranch(
    owner: string,
    repo: string,
    options: CreateBranchOptions,
  ): Promise<Branch> {
    this.logger.info('Creating branch', { owner, repo, options });

    // Get the base branch SHA
    const baseBranch = await this.getBranch(owner, repo, options.from);

    // Create the new branch
    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${options.name}`,
      sha: baseBranch.sha,
    });

    return this.getBranch(owner, repo, options.name);
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    this.logger.info('Deleting branch', { owner, repo, branch });
    await this.octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    this.logger.info('Getting pull request', { owner, repo, number });
    const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: number });

    return {
      id: String(data.id),
      number: data.number,
      title: data.title,
      description: data.body || '',
      sourceBranch: data.head.ref,
      targetBranch: data.base.ref,
      author: data.user?.login || '',
      status: this.mapPRStatus(data.state, data.merged_at),
      url: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      mergedAt: data.merged_at ? new Date(data.merged_at) : undefined,
    };
  }

  async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequest> {
    this.logger.info('Creating pull request', { owner, repo, options });

    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title: options.title,
      body: options.body,
      head: options.sourceBranch,
      base: options.targetBranch,
      draft: options.draft,
    });

    // Add reviewers if specified
    if (options.reviewers && options.reviewers.length > 0) {
      await this.octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: data.number,
        reviewers: options.reviewers,
      });
    }

    // Add labels if specified
    if (options.labels && options.labels.length > 0) {
      await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: data.number,
        labels: options.labels,
      });
    }

    return this.getPullRequest(owner, repo, data.number);
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    updates: Partial<CreatePROptions>,
  ): Promise<PullRequest> {
    this.logger.info('Updating pull request', { owner, repo, number, updates });

    await this.octokit.pulls.update({
      owner,
      repo,
      pull_number: number,
      title: updates.title,
      body: updates.body,
    });

    return this.getPullRequest(owner, repo, number);
  }

  async mergePullRequest(owner: string, repo: string, number: number): Promise<void> {
    this.logger.info('Merging pull request', { owner, repo, number });
    await this.octokit.pulls.merge({
      owner,
      repo,
      pull_number: number,
    });
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    this.logger.info('Getting file content', { owner, repo, path, ref });

    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }

    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async commitFiles(owner: string, repo: string, options: CommitOptions): Promise<Commit> {
    this.logger.info('Committing files', { owner, repo, options });

    // Get the current branch
    const branch = await this.getBranch(owner, repo, options.branch);

    // Get the tree of the current commit
    const { data: currentCommit } = await this.octokit.git.getCommit({
      owner,
      repo,
      commit_sha: branch.sha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      options.files.map(async (file: any) => {
        const { data: blob } = await this.octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return { path: file.path, sha: blob.sha };
      }),
    );

    // Create a new tree
    const { data: newTree } = await this.octokit.git.createTree({
      owner,
      repo,
      base_tree: currentCommit.tree.sha,
      tree: blobs.map((blob: any) => ({
        path: blob.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      })),
    });

    // Create a new commit
    const { data: newCommit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message: options.message,
      tree: newTree.sha,
      parents: [branch.sha],
    });

    // Update the branch reference
    await this.octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${options.branch}`,
      sha: newCommit.sha,
    });

    return {
      sha: newCommit.sha,
      message: newCommit.message,
      author: newCommit.author.name,
      date: new Date(newCommit.author.date),
      url: newCommit.html_url,
    };
  }

  async getCommits(owner: string, repo: string, ref: string): Promise<Commit[]> {
    this.logger.info('Getting commits', { owner, repo, ref });

    const { data } = await this.octokit.repos.listCommits({
      owner,
      repo,
      sha: ref,
      per_page: 100,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || '',
      date: new Date(commit.commit.author?.date || Date.now()),
      url: commit.html_url,
    }));
  }

  async getFileChanges(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<FileChange[]> {
    this.logger.info('Getting file changes', { owner, repo, base, head });

    const { data } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    return (data.files || []).map((file) => ({
      path: file.filename,
      status: file.status as 'added' | 'modified' | 'deleted' | 'renamed',
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    }));
  }

  async getDirectoryTree(owner: string, repo: string, path: string, ref?: string): Promise<string[]> {
    this.logger.info('Getting directory tree', { owner, repo, path, ref });

    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (!Array.isArray(data)) {
      return [data.path];
    }

    return data.map((item) => item.path);
  }

  /**
   * Get the complete repository tree (all files recursively)
   */
  async getRepositoryTree(owner: string, repo: string, ref?: string): Promise<Array<{ path: string; type: string; size?: number }>> {
    this.logger.info('Getting repository tree', { owner, repo, ref });

    const branch = ref || (await this.getRepository(owner, repo)).defaultBranch;
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const { data: tree } = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: refData.object.sha,
      recursive: 'true',
    });

    return (tree.tree || []).map((item) => ({
      path: item.path || '',
      type: item.type || 'blob',
      size: item.size,
    }));
  }

  /**
   * Get repository languages (statistics)
   */
  async getRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    this.logger.info('Getting repository languages', { owner, repo });
    const { data } = await this.octokit.repos.listLanguages({ owner, repo });
    return data;
  }

  /**
   * Search code in repository
   */
  async searchCode(owner: string, repo: string, query: string): Promise<Array<{ path: string; content: string }>> {
    this.logger.info('Searching code', { owner, repo, query });

    try {
      const { data } = await this.octokit.search.code({
        q: `${query} repo:${owner}/${repo}`,
        per_page: 10,
      });

      // Get content for each result
      const results = await Promise.all(
        data.items.map(async (item) => {
          try {
            const content = await this.getFileContent(owner, repo, item.path);
            return { path: item.path, content };
          } catch (error) {
            this.logger.warn('Failed to get content for search result', { path: item.path });
            return null;
          }
        }),
      );

      return results.filter((r): r is { path: string; content: string } => r !== null);
    } catch (error) {
      this.logger.error('Code search failed', error as Error);
      return [];
    }
  }

  /**
   * Get multiple files content at once
   */
  async getMultipleFiles(owner: string, repo: string, paths: string[], ref?: string): Promise<Array<{ path: string; content: string }>> {
    this.logger.info('Getting multiple files', { owner, repo, count: paths.length });

    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          const content = await this.getFileContent(owner, repo, path, ref);
          return { path, content };
        } catch (error) {
          this.logger.warn('Failed to get file content', { path });
          return null;
        }
      }),
    );

    return results.filter((r): r is { path: string; content: string } => r !== null);
  }

  /**
   * Check if a file exists in repository
   */
  async fileExists(owner: string, repo: string, path: string, ref?: string): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private mapPRStatus(state: string, mergedAt: string | null): PRStatus {
    if (mergedAt) return PRStatus.MERGED;
    if (state === 'open') return PRStatus.OPEN;
    if (state === 'closed') return PRStatus.CLOSED;
    return PRStatus.DRAFT;
  }
}

