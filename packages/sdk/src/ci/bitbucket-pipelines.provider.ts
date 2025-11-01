/**
 * Bitbucket Pipelines Provider Implementation (Stub)
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

export class BitbucketPipelinesProvider implements CIDriver {
  private logger = createLogger('BitbucketPipelinesProvider');
  private username: string;
  private appPassword: string;

  constructor(username: string, appPassword: string) {
    this.username = username;
    this.appPassword = appPassword;
    this.logger.warn('BitbucketPipelinesProvider is a stub implementation');
  }

  async getPipeline(owner: string, repo: string, runId: string): Promise<CIPipeline> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async getPipelines(owner: string, repo: string, branch: string): Promise<CIPipeline[]> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async getPipelineForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<CIPipeline | null> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async triggerPipeline(owner: string, repo: string, branch: string): Promise<CIPipeline> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async getJob(owner: string, repo: string, jobId: string): Promise<CIJob> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async getJobLogs(owner: string, repo: string, jobId: string): Promise<string> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async getArtifacts(owner: string, repo: string, runId: string): Promise<CIArtifact[]> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async downloadArtifact(owner: string, repo: string, artifactId: string): Promise<Buffer> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async parseTestResults(artifactContent: string): Promise<TestResults> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }

  async parseCoverageReport(artifactContent: string): Promise<CoverageReport> {
    throw new ExternalServiceError('Bitbucket Pipelines provider not yet implemented', 'bitbucket');
  }
}

