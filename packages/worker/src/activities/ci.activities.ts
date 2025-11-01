/**
 * CI Activities
 */

import { createLogger, CIStatus } from '@devflow/common';
import { createCIDriver } from '@devflow/sdk';
import { sleep } from '@temporalio/activity';

const logger = createLogger('CIActivities');

export interface WaitForCIInput {
  projectId: string;
  prNumber: number;
}

export interface WaitForCIOutput {
  success: boolean;
  logs: string;
  duration: number;
}

/**
 * Wait for CI to complete and return results
 */
export async function waitForCI(input: WaitForCIInput): Promise<WaitForCIOutput> {
  logger.info('Waiting for CI', input);

  const ci = createCIDriver({
    provider: 'github-actions',
    token: process.env.GITHUB_TOKEN || '',
  });

  const maxAttempts = 60; // 30 minutes (30s intervals)
  let attempts = 0;

  while (attempts < maxAttempts) {
    // TODO: Get commit SHA from PR
    const pipeline = await ci.getPipelineForCommit('owner', 'repo', 'commit-sha');

    if (!pipeline) {
      logger.info('No pipeline found yet, waiting...');
      await sleep(30000); // 30 seconds
      attempts++;
      continue;
    }

    if (pipeline.status === CIStatus.SUCCESS) {
      return {
        success: true,
        logs: '',
        duration: pipeline.duration || 0,
      };
    }

    if (pipeline.status === CIStatus.FAILURE) {
      // Get logs from failed jobs
      const failedJobs = pipeline.jobs.filter((job) => job.status === CIStatus.FAILURE);
      const logs = await Promise.all(
        failedJobs.map((job) => ci.getJobLogs('owner', 'repo', job.id)),
      );

      return {
        success: false,
        logs: logs.join('\n\n'),
        duration: pipeline.duration || 0,
      };
    }

    // Still running
    logger.info('CI still running, waiting...', { status: pipeline.status });
    await sleep(30000);
    attempts++;
  }

  throw new Error('CI timeout after 30 minutes');
}

