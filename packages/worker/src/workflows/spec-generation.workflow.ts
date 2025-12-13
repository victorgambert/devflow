/**
 * Spec Generation Workflow - Triggered when task status changes to SPECIFICATION
 */

import { proxyActivities } from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, WorkflowStage } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';

// Import activity types
import type * as activities from '@/activities';

// Configure activity proxies
const {
  syncLinearTask,
  updateLinearTask,
  appendSpecToLinearIssue,
  appendWarningToLinearIssue,
  generateSpecification,
  sendNotification,
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
 * Spec generation workflow - only generates specification
 */
export async function specGenerationWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  // Extract config with fallback to defaults
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = {
    SPEC_IN_PROGRESS: config.linear.statuses.specInProgress || 'Spec In Progress',
    SPEC_READY: config.linear.statuses.specReady || 'Spec Ready',
    SPEC_FAILED: config.linear.statuses.specFailed || 'Spec Failed',
    SPECIFICATION: config.linear.statuses.specification || 'Specification',
    IN_REVIEW: config.linear.statuses.inReview,
    DONE: config.linear.statuses.done,
    BLOCKED: config.linear.statuses.blocked,
    TRIGGER_STATUS: config.linear.statuses.triggerStatus || 'To Spec',
    NEXT_STATUS: config.linear.statuses.nextStatus || 'In Development',
  };

  let currentStage: WorkflowStage = 'linear_sync' as WorkflowStage;

  try {
    // ============================================
    // Stage 1: Sync task from Linear
    // ============================================
    currentStage = 'linear_sync' as WorkflowStage;
    const task = await syncLinearTask({ taskId: input.taskId, projectId: input.projectId });

    await sendNotification({
      projectId: input.projectId,
      event: 'workflow_started',
      data: { taskId: task.id, title: task.title, type: 'spec_generation' },
    });

    // ============================================
    // Stage 2: Generate specification
    // ============================================
    currentStage = 'spec_generation' as WorkflowStage;
    const spec = await generateSpecification({ task, projectId: input.projectId });

    // Update Linear status to stay in Specification
    await updateLinearTask({
      projectId: input.projectId,
      linearId: task.linearId,
      updates: {
        status: LINEAR_STATUSES.SPECIFICATION,
      },
    });

    // Append spec to Linear issue description as markdown
    await appendSpecToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
      spec: spec,
    });

    // Append warning message about auto-generated specs
    await appendWarningToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
    });

    await sendNotification({
      projectId: input.projectId,
      event: 'spec_generated',
      data: { taskId: task.id, spec },
    });

    // ============================================
    // Send completion notification
    // ============================================
    currentStage = 'notification' as WorkflowStage;
    await sendNotification({
      projectId: input.projectId,
      event: 'workflow_completed',
      data: {
        taskId: task.id,
        title: task.title,
        type: 'spec_generation',
        completed: true,
      },
    });

    return {
      success: true,
      stage: 'notification' as WorkflowStage,
      data: {
        task,
        spec,
        completed: true,
      },
      timestamp: new Date(),
    };
  } catch (err: unknown) {
    // Error handling
    let errorMessage = 'Unknown error';
    let errorType = 'UnknownError';

    if (err instanceof Error) {
      errorMessage = err.message;
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
        type: 'spec_generation',
      },
    });

    // Update Linear to "Blocked"
    if (input.taskId) {
      try {
        await updateLinearTask({
          projectId: input.projectId,
          linearId: input.taskId,
          updates: { status: LINEAR_STATUSES.BLOCKED },
        });
      } catch {
        // Ignore errors updating Linear on failure
      }
    }

    return {
      success: false,
      stage: currentStage,
      error: errorMessage,
      data: { errorType },
      timestamp: new Date(),
    };
  }
}
