/**
 * User Story Workflow - Phase 2 of Three-Phase Agile Workflow
 *
 * Generates formal user stories from refined requirements.
 * Focus: User story format, acceptance criteria, definition of done, story points
 */

import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { WorkflowConfig } from '@devflow/common';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';
import type * as activities from '@/activities';

// Proxy activities with 5-minute timeout
const {
  syncLinearTask,
  updateLinearTask,
  generateUserStory,
  appendUserStoryToLinearIssue,
  createLinearSubtasks,
  addCommentToLinearIssue,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export interface UserStoryWorkflowInput {
  taskId: string;
  projectId: string;
  config?: WorkflowConfig;
}

export interface UserStoryWorkflowResult {
  success: boolean;
  phase: 'user_story';
  message: string;
  userStory?: any;
  /** True if task was split into sub-issues */
  split?: boolean;
  /** Created sub-issues (when split) */
  subIssuesCreated?: Array<{ index: number; issueId: string; identifier: string; title: string }>;
}

/** Parsed suggested split from refinement */
interface ParsedSuggestedSplit {
  reason: string;
  proposedStories: Array<{
    title: string;
    description: string;
    dependencies?: number[];
    acceptanceCriteria?: string[];
  }>;
}

/** Valid task types */
type TaskType = 'feature' | 'bug' | 'enhancement' | 'chore';

/** Valid complexity estimates */
type ComplexityEstimate = 'XS' | 'S' | 'M' | 'L' | 'XL';

/** Parsed refinement from description */
interface ParsedRefinement {
  taskType: TaskType;
  businessContext: string;
  objectives: string[];
  preliminaryAcceptanceCriteria: string[];
  complexityEstimate: ComplexityEstimate;
  suggestedSplit?: ParsedSuggestedSplit;
}

/**
 * Extract refinement from Linear issue description
 * Parses markdown to extract all refinement fields including suggestedSplit
 */
function extractRefinementFromDescription(description: string): ParsedRefinement {
  // The refinement can be in collapsible section or H1 format
  // Try collapsible format first: <details><summary>📋 Backlog Refinement</summary>
  let refinementText = '';

  const collapsibleMatch = description.match(
    /<details[^>]*>\s*<summary[^>]*>📋 Backlog Refinement<\/summary>([\s\S]*?)<\/details>/
  );
  if (collapsibleMatch) {
    refinementText = collapsibleMatch[1];
  } else {
    // Fallback to H1 format
    const h1Match = description.match(/# Backlog Refinement[\s\S]*?(?=\n# |$)/);
    if (h1Match) {
      refinementText = h1Match[0];
    }
  }

  if (!refinementText) {
    // If no refinement found, return minimal refinement object
    return {
      taskType: 'feature' as TaskType,
      businessContext: description,
      objectives: [],
      preliminaryAcceptanceCriteria: [],
      complexityEstimate: 'M' as ComplexityEstimate,
    };
  }

  // Extract task type
  const taskTypeMatch = refinementText.match(/\*\*Type:\*\* [^\s]+ (\w+)/);
  const rawTaskType = taskTypeMatch ? taskTypeMatch[1].toLowerCase() : 'feature';
  const validTaskTypes: TaskType[] = ['feature', 'bug', 'enhancement', 'chore'];
  const taskType: TaskType = validTaskTypes.includes(rawTaskType as TaskType)
    ? (rawTaskType as TaskType)
    : 'feature';

  // Extract business context (### Business Context in collapsible, ## Business Context in H1)
  const contextMatch = refinementText.match(/###?\s*Business Context\n\n?([\s\S]*?)(?=\n###? |$)/);
  const businessContext = contextMatch ? contextMatch[1].trim() : '';

  // Extract objectives
  const objectivesMatch = refinementText.match(/###?\s*Objectives\n\n?([\s\S]*?)(?=\n###? |$)/);
  const objectives = objectivesMatch
    ? objectivesMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  // Extract preliminary acceptance criteria
  const criteriaMatch = refinementText.match(/###?\s*Preliminary Acceptance Criteria\n\n?([\s\S]*?)(?=\n###? |$)/);
  const preliminaryAcceptanceCriteria = criteriaMatch
    ? criteriaMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  // Extract complexity estimate
  const complexityMatch = refinementText.match(/\*\*(XS|S|M|L|XL)\*\*/);
  const complexityEstimate: ComplexityEstimate = complexityMatch
    ? (complexityMatch[1] as ComplexityEstimate)
    : 'M';

  // Extract suggested split
  const suggestedSplit = extractSuggestedSplit(refinementText);

  return {
    taskType,
    businessContext,
    objectives,
    preliminaryAcceptanceCriteria,
    complexityEstimate,
    suggestedSplit,
  };
}

/**
 * Extract suggested split from refinement markdown
 * Format:
 * ### 🔀 Suggested Split
 * **Reason:** {reason}
 * **Proposed Stories:**
 * #### 1. {title}
 * {description}
 * **Dependencies:** - Depends on: {title}
 * **Acceptance Criteria:** 1. {criterion}
 */
function extractSuggestedSplit(refinementText: string): ParsedSuggestedSplit | undefined {
  const splitMatch = refinementText.match(/###?\s*🔀 Suggested Split\n\n?([\s\S]*?)(?=\n###?\s*Complexity Estimate|$)/);
  if (!splitMatch) {
    return undefined;
  }

  const splitText = splitMatch[1];

  // Extract reason
  const reasonMatch = splitText.match(/\*\*Reason:\*\*\s*(.+?)(?:\n|$)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : '';

  if (!reason) {
    return undefined;
  }

  // Extract proposed stories
  const proposedStories: ParsedSuggestedSplit['proposedStories'] = [];

  // Split by story headers (#### 1. Title, #### 2. Title, etc.)
  const storyBlocks = splitText.split(/####\s*\d+\.\s*/);

  // First block is the "Proposed Stories:" text, skip it
  for (let i = 1; i < storyBlocks.length; i++) {
    const block = storyBlocks[i].trim();
    if (!block) continue;

    // First line is the title
    const lines = block.split('\n');
    const title = lines[0].trim();

    // Extract description (everything before **Dependencies:** or **Acceptance Criteria:**)
    const descMatch = block.match(/^[^\n]+\n\n?([\s\S]*?)(?=\n\*\*Dependencies:\*\*|\n\*\*Acceptance Criteria:\*\*|$)/);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract dependencies
    const dependencies: number[] = [];
    const depsMatch = block.match(/\*\*Dependencies:\*\*([\s\S]*?)(?=\n\*\*Acceptance Criteria:\*\*|$)/);
    if (depsMatch) {
      // Parse "- Depends on: Title" lines and match to indices
      const depLines = depsMatch[1].match(/- Depends on:\s*(.+)/g);
      if (depLines) {
        depLines.forEach((depLine) => {
          const depTitleMatch = depLine.match(/- Depends on:\s*(.+)/);
          if (depTitleMatch) {
            const depTitle = depTitleMatch[1].trim();
            // Find the index of the story with this title
            const depIndex = proposedStories.findIndex((s) => s.title === depTitle);
            if (depIndex >= 0) {
              dependencies.push(depIndex);
            }
          }
        });
      }
    }

    // Extract acceptance criteria
    const acceptanceCriteria: string[] = [];
    const acMatch = block.match(/\*\*Acceptance Criteria:\*\*([\s\S]*?)$/);
    if (acMatch) {
      const acLines = acMatch[1]
        .split('\n')
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim());
      acceptanceCriteria.push(...acLines);
    }

    proposedStories.push({
      title,
      description,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
    });
  }

  if (proposedStories.length === 0) {
    return undefined;
  }

  return {
    reason,
    proposedStories,
  };
}

/**
 * Format split comment for parent issue
 */
function formatSplitComment(
  suggestedSplit: ParsedSuggestedSplit,
  subIssuesResult: {
    created: Array<{ index: number; issueId: string; identifier: string; title: string }>;
    failed: Array<{ index: number; title: string; error: string }>;
  }
): string {
  const lines: string[] = [];

  lines.push('🔀 **This task has been split into sub-issues**');
  lines.push('');
  lines.push(`> ${suggestedSplit.reason}`);
  lines.push('');

  if (subIssuesResult.created.length > 0) {
    lines.push('### Sub-Issues Created');
    lines.push('');
    lines.push('| # | Issue | Title |');
    lines.push('|---|-------|-------|');

    subIssuesResult.created.forEach((issue, idx) => {
      lines.push(`| ${idx + 1} | ${issue.identifier} | ${issue.title} |`);
    });
    lines.push('');
  }

  if (subIssuesResult.failed.length > 0) {
    lines.push('### ⚠️ Failed Sub-Issues');
    lines.push('');
    subIssuesResult.failed.forEach((failure) => {
      lines.push(`- **${failure.title}**: ${failure.error}`);
    });
    lines.push('');
  }

  lines.push('Each sub-issue will go through its own refinement → user story → technical plan cycle.');
  lines.push('');
  lines.push('---');
  lines.push('*Generated by DevFlow*');

  return lines.join('\n');
}

/**
 * User Story Workflow
 * Phase 2: Transform refined requirements into formal user story
 *
 * If refinement contains a suggestedSplit, creates sub-issues instead of generating user story
 */
export async function userStoryWorkflow(
  input: UserStoryWorkflowInput
): Promise<UserStoryWorkflowResult> {
  const config = input.config || DEFAULT_WORKFLOW_CONFIG;
  const LINEAR_STATUSES = config.linear.statuses;

  try {
    // Step 1: Sync task from Linear
    const task = await syncLinearTask({
      taskId: input.taskId,
      projectId: input.projectId,
    });

    // Step 2: Update status to UserStory In Progress
    await updateLinearTask({
      projectId: input.projectId,
      linearId: task.linearId,
      updates: { status: LINEAR_STATUSES.userStoryInProgress },
    });

    // Step 3: Extract refinement from Linear description
    const refinement = extractRefinementFromDescription(task.description);

    // Step 3.5: Check if task should be split
    if (refinement.suggestedSplit && refinement.suggestedSplit.proposedStories.length > 0) {
      // Create sub-issues instead of generating user story
      const subIssuesResult = await createLinearSubtasks({
        projectId: input.projectId,
        parentIssueId: task.linearId,
        proposedStories: refinement.suggestedSplit.proposedStories,
        initialStatus: LINEAR_STATUSES.toRefinement,
      });

      // Add comment explaining the split
      const splitComment = formatSplitComment(refinement.suggestedSplit, subIssuesResult);
      await addCommentToLinearIssue({
        projectId: input.projectId,
        linearId: task.linearId,
        body: splitComment,
      });

      // Update parent status to UserStory Ready (parent stays as epic)
      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.userStoryReady },
      });

      return {
        success: true,
        phase: 'user_story',
        message: `Task ${task.identifier} split into ${subIssuesResult.created.length} sub-issues`,
        split: true,
        subIssuesCreated: subIssuesResult.created,
      };
    }

    // Step 4: Generate user story (no split)
    const result = await generateUserStory({
      task: {
        title: task.title,
        description: task.description,
        priority: task.priority,
      },
      refinement,
      projectId: input.projectId,
    });

    // Step 5: Append user story to Linear issue (with council summary if enabled)
    await appendUserStoryToLinearIssue({
      projectId: input.projectId,
      linearId: task.linearId,
      userStory: result.userStory,
      council: result.council,
    });

    // Step 6: Update status to UserStory Ready
    await updateLinearTask({
      projectId: input.projectId,
      linearId: task.linearId,
      updates: { status: LINEAR_STATUSES.userStoryReady },
    });

    return {
      success: true,
      phase: 'user_story',
      message: `User story generated for task ${task.identifier}`,
      userStory: result.userStory,
    };
  } catch (error) {
    // Update status to UserStory Failed
    try {
      const task = await syncLinearTask({
        taskId: input.taskId,
        projectId: input.projectId,
      });

      await updateLinearTask({
        projectId: input.projectId,
        linearId: task.linearId,
        updates: { status: LINEAR_STATUSES.userStoryFailed },
      });
    } catch (updateError) {
      // Log but don't throw - original error is more important
      console.error('Failed to update status to userStoryFailed:', updateError);
    }

    // Throw original error
    throw ApplicationFailure.create({
      message: `User story workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'UserStoryWorkflowFailure',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
