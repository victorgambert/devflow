/**
 * GitLab VCS Provider Implementation (Stub)
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
  createLogger,
  ExternalServiceError,
} from '@devflow/common';

import { VCSDriver } from './vcs.interface';

export class GitLabProvider implements VCSDriver {
  private logger = createLogger('GitLabProvider');
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.logger.warn('GitLabProvider is a stub implementation');
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async createBranch(
    owner: string,
    repo: string,
    options: CreateBranchOptions,
  ): Promise<Branch> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequest> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    updates: Partial<CreatePROptions>,
  ): Promise<PullRequest> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async mergePullRequest(owner: string, repo: string, number: number): Promise<void> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async commitFiles(owner: string, repo: string, options: CommitOptions): Promise<Commit> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getCommits(owner: string, repo: string, ref: string): Promise<Commit[]> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getFileChanges(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<FileChange[]> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }

  async getDirectoryTree(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string[]> {
    throw new ExternalServiceError('GitLab provider not yet implemented', 'gitlab');
  }
}

