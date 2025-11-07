/**
 * CI Driver Interface - Abstraction for CI/CD systems
 */

import { CIPipeline, CIJob, CIArtifact, TestResults, CoverageReport } from '@soma-squad-ai/common';

export interface CIDriver {
  /**
   * Get pipeline/workflow run by ID
   */
  getPipeline(owner: string, repo: string, runId: string): Promise<CIPipeline>;

  /**
   * Get pipelines for a branch
   */
  getPipelines(owner: string, repo: string, branch: string): Promise<CIPipeline[]>;

  /**
   * Get pipeline for a specific commit
   */
  getPipelineForCommit(owner: string, repo: string, commitSha: string): Promise<CIPipeline | null>;

  /**
   * Trigger a pipeline
   */
  triggerPipeline(owner: string, repo: string, branch: string): Promise<CIPipeline>;

  /**
   * Get job details
   */
  getJob(owner: string, repo: string, jobId: string): Promise<CIJob>;

  /**
   * Get job logs
   */
  getJobLogs(owner: string, repo: string, jobId: string): Promise<string>;

  /**
   * Get artifacts for a pipeline
   */
  getArtifacts(owner: string, repo: string, runId: string): Promise<CIArtifact[]>;

  /**
   * Download artifact
   */
  downloadArtifact(owner: string, repo: string, artifactId: string): Promise<Buffer>;

  /**
   * Parse test results from artifacts
   */
  parseTestResults(artifactContent: string): Promise<TestResults>;

  /**
   * Parse coverage report from artifacts
   */
  parseCoverageReport(artifactContent: string): Promise<CoverageReport>;
}

