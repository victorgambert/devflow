/**
 * VCS Activities
 */

import { createLogger } from '@devflow/common';
import { createVCSDriver } from '@devflow/sdk';

const logger = createLogger('VCSActivities');

export interface CreateBranchInput {
  projectId: string;
  branchName: string;
  baseBranch: string;
}

export async function createBranch(input: CreateBranchInput): Promise<void> {
  logger.info('Creating branch', input);

  const vcs = createVCSDriver({
    provider: 'github',
    token: process.env.GITHUB_TOKEN || '',
  });

  // TODO: Get owner/repo from project config
  await vcs.createBranch('owner', 'repo', {
    name: input.branchName,
    from: input.baseBranch,
  });
}

export interface CommitFilesInput {
  projectId: string;
  branchName: string;
  files: Array<{ path: string; content: string }>;
  message: string;
}

export async function commitFiles(input: CommitFilesInput): Promise<void> {
  logger.info('Committing files', { ...input, filesCount: input.files.length });

  const vcs = createVCSDriver({
    provider: 'github',
    token: process.env.GITHUB_TOKEN || '',
  });

  await vcs.commitFiles('owner', 'repo', {
    branch: input.branchName,
    message: input.message,
    files: input.files,
  });
}

export interface CreatePullRequestInput {
  projectId: string;
  branchName: string;
  title: string;
  description: string;
}

export interface CreatePullRequestOutput {
  number: number;
  url: string;
}

export async function createPullRequest(
  input: CreatePullRequestInput,
): Promise<CreatePullRequestOutput> {
  logger.info('Creating pull request', input);

  const vcs = createVCSDriver({
    provider: 'github',
    token: process.env.GITHUB_TOKEN || '',
  });

  const pr = await vcs.createPullRequest('owner', 'repo', {
    title: input.title,
    body: input.description,
    sourceBranch: input.branchName,
    targetBranch: 'main',
  });

  return {
    number: pr.number,
    url: pr.url,
  };
}

export interface MergePullRequestInput {
  projectId: string;
  prNumber: number;
}

export async function mergePullRequest(input: MergePullRequestInput): Promise<void> {
  logger.info('Merging pull request', input);

  const vcs = createVCSDriver({
    provider: 'github',
    token: process.env.GITHUB_TOKEN || '',
  });

  await vcs.mergePullRequest('owner', 'repo', input.prNumber);
}

