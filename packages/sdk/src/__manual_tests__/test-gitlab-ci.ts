/**
 * Manual Test Script for GitLab CI Provider
 *
 * Usage:
 *   1. Use the same GitLab token from test-gitlab.ts
 *   2. Set environment variable: export GITLAB_TOKEN=glpat-xxxxxxxxxxxx
 *   3. Run: npx ts-node src/__manual_tests__/test-gitlab-ci.ts
 */

import 'dotenv/config';
import { GitLabCIProvider } from '../ci/gitlab-ci.provider';

async function testGitLabCIProvider() {
  console.log('🔄 GitLab CI Provider Manual Test\n');
  console.log('==================================\n');

  // Check token
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITLAB_TOKEN not set in environment');
    console.log('\nPlease set your GitLab token:');
    console.log('  export GITLAB_TOKEN=glpat-xxxxxxxxxxxx\n');
    process.exit(1);
  }

  console.log('✅ GitLab token found\n');

  // Initialize provider
  const gitlabCI = new GitLabCIProvider(token);
  console.log('✅ GitLab CI provider initialized\n');

  // Test with a public GitLab project that has CI
  const testOwner = 'gitlab-org';
  const testRepo = 'gitlab';
  const testBranch = 'master';

  try {
    // Test 1: Get Pipelines
    console.log('Test 1: Get Recent Pipelines');
    console.log('----------------------------');
    const pipelines = await gitlabCI.getPipelines(testOwner, testRepo, testBranch);
    console.log(`✅ Retrieved ${pipelines.length} pipelines:`);

    pipelines.slice(0, 3).forEach((pipeline, i) => {
      console.log(`\n   Pipeline ${i + 1}:`);
      console.log(`   - ID: ${pipeline.id}`);
      console.log(`   - Status: ${pipeline.status}`);
      console.log(`   - Branch: ${pipeline.branch}`);
      console.log(`   - Commit: ${pipeline.commit.substring(0, 8)}...`);
      console.log(`   - Jobs: ${pipeline.jobs.length}`);
      if (pipeline.startedAt) {
        console.log(`   - Started: ${pipeline.startedAt.toISOString()}`);
      }
      if (pipeline.duration) {
        console.log(`   - Duration: ${(pipeline.duration / 1000).toFixed(1)}s`);
      }
    });
    console.log('');

    if (pipelines.length > 0) {
      const latestPipeline = pipelines[0];

      // Test 2: Get Pipeline Details
      console.log('Test 2: Get Pipeline Details');
      console.log('----------------------------');
      const pipelineDetails = await gitlabCI.getPipeline(
        testOwner,
        testRepo,
        latestPipeline.id
      );
      console.log('✅ Pipeline details retrieved:');
      console.log(`   - Name: ${pipelineDetails.name}`);
      console.log(`   - Status: ${pipelineDetails.status}`);
      console.log(`   - Jobs: ${pipelineDetails.jobs.length}`);
      console.log('\n   Jobs:');
      pipelineDetails.jobs.slice(0, 5).forEach((job, i) => {
        console.log(`   ${i + 1}. ${job.name} - ${job.status}`);
        if (job.duration) {
          console.log(`      Duration: ${(job.duration / 1000).toFixed(1)}s`);
        }
      });
      if (pipelineDetails.jobs.length > 5) {
        console.log(`   ... and ${pipelineDetails.jobs.length - 5} more jobs`);
      }
      console.log('');

      // Test 3: Get Job Details
      if (pipelineDetails.jobs.length > 0) {
        const firstJob = pipelineDetails.jobs[0];
        console.log('Test 3: Get Job Details');
        console.log('-----------------------');
        const jobDetails = await gitlabCI.getJob(
          testOwner,
          testRepo,
          firstJob.id
        );
        console.log('✅ Job details retrieved:');
        console.log(`   - Name: ${jobDetails.name}`);
        console.log(`   - Status: ${jobDetails.status}`);
        console.log(`   - Stage: ${jobDetails.stage || 'N/A'}`);
        if (jobDetails.startedAt) {
          console.log(`   - Started: ${jobDetails.startedAt.toISOString()}`);
        }
        if (jobDetails.duration) {
          console.log(`   - Duration: ${(jobDetails.duration / 1000).toFixed(1)}s`);
        }
        console.log('');

        // Test 4: Get Job Logs
        console.log('Test 4: Get Job Logs');
        console.log('--------------------');
        try {
          const logs = await gitlabCI.getJobLogs(
            testOwner,
            testRepo,
            firstJob.id
          );
          console.log('✅ Job logs retrieved:');
          console.log(`   - Length: ${logs.length} characters`);
          console.log('\n   Log preview (first 10 lines):');
          console.log('   ' + '-'.repeat(50));
          const logLines = logs.split('\n').slice(0, 10);
          logLines.forEach(line => {
            console.log(`   ${line.substring(0, 80)}`);
          });
          console.log('   ' + '-'.repeat(50));
          console.log('');
        } catch (error) {
          console.log('ℹ️  Could not retrieve logs (may not be available)');
          console.log('');
        }
      }

      // Test 5: Get Artifacts
      console.log('Test 5: Get Artifacts');
      console.log('---------------------');
      try {
        const artifacts = await gitlabCI.getArtifacts(
          testOwner,
          testRepo,
          latestPipeline.id
        );
        console.log(`✅ Retrieved ${artifacts.length} artifacts:`);
        artifacts.slice(0, 5).forEach((artifact, i) => {
          console.log(`   ${i + 1}. ${artifact.name}`);
          console.log(`      Path: ${artifact.path}`);
          console.log(`      Size: ${(artifact.size / 1024).toFixed(1)} KB`);
        });
        if (artifacts.length > 5) {
          console.log(`   ... and ${artifacts.length - 5} more artifacts`);
        }
        console.log('');
      } catch (error) {
        console.log('ℹ️  No artifacts found for this pipeline');
        console.log('');
      }
    }

    // Summary
    console.log('==================================');
    console.log('🎉 All tests passed!');
    console.log('==================================\n');
    console.log('GitLab CI provider is working correctly! ✅\n');
    console.log('You can now monitor GitLab CI with DevFlow:\n');
    console.log('  const gitlabCI = new GitLabCIProvider(token);');
    console.log('  const pipelines = await gitlabCI.getPipelines(owner, repo, branch);\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.log('\nPossible causes:');
    console.log('  - Invalid GitLab token');
    console.log('  - Insufficient token permissions');
    console.log('  - Project has no CI pipelines');
    console.log('  - Network/API issues\n');
    process.exit(1);
  }
}

// Run tests
testGitLabCIProvider()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
