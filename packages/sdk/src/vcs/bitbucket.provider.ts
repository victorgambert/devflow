/**
 * Bitbucket VCS Provider Implementation (Stub)
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

export class BitbucketProvider implements VCSDriver {
  private logger = createLogger('BitbucketProvider');
  private username: string;
  private appPassword: string;

  constructor(username: string, appPassword: string) {
    this.username = username;
    this.appPassword = appPassword;
    this.logger.warn('BitbucketProvider is a stub implementation');
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async createBranch(
    owner: string,
    repo: string,
    options: CreateBranchOptions,
  ): Promise<Branch> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequest> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    updates: Partial<CreatePROptions>,
  ): Promise<PullRequest> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async mergePullRequest(owner: string, repo: string, number: number): Promise<void> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async commitFiles(owner: string, repo: string, options: CommitOptions): Promise<Commit> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getCommits(owner: string, repo: string, ref: string): Promise<Commit[]> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getFileChanges(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<FileChange[]> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }

  async getDirectoryTree(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string[]> {
    throw new ExternalServiceError('Bitbucket provider not yet implemented', 'bitbucket');
  }
}

