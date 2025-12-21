/**
 * Main DevFlow Orchestration Workflow - Three-Phase Agile Router
 *
 * Routes to appropriate sub-workflow based on Linear task status:
 * - To Refinement → Refinement Workflow (Phase 1)
 * - To User Story / Refinement Ready → User Story Workflow (Phase 2)
 * - To Plan / UserStory Ready → Technical Plan Workflow (Phase 3)
 */

import { executeChild, proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';

// Import sub-workflows
import { refinementWorkflow } from './phases/refinement.workflow';
import { userStoryWorkflow } from './phases/user-story.workflow';
import { technicalPlanWorkflow } from './phases/technical-plan.workflow';

// Import activity types
import type * as activities from '@/activities';

// Simple activity proxy for syncing Linear tasks
const { syncLinearTask } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

/**
 * Main DevFlow Workflow Router
 * Routes to appropriate sub-workflow based on Linear task status
 */
export async function devflowWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  try {
    // Sync task from Linear to get current status
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // DEBUG: Log task status and expected status
    console.log('[devflowWorkflow] Task status:', task.status);
    console.log('[devflowWorkflow] Expected toRefinement:', LINEAR_STATUSES.toRefinement);
    console.log('[devflowWorkflow] Status match:', task.status === LINEAR_STATUSES.toRefinement);

    // Route to appropriate sub-workflow based on status
    // Phase 1: Refinement
    if (task.status === LINEAR_STATUSES.toRefinement) {
      const result = await executeChild(refinementWorkflow, {
        workflowId: `refinement-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'refinement' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // Phase 2: User Story (only triggered by explicit "To User Story" status)
    if (task.status === LINEAR_STATUSES.toUserStory) {
      const result = await executeChild(userStoryWorkflow, {
        workflowId: `user-story-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'user_story' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // Phase 3: Technical Plan (only triggered by explicit "To Plan" status)
    if (task.status === LINEAR_STATUSES.toPlan) {
      const result = await executeChild(technicalPlanWorkflow, {
        workflowId: `technical-plan-${input.taskId}-${Date.now()}`,
        args: [
          {
            taskId: input.taskId,
            projectId: input.projectId,
            config,
          },
        ],
      });

      return {
        success: true,
        stage: 'technical_plan' as any,
        data: result,
        timestamp: new Date(),
      };
    }

    // No matching workflow trigger found
    throw ApplicationFailure.create({
      message:
        `Status "${task.status}" is not a valid workflow trigger for the three-phase Agile system. ` +
        `Expected one of: ` +
        `"${LINEAR_STATUSES.toRefinement}" (Phase 1), ` +
        `"${LINEAR_STATUSES.toUserStory}" (Phase 2), ` +
        `"${LINEAR_STATUSES.toPlan}" (Phase 3)`,
      type: 'InvalidWorkflowTrigger',
    });
  } catch (error) {
    return {
      success: false,
      stage: 'routing' as any,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { error },
      timestamp: new Date(),
    };
  }
}
