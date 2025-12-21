/**
 * Refinement Workflow - Phase 1 of Three-Phase Agile Workflow
 *
 * Generates backlog refinement to clarify business requirements.
 * Focus: Business context, objectives, questions for PO, complexity estimation
 */

import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';
import type * as activities from '@/activities';

// Proxy activities with 5-minute timeout
const {
  syncLinearTask,
  updateLinearTask,
  generateRefinement,
  appendRefinementToLinearIssue,
  createLinearSubtasks,
  addTaskTypeLabel,
  postQuestionsAsComments,
  getPOAnswersForTask,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export interface RefinementWorkflowInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface RefinementWorkflowResult {
  success: boolean;
  phase: 'refinement';
  message: string;
  refinement?: any;
  subtasksCreated?: {
    total: number;
    created: number;
    failed: number;
  };
  /** True if workflow is blocked waiting for PO answers */
  blocked?: boolean;
  /** True if waiting for PO to answer questions */
  waitingForAnswers?: boolean;
  /** Number of questions pending answers */
  questionsCount?: number;
}

/**
 * Refinement Workflow
 * Phase 1: Clarify business requirements and prepare for user story generation
 */
export async function refinementWorkflow(
  input: RefinementWorkflowInput
): Promise<RefinementWorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  try {
    // Step 1: Sync task from Linear
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // Step 2: Update status to Refinement In Progress
    await updateLinearTask({
      projectId: input.projectId,
      linearId: task.linearId,
      updates: { status: LINEAR_STATUSES.refinementInProgress },
    });

    // Step 2.5: Get any existing PO answers (from previous workflow runs)
    const poAnswersResult = await getPOAnswersForTask({
      linearIssueId: task.linearId,
      projectId: input.projectId,
    });

    // Step 3: Generate refinement (with external context and PO answers if available)
    const result = await generateRefinement({
      task: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        labels: task.labels,
      },
      projectId: input.projectId,
      externalLinks: task.externalLinks,
      poAnswers: poAnswersResult.answers.length > 0 ? poAnswersResult.answers : undefined,
    });

    // Step 3.5: Add task type label based on detected type (non-blocking)
    // Automatically adds feature/bug/enhancement/chore label
    if (task.teamId) {
      await addTaskTypeLabel({
        projectId: input.projectId,
        issueId: task.linearId,
        teamId: task.teamId,
        taskType: result.refinement.taskType,
      });
    }

    // Step 4: Append refinement to Linear issue (with council summary if enabled)
    await appendRefinementToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
      refinement: result.refinement,
      council: result.council,
    });

    // Step 4.5: Create sub-issues if complexity L or XL (BLOCKING)
    let subtasksCreated: { total: number; created: number; failed: number } | undefined;
    const enableSubtasks = config.linear.features?.enableSubtaskCreation ?? true;

    if (
      enableSubtasks &&
      result.refinement.suggestedSplit &&
      (result.refinement.complexityEstimate === 'L' || result.refinement.complexityEstimate === 'XL')
    ) {
      // NOTE: No try-catch - let errors propagate to fail the workflow
      const subtaskResult = await createLinearSubtasks({
        projectId: input.projectId,
        parentIssueId: task.linearId,
        proposedStories: result.refinement.suggestedSplit.proposedStories,
      });

      // Check if any sub-issues failed to create
      if (subtaskResult.failed.length > 0) {
        const errorMsg = `Failed to create ${subtaskResult.failed.length}/${result.refinement.suggestedSplit.proposedStories.length} sub-issues`;
        throw new Error(errorMsg);
      }

      subtasksCreated = {
        total: result.refinement.suggestedSplit.proposedStories.length,
        created: subtaskResult.created.length,
        failed: 0,
      };
    }

    // Step 4.6: Check for questions requiring PO answers
    const questions = result.refinement.questionsForPO || [];
    const hasNewQuestions = questions.length > 0;
    const previouslyAnsweredCount = poAnswersResult.answers.length;

    // If there are new questions and we haven't gotten all answers yet
    // (new questions may appear even after some answers were provided)
    if (hasNewQuestions) {
      // Post questions as individual comments in Linear
      await postQuestionsAsComments({
        taskId: task.id,
        projectId: input.projectId,
        linearIssueId: task.linearId,
        questions: questions,
      });

      // Return blocked - don't update status to Refinement Ready
      // Status stays "Refinement In Progress" until PO answers all questions
      return {
        success: true,
        phase: 'refinement',
        message: `Refinement blocked - ${questions.length} question(s) en attente de réponse du Product Owner`,
        refinement: result.refinement,
        subtasksCreated,
        blocked: true,
        waitingForAnswers: true,
        questionsCount: questions.length,
      };
    }

    // No questions (or all answered) - proceed to Refinement Ready
    // Step 5: Update status to Refinement Ready
    await updateLinearTask({
      projectId: input.projectId,
      linearId: task.linearId,
      updates: { status: LINEAR_STATUSES.refinementReady },
    });

    return {
      success: true,
      phase: 'refinement',
      message: previouslyAnsweredCount > 0
        ? `Refinement complete for task ${task.identifier} (${previouslyAnsweredCount} réponse(s) PO intégrée(s))`
        : `Refinement complete for task ${task.identifier}`,
      refinement: result.refinement,
      subtasksCreated,
    };
  } catch (error) {
    // Update status to Refinement Failed
    try {
      const task = await syncLinearTask({
        taskId: input.taskId,
        projectId: input.projectId,
      });

      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.refinementFailed },
      });
    } catch (updateError) {
      // Log but don't throw - original error is more important
      console.error('Failed to update status to refinementFailed:', updateError);
    }

    // Throw original error
    throw ApplicationFailure.create({
      message: `Refinement workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'RefinementWorkflowFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
