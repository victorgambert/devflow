/**
 * Version Control System Types
 */

export interface VCSProvider {
  name: 'github';
}

export interface Repository {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  status: PRStatus;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
}

export enum PRStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
  DRAFT = 'draft',
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: Date;
  url: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CreatePROptions {
  title: string;
  body: string;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
  reviewers?: string[];
  labels?: string[];
}

export interface CreateBranchOptions {
  name: string;
  from: string;
}

export interface CommitOptions {
  message: string;
  branch: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

