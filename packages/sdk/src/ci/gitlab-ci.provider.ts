/**
 * GitLab CI Provider Implementation (Stub)
 */

import {
  CIPipeline,
  CIJob,
  CIArtifact,
  TestResults,
  CoverageReport,
  createLogger,
  ExternalServiceError,
} from '@devflow/common';

import { CIDriver } from './ci.interface';

export class GitLabCIProvider implements CIDriver {
  private logger = createLogger('GitLabCIProvider');
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.logger.warn('GitLabCIProvider is a stub implementation');
  }

  async getPipeline(owner: string, repo: string, runId: string): Promise<CIPipeline> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async getPipelines(owner: string, repo: string, branch: string): Promise<CIPipeline[]> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async getPipelineForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<CIPipeline | null> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async triggerPipeline(owner: string, repo: string, branch: string): Promise<CIPipeline> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async getJob(owner: string, repo: string, jobId: string): Promise<CIJob> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async getJobLogs(owner: string, repo: string, jobId: string): Promise<string> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async getArtifacts(owner: string, repo: string, runId: string): Promise<CIArtifact[]> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async downloadArtifact(owner: string, repo: string, artifactId: string): Promise<Buffer> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async parseTestResults(artifactContent: string): Promise<TestResults> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }

  async parseCoverageReport(artifactContent: string): Promise<CoverageReport> {
    throw new ExternalServiceError('GitLab CI provider not yet implemented', 'gitlab');
  }
}

