/**
 * VCS Driver Interface - Abstraction for version control systems
 */

import {
  Repository,
  Branch,
  PullRequest,
  Commit,
  FileChange,
  CreatePROptions,
  CreateBranchOptions,
  CommitOptions,
} from '@devflow/common';

/**
 * GitHub Issue Comment
 */
export interface GitHubComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GitHub Issue Context for refinement
 * Used to extract context from linked GitHub issues
 */
export interface GitHubIssueContext {
  id: string;
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  labels: string[];
  assignees: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  comments?: GitHubComment[];
}

export interface VCSDriver {
  /**
   * Get repository information
   */
  getRepository(owner: string, repo: string): Promise<Repository>;

  /**
   * Get a branch
   */
  getBranch(owner: string, repo: string, branch: string): Promise<Branch>;

  /**
   * Create a new branch
   */
  createBranch(owner: string, repo: string, options: CreateBranchOptions): Promise<Branch>;

  /**
   * Delete a branch
   */
  deleteBranch(owner: string, repo: string, branch: string): Promise<void>;

  /**
   * Get pull request by number
   */
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>;

  /**
   * Create a pull request
   */
  createPullRequest(owner: string, repo: string, options: CreatePROptions): Promise<PullRequest>;

  /**
   * Update a pull request
   */
  updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    updates: Partial<CreatePROptions>,
  ): Promise<PullRequest>;

  /**
   * Merge a pull request
   */
  mergePullRequest(owner: string, repo: string, number: number): Promise<void>;

  /**
   * Get file content from repository
   */
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string>;

  /**
   * Create or update files
   */
  commitFiles(owner: string, repo: string, options: CommitOptions): Promise<Commit>;

  /**
   * Get commits for a branch or PR
   */
  getCommits(owner: string, repo: string, ref: string): Promise<Commit[]>;

  /**
   * Get file changes between two refs
   */
  getFileChanges(owner: string, repo: string, base: string, head: string): Promise<FileChange[]>;

  /**
   * Get directory structure
   */
  getDirectoryTree(owner: string, repo: string, path: string, ref?: string): Promise<string[]>;
}

