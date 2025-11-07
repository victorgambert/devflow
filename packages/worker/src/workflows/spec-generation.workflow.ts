/**
 * Spec Generation Workflow - Triggered when task status changes to SPECIFICATION
 */

import { proxyActivities } from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, WorkflowStage } from '@soma-squad-ai/common';

// Import activity types
import type * as activities from '../activities';

// Configure activity proxies
const {
  syncNotionTask,
  updateNotionTask,
  appendSpecToNotionPage,
  appendWarningToNotionPage,
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
  let currentStage: WorkflowStage = 'notion_sync' as WorkflowStage;

  try {
    // ============================================
    // Stage 1: Sync task from Notion
    // ============================================
    currentStage = 'notion_sync' as WorkflowStage;
    const task = await syncNotionTask({ taskId: input.taskId, projectId: input.projectId });

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

    // Update Notion status to stay in Specification
    await updateNotionTask({
      notionId: task.id,
      updates: {
        status: 'Specification',
      },
    });

    // Append spec to Notion page body as markdown
    await appendSpecToNotionPage({
      notionId: task.id,
      spec: spec,
    });

    // Append warning message about auto-generated specs
    await appendWarningToNotionPage({
      notionId: task.id,
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

    // Update Notion to "Blocked"
    if (input.taskId) {
      try {
        await updateNotionTask({
          notionId: input.taskId,
          updates: { status: 'Blocked' },
        });
      } catch {
        // Ignore errors updating Notion on failure
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
