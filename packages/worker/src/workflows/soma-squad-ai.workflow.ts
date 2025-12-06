/**
 * Main DevFlow Orchestration Workflow - Phase 3 with Testing ↔ Fix Loop
 */

import { proxyActivities, sleep, ActivityFailure, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, WorkflowStage } from '@soma-squad-ai/common';

// Import activity types
import type * as activities from '../activities';

// Configure activity proxies with advanced retry policies
const {
  // Linear activities
  syncLinearTask,
  updateLinearTask,
  appendSpecToLinearIssue,
  appendWarningToLinearIssue,
  generateSpecification,
  generateCode,
  createBranch,
  commitFiles,
  createPullRequest,
  waitForCI,
  sendNotification,
  mergePullRequest,
  // Phase 3: New QA activities
  generateTests,
  runTests,
  analyzeTestFailures,
  waitForCI: waitForCIWithRetry,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    nonRetryableErrorTypes: ['ValidationError', 'AuthenticationError'],
  },
});

/**
 * Main DevFlow workflow with full Testing ↔ Fix loop (Phase 3)
 */
export async function somaSquadAIWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  let currentStage: WorkflowStage = 'linear_sync' as WorkflowStage;
  let prNumber: number | undefined;
  let branchName: string | undefined;
  const maxFixAttempts = 3;
  let fixAttempts = 0;
  let testFixAttempts = 0;

  try {
    // ============================================
    // Stage 1: Sync task from Linear
    // ============================================
    currentStage = 'linear_sync' as WorkflowStage;
    const task = await syncLinearTask({ taskId: input.taskId, projectId: input.projectId });

    await sendNotification({
      projectId: input.projectId,
      event: 'workflow_started',
      data: { taskId: task.id, title: task.title },
    });

    // Update Linear status to "Specification"
    await updateLinearTask({
      linearId: task.linearId,
      updates: { status: 'Specification' },
    });

    // ============================================
    // Stage 2: Generate specification
    // ============================================
    currentStage = 'spec_generation' as WorkflowStage;
    const spec = await generateSpecification({ task, projectId: input.projectId });

    // Update Linear status to "In Progress"
    await updateLinearTask({
      linearId: task.linearId,
      updates: {
        status: 'In Progress',
      },
    });

    // Append spec to Linear issue description as markdown
    await appendSpecToLinearIssue({
      linearId: task.linearId,
      spec: spec,
    });

    // Append warning comment about auto-generated specs
    await appendWarningToLinearIssue({
      linearId: task.linearId,
    });

    await sendNotification({
      projectId: input.projectId,
      event: 'spec_generated',
      data: { taskId: task.id, spec },
    });

    // ============================================
    // Stage 3: Generate code
    // ============================================
    currentStage = 'code_generation' as WorkflowStage;
    const codeGeneration = await generateCode({ spec, task, projectId: input.projectId });
    branchName = codeGeneration.branchName;

    // ============================================
    // Phase 3: Generate tests from acceptance criteria
    // ============================================
    const testsGeneration = await generateTests({
      projectId: input.projectId,
      taskId: task.id,
      acceptanceCriteria: task.acceptanceCriteria || [],
      implementationFiles: codeGeneration.files.map((f: any) => ({
        path: f.path,
        content: f.content,
      })),
      testTypes: ['unit', 'integration'],
    });

    // ============================================
    // Stage 4: Create branch
    // ============================================
    currentStage = 'pr_creation' as WorkflowStage;
    await createBranch({ projectId: input.projectId, branchName, baseBranch: 'main' });

    // ============================================
    // Stage 5: Commit implementation + tests
    // ============================================
    const allFiles = [
      ...codeGeneration.files,
      ...testsGeneration.tests.map((t: any) => ({
        path: t.path,
        content: t.content,
        action: 'create',
      })),
    ];

    await commitFiles({
      projectId: input.projectId,
      branchName,
      files: allFiles,
      message: `${codeGeneration.commitMessage}\n\nGenerated ${testsGeneration.summary.totalTests} tests`,
    });

    // ============================================
    // Stage 6: Create PR
    // ============================================
    const pr = await createPullRequest({
      projectId: input.projectId,
      branchName,
      title: task.title,
      description: `${codeGeneration.prDescription}\n\n## Tests Generated\n${testsGeneration.summary.totalTests} tests (${Object.entries(testsGeneration.summary.byType).map(([type, count]) => `${count} ${type}`).join(', ')})`,
    });
    prNumber = pr.number;

    await sendNotification({
      projectId: input.projectId,
      event: 'pr_created',
      data: { taskId: task.id, prUrl: pr.url, prNumber: pr.number },
    });

    // Update Linear with PR link
    await updateLinearTask({
      linearId: task.linearId,
      updates: { status: 'In Review' },
    });

    // ============================================
    // Stage 7: Wait for CI + Testing Loop
    // ============================================
    currentStage = 'ci_execution' as WorkflowStage;
    
    // Main CI/Testing loop with auto-fix
    while (fixAttempts <= maxFixAttempts) {
      const ciResult = await waitForCIWithRetry({ projectId: input.projectId, prNumber });

      if (ciResult.success) {
        // CI passed!
        await sendNotification({
          projectId: input.projectId,
          event: 'ci_passed',
          data: { taskId: task.id, prNumber, duration: ciResult.duration },
        });
        break;
      }

      // CI failed
      await sendNotification({
        projectId: input.projectId,
        event: 'ci_failed',
        data: { taskId: task.id, prNumber, logs: ciResult.logs, attempt: fixAttempts + 1 },
      });

      // Check if we should attempt a fix
      if (fixAttempts >= maxFixAttempts) {
        throw new ApplicationFailure(
          `CI failed after ${maxFixAttempts} fix attempts. Logs: ${ciResult.logs}`,
          'CIFailure',
          false,
        );
      }

      // ============================================
      // Phase 3: Enhanced Testing ↔ Fix Loop
      // ============================================
      currentStage = 'qa_testing' as WorkflowStage;
      
      // Run tests locally to get detailed failures
      const testResult = await runTests({
        projectId: input.projectId,
        workspacePath: '/tmp/workspace',  // TODO: Get from config
        testType: 'all',
      });

      if (!testResult.success && testResult.failures && testResult.failures.length > 0) {
        // Tests failed - analyze and fix
        currentStage = 'fix_generation' as WorkflowStage;

        const failureAnalysis = await analyzeTestFailures({
          projectId: input.projectId,
          failures: testResult.failures,
          implementationFiles: allFiles.filter((f: any) => !f.path.includes('test') && !f.path.includes('spec')),
          testFiles: testsGeneration.tests.map((t: any) => ({ path: t.path, content: t.content })),
          previousAttempts: testFixAttempts,
        });

        // Apply fixes based on strategy
        const fixFiles: any[] = [];

        if (failureAnalysis.fixStrategy === 'fix_implementation' || failureAnalysis.fixStrategy === 'both') {
          fixFiles.push(...(failureAnalysis.implementationFixes || []));
        }

        if (failureAnalysis.fixStrategy === 'fix_tests' || failureAnalysis.fixStrategy === 'both') {
          fixFiles.push(...(failureAnalysis.testFixes || []));
        }

        // Commit fixes
        if (fixFiles.length > 0) {
          await commitFiles({
            projectId: input.projectId,
            branchName,
            files: fixFiles,
            message: `fix: ${failureAnalysis.fixStrategy} - ${failureAnalysis.analysis.substring(0, 50)}...`,
          });

          testFixAttempts++;
        }
      }

      fixAttempts++;

      // Wait a bit before checking CI again
      await sleep('30s');
    }

    // ============================================
    // Stage 8: Final validation
    // ============================================
    currentStage = 'qa_testing' as WorkflowStage;
    const finalTestResult = await runTests({
      projectId: input.projectId,
      workspacePath: '/tmp/workspace',
      testType: 'all',
    });

    if (!finalTestResult.success) {
      await sendNotification({
        projectId: input.projectId,
        event: 'tests_failed',
        data: { taskId: task.id, failures: finalTestResult.failures },
      });

      throw new ApplicationFailure(
        `Final tests failed with ${finalTestResult.failures?.length || 0} failures`,
        'TestFailure',
        false,
      );
    }

    await sendNotification({
      projectId: input.projectId,
      event: 'qa_completed',
      data: { 
        taskId: task.id, 
        prNumber,
        coverage: finalTestResult.coverage,
      },
    });

    // ============================================
    // Stage 9: Merge PR
    // ============================================
    currentStage = 'merge' as WorkflowStage;
    await mergePullRequest({ projectId: input.projectId, prNumber });

    // Update Linear to "Done"
    await updateLinearTask({
      linearId: task.linearId,
      updates: { status: 'Done' },
    });

    // ============================================
    // Stage 10: Send final notification
    // ============================================
    currentStage = 'notification' as WorkflowStage;
    await sendNotification({
      projectId: input.projectId,
      event: 'workflow_completed',
      data: {
        taskId: task.id,
        title: task.title,
        prUrl: pr.url,
        prNumber,
        branchName,
        fixAttempts,
        testFixAttempts,
        testsGenerated: testsGeneration.summary.totalTests,
        coverage: finalTestResult.coverage,
      },
    });

    return {
      success: true,
      stage: 'notification' as WorkflowStage,
      data: {
        task,
        pr,
        branchName,
        fixAttempts,
        testFixAttempts,
        testsGenerated: testsGeneration.summary.totalTests,
        completed: true,
      },
      timestamp: new Date(),
    };
  } catch (err: unknown) {
    // Enhanced error handling
    let errorMessage = 'Unknown error';
    let errorType = 'UnknownError';
    let errorDetails: any = {};

    if (err instanceof ActivityFailure) {
      errorMessage = err.message;
      errorType = err.cause?.message || 'ActivityError';
      errorDetails = {
        activityType: err.activityType,
        activityId: err.activityId,
        retryState: typeof err.retryState === 'string' ? err.retryState : err.retryState,
      };
    } else if (err instanceof ApplicationFailure) {
      errorMessage = err.message;
      errorType = err.type || 'ApplicationError';
      errorDetails = err.details;
    } else if (err instanceof Error) {
      errorMessage = err.message;
      errorDetails = { stack: err.stack };
    }

    // Send failure notification
    await sendNotification({
      projectId: input.projectId,
      event: 'workflow_failed',
      data: {
        taskId: input.taskId,
        stage: currentStage,
        error: errorMessage,
        errorType,
        errorDetails,
        prNumber,
        branchName,
        fixAttempts,
        testFixAttempts,
      },
    });

    // Update Linear to "Blocked"
    if (input.taskId) {
      try {
        await updateLinearTask({
          linearId: input.taskId,
          updates: { status: 'Blocked' },
        });
      } catch {
        // Ignore errors updating Linear on failure
      }
    }

    return {
      success: false,
      stage: currentStage,
      error: errorMessage,
      data: { errorType, errorDetails, prNumber, branchName, fixAttempts, testFixAttempts },
      timestamp: new Date(),
    };
  }
}
