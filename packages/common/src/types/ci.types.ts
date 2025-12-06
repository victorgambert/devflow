/**
 * Continuous Integration Types
 */

export interface CIProvider {
  name: 'github-actions' | 'jenkins' | 'circleci';
}

export enum CIStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

export interface CIPipeline {
  id: string;
  name: string;
  status: CIStatus;
  branch: string;
  commit: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  url: string;
  jobs: CIJob[];
}

export interface CIJob {
  id: string;
  name: string;
  status: CIStatus;
  stage?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  logs?: string;
  url: string;
}

export interface CIArtifact {
  name: string;
  path: string;
  size: number;
  url: string;
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures?: TestFailure[];
}

export interface TestFailure {
  name: string;
  message: string;
  stackTrace?: string;
  file?: string;
  line?: number;
}

export interface CoverageReport {
  lines: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

