/**
 * GitHub Actions CI Provider Implementation
 */

import { Octokit } from '@octokit/rest';
import {
  CIPipeline,
  CIJob,
  CIArtifact,
  TestResults,
  CoverageReport,
  CIStatus,
  createLogger,
} from '@soma-squad-ai/common';

import { CIDriver } from './ci.interface';

export class GitHubActionsProvider implements CIDriver {
  private octokit: Octokit;
  private logger = createLogger('GitHubActionsProvider');

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPipeline(owner: string, repo: string, runId: string): Promise<CIPipeline> {
    this.logger.info('Getting pipeline', { owner, repo, runId });

    const { data: run } = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: parseInt(runId, 10),
    });

    const { data: jobsData } = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: parseInt(runId, 10),
    });

    const jobs: CIJob[] = jobsData.jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      status: this.mapStatus(job.status, job.conclusion),
      startedAt: job.started_at ? new Date(job.started_at) : undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      duration: this.calculateDuration(job.started_at ?? undefined, job.completed_at ?? undefined),
      url: job.html_url || '',
    }));

    return {
      id: String(run.id),
      name: run.name || '',
      status: this.mapStatus(run.status, run.conclusion),
      branch: run.head_branch || '',
      commit: run.head_sha,
      startedAt: run.run_started_at ? new Date(run.run_started_at) : undefined,
      completedAt: run.updated_at ? new Date(run.updated_at) : undefined,
      duration: this.calculateDuration(run.run_started_at ?? undefined, run.updated_at),
      url: run.html_url || '',
      jobs,
    };
  }

  async getPipelines(owner: string, repo: string, branch: string): Promise<CIPipeline[]> {
    this.logger.info('Getting pipelines', { owner, repo, branch });

    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch,
      per_page: 10,
    });

    return Promise.all(
      data.workflow_runs.map((run) => this.getPipeline(owner, repo, String(run.id))),
    );
  }

  async getPipelineForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<CIPipeline | null> {
    this.logger.info('Getting pipeline for commit', { owner, repo, commitSha });

    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      head_sha: commitSha,
      per_page: 1,
    });

    if (data.workflow_runs.length === 0) {
      return null;
    }

    return this.getPipeline(owner, repo, String(data.workflow_runs[0].id));
  }

  async triggerPipeline(owner: string, repo: string, branch: string): Promise<CIPipeline> {
    this.logger.info('Triggering pipeline', { owner, repo, branch });

    // List workflows
    const { data: workflows } = await this.octokit.actions.listRepoWorkflows({
      owner,
      repo,
    });

    if (workflows.workflows.length === 0) {
      throw new Error('No workflows found');
    }

    // Trigger the first workflow
    const workflow = workflows.workflows[0];
    await this.octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflow.id,
      ref: branch,
    });

    // Wait a bit for the run to be created
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the latest run
    const { data: runs } = await this.octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflow.id,
      branch,
      per_page: 1,
    });

    if (runs.workflow_runs.length === 0) {
      throw new Error('Failed to trigger workflow');
    }

    return this.getPipeline(owner, repo, String(runs.workflow_runs[0].id));
  }

  async getJob(owner: string, repo: string, jobId: string): Promise<CIJob> {
    this.logger.info('Getting job', { owner, repo, jobId });

    const { data: job } = await this.octokit.actions.getJobForWorkflowRun({
      owner,
      repo,
      job_id: parseInt(jobId, 10),
    });

    return {
      id: String(job.id),
      name: job.name,
      status: this.mapStatus(job.status, job.conclusion),
      startedAt: job.started_at ? new Date(job.started_at) : undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      duration: this.calculateDuration(job.started_at ?? undefined, job.completed_at ?? undefined),
      url: job.html_url || '',
    };
  }

  async getJobLogs(owner: string, repo: string, jobId: string): Promise<string> {
    this.logger.info('Getting job logs', { owner, repo, jobId });

    const { data } = await this.octokit.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: parseInt(jobId, 10),
    });

    return data as unknown as string;
  }

  async getArtifacts(owner: string, repo: string, runId: string): Promise<CIArtifact[]> {
    this.logger.info('Getting artifacts', { owner, repo, runId });

    const { data } = await this.octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: parseInt(runId, 10),
    });

    return data.artifacts.map((artifact) => ({
      name: artifact.name,
      path: artifact.name,
      size: artifact.size_in_bytes,
      url: artifact.archive_download_url,
    }));
  }

  async downloadArtifact(owner: string, repo: string, artifactId: string): Promise<Buffer> {
    this.logger.info('Downloading artifact', { owner, repo, artifactId });

    const { data } = await this.octokit.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: parseInt(artifactId, 10),
      archive_format: 'zip',
    });

    return Buffer.from(data as ArrayBuffer);
  }

  async parseTestResults(artifactContent: string): Promise<TestResults> {
    // Basic parser - implement based on your test report format (JUnit XML, etc.)
    this.logger.info('Parsing test results');

    try {
      const data = JSON.parse(artifactContent);
      return {
        total: data.numTotalTests || 0,
        passed: data.numPassedTests || 0,
        failed: data.numFailedTests || 0,
        skipped: data.numPendingTests || 0,
        duration: data.testResults?.reduce((acc: number, r: any) => acc + r.perfStats?.runtime || 0, 0) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to parse test results', error as Error);
      return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
    }
  }

  async parseCoverageReport(artifactContent: string): Promise<CoverageReport> {
    // Basic parser - implement based on your coverage report format
    this.logger.info('Parsing coverage report');

    try {
      const data = JSON.parse(artifactContent);
      return {
        lines: this.parseMetric(data.total?.lines),
        branches: this.parseMetric(data.total?.branches),
        functions: this.parseMetric(data.total?.functions),
        statements: this.parseMetric(data.total?.statements),
      };
    } catch (error) {
      this.logger.error('Failed to parse coverage report', error as Error);
      return {
        lines: { total: 0, covered: 0, percentage: 0 },
        branches: { total: 0, covered: 0, percentage: 0 },
        functions: { total: 0, covered: 0, percentage: 0 },
        statements: { total: 0, covered: 0, percentage: 0 },
      };
    }
  }

  private parseMetric(data: any): { total: number; covered: number; percentage: number } {
    return {
      total: data?.total || 0,
      covered: data?.covered || 0,
      percentage: data?.pct || 0,
    };
  }

  private mapStatus(status: string | null, conclusion: string | null): CIStatus {
    if (status === 'completed') {
      if (conclusion === 'success') return CIStatus.SUCCESS;
      if (conclusion === 'failure') return CIStatus.FAILURE;
      if (conclusion === 'cancelled') return CIStatus.CANCELLED;
      if (conclusion === 'skipped') return CIStatus.SKIPPED;
      return CIStatus.FAILURE;
    }
    if (status === 'in_progress') return CIStatus.RUNNING;
    return CIStatus.PENDING;
  }

  private calculateDuration(startedAt?: string, completedAt?: string): number | undefined {
    if (!startedAt || !completedAt) return undefined;
    return new Date(completedAt).getTime() - new Date(startedAt).getTime();
  }
}

