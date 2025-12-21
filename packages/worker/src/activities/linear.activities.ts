/**
 * Linear Integration Activities - OAuth Ready (Phase 5)
 * Linear OAuth Device Flow will be added in Phase 6
 */

import { createLogger } from '@devflow/common';
import { PrismaClient } from '@prisma/client';
import type {
  RefinementOutput,
  UserStoryGenerationOutput,
  TechnicalPlanGenerationOutput,
  CouncilSummary,
} from '@devflow/common';
import {
  createLinearClient,
  createLabelService,
  formatSpecAsMarkdown,
  formatWarningMessage,
  formatRefinementAsMarkdown,
  formatUserStoryAsMarkdown,
  formatTechnicalPlanAsMarkdown,
  // New structured formatting functions
  parseDevFlowDescription,
  formatDevFlowDescription,
  formatRefinementContent,
  formatUserStoryContent,
  formatTechnicalPlanContent,
  DEVFLOW_CUSTOM_FIELDS,
} from '@devflow/sdk';
import { oauthResolver } from '@/services/oauth-context';
import {
  parseExternalLinksFromDescription,
  type ExternalContextLinks,
} from './context-extraction.activities';

const logger = createLogger('LinearActivities');
const prisma = new PrismaClient();

/**
 * Resolve Linear API key for a project via OAuth
 * Falls back to LINEAR_API_KEY environment variable for testing
 * TODO Phase 6: Implement Linear OAuth Device Flow
 */
async function resolveLinearApiKey(projectId: string): Promise<string> {
  try {
    const token = await oauthResolver.resolveLinearToken(projectId);
    logger.info('Using OAuth token for Linear', { projectId });
    return token;
  } catch (error) {
    // Fallback to LINEAR_API_KEY environment variable for E2E testing
    const apiKey = process.env.LINEAR_API_KEY;
    if (apiKey) {
      logger.warn('OAuth failed, falling back to LINEAR_API_KEY env var', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return apiKey;
    }

    throw new Error(
      `No Linear OAuth connection configured for project ${projectId}. Linear OAuth Device Flow coming in Phase 6. Please configure via: POST /api/v1/auth/linear/device/initiate`,
    );
  }
}

// ============================================
// Input/Output Types
// ============================================

export interface SyncLinearTaskInput {
  taskId: string; // Linear issue ID
  projectId: string;
}

export interface SyncLinearTaskOutput {
  id: string;
  linearId: string;
  identifier: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignee?: string;
  labels?: string[];
  url: string;
  /** Team ID - required for label operations (optional for query operations) */
  teamId?: string;
  acceptanceCriteria?: string[];
  /** Parsed external links (Figma, Sentry, GitHub Issues) from description */
  externalLinks?: ExternalContextLinks;
  /** External context URLs (from Linear Custom Fields or description) */
  figmaUrl?: string;
  sentryUrl?: string;
  githubIssueUrl?: string;
}

// ============================================
// Activities
// ============================================

/**
 * Sync task from Linear
 */
export async function syncLinearTask(input: SyncLinearTaskInput): Promise<SyncLinearTaskOutput> {
  logger.info('Syncing task from Linear', input);

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);
    const task = await client.getTask(input.taskId);

    // Get team ID from the issue (required for label operations)
    const issue = await client.getIssue(input.taskId);
    const team = await issue.team;
    if (!team) {
      throw new Error(`Issue ${input.taskId} has no team`);
    }
    const teamId = team.id;

    logger.info('Task synced from Linear', { identifier: task.identifier, teamId, status: task.status });
    logger.info('[DEBUG] Task status from Linear', { status: task.status, taskId: input.taskId });

    // Extract acceptance criteria from description (lines starting with "- [ ]" or "- [x]")
    const acceptanceCriteria = extractAcceptanceCriteria(task.description);

    // Parse external links from description (Figma, Sentry, GitHub Issues URLs)
    const externalLinks = parseExternalLinksFromDescription(task.description);

    logger.info('Parsed external links from description', { externalLinks });

    // ============================================
    // Extract external context URLs
    // Priority: Linear Custom Fields > Parsed from description
    // ============================================
    let figmaUrl: string | undefined;
    let sentryUrl: string | undefined;
    let githubIssueUrl: string | undefined;

    // 1. Try to read from Linear Custom Fields (priority)
    try {
      const customFieldValues = await client.getIssueCustomFields(input.taskId);

      const figmaFromCF = customFieldValues.get(DEVFLOW_CUSTOM_FIELDS.FIGMA_URL);
      const sentryFromCF = customFieldValues.get(DEVFLOW_CUSTOM_FIELDS.SENTRY_URL);
      const githubIssueFromCF = customFieldValues.get(DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL);

      if (figmaFromCF) {
        figmaUrl = figmaFromCF;
        logger.debug('Figma URL from Custom Field', { figmaUrl });
      }
      if (sentryFromCF) {
        sentryUrl = sentryFromCF;
        logger.debug('Sentry URL from Custom Field', { sentryUrl });
      }
      if (githubIssueFromCF) {
        githubIssueUrl = githubIssueFromCF;
        logger.debug('GitHub Issue URL from Custom Field', { githubIssueUrl });
      }
    } catch (cfError) {
      logger.warn('Could not read Custom Fields from Linear (may not be set up)', {
        error: (cfError as Error).message
      });
    }

    // 2. Fallback: Build URLs from parsed description links
    if (!figmaUrl && externalLinks.figmaFileKey) {
      figmaUrl = `https://www.figma.com/file/${externalLinks.figmaFileKey}`;
      if (externalLinks.figmaNodeId) {
        figmaUrl += `?node-id=${externalLinks.figmaNodeId}`;
      }
      logger.debug('Figma URL from description parsing', { figmaUrl });
    }

    if (!sentryUrl && externalLinks.sentryIssueId) {
      // Note: Organization slug would be needed for a complete URL
      // For now, just store the issue ID reference
      sentryUrl = `https://sentry.io/issues/${externalLinks.sentryIssueId}`;
      logger.debug('Sentry URL from description parsing', { sentryUrl });
    }

    if (!githubIssueUrl && externalLinks.githubIssueRef) {
      // Convert "owner/repo#123" to full URL
      const match = externalLinks.githubIssueRef.match(/([^#]+)#(\d+)/);
      if (match) {
        githubIssueUrl = `https://github.com/${match[1]}/issues/${match[2]}`;
        logger.debug('GitHub Issue URL from description parsing', { githubIssueUrl });
      }
    }

    logger.info('External context URLs resolved', {
      figmaUrl: figmaUrl ? 'set' : 'not set',
      sentryUrl: sentryUrl ? 'set' : 'not set',
      githubIssueUrl: githubIssueUrl ? 'set' : 'not set',
    });

    return {
      id: task.id,
      linearId: task.linearId,
      identifier: task.identifier,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      labels: task.labels,
      url: task.url,
      teamId,
      acceptanceCriteria,
      externalLinks,
      figmaUrl,
      sentryUrl,
      githubIssueUrl,
    };
  } catch (error) {
    logger.error('Failed to sync task from Linear', error as Error, input);
    throw error;
  }
}

/**
 * Update task status in Linear
 */
export async function updateLinearTask(input: {
  projectId: string;
  linearId: string;
  updates: {
    status?: string;
    description?: string;
  };
}): Promise<void> {
  logger.info('Updating task in Linear', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    if (input.updates.status) {
      await client.updateStatus(input.linearId, input.updates.status);
    }

    if (input.updates.description) {
      await client.updateDescription(input.linearId, input.updates.description);
    }

    logger.info('Task updated in Linear', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to update task in Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Query tasks from Linear by status
 */
export async function queryLinearTasksByStatus(input: {
  projectId: string;
  status: string;
}): Promise<SyncLinearTaskOutput[]> {
  logger.info('Querying Linear tasks by status', { status: input.status });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);
    const tasks = await client.queryIssuesByStatus(input.status);

    logger.info('Tasks queried from Linear', { count: tasks.length });

    return tasks.map((task) => ({
      id: task.id,
      linearId: task.linearId,
      identifier: task.identifier,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      labels: task.labels,
      url: task.url,
    }));
  } catch (error) {
    logger.error('Failed to query Linear tasks', error as Error, { status });
    throw error;
  }
}

/**
 * Append spec content to Linear issue description
 */
export async function appendSpecToLinearIssue(input: {
  projectId: string;
  linearId: string;
  spec: any;
  codebaseContext?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    similarCode: number;
    filesAnalyzed?: string[];
  };
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
      reasoning: string;
      summary: string;
    }>;
    chosenModel: string;
    detailedExplanation: string;
    agreementScore: number;
    comparisonPoints: string[];
  };
}): Promise<void> {
  logger.info('Appending spec to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Format spec as markdown
    let markdown = formatSpecAsMarkdown(input.spec);

    // Add codebase context section if provided
    if (input.codebaseContext) {
      markdown += '\n\n---\n\n';
      markdown += '## 🔍 Contexte de la codebase analysé\n\n';
      markdown += `**Langage:** ${input.codebaseContext.language}\n`;

      if (input.codebaseContext.framework) {
        markdown += `**Framework:** ${input.codebaseContext.framework}\n`;
      }

      markdown += `**Dépendances analysées:** ${input.codebaseContext.dependencies}\n`;
      markdown += `**Conventions trouvées:** ${input.codebaseContext.conventions}\n`;
      markdown += `**Fichiers d'exemple analysés:** ${input.codebaseContext.similarCode}\n`;

      if (input.codebaseContext.filesAnalyzed && input.codebaseContext.filesAnalyzed.length > 0) {
        markdown += '\n**Fichiers référencés:**\n';
        input.codebaseContext.filesAnalyzed.forEach((file) => {
          markdown += `- \`${file}\`\n`;
        });
      }

      markdown += '\n> Cette spécification a été générée en analysant le contexte ci-dessus pour suivre les patterns existants du projet.\n';
    }

    // Add multi-LLM comparison section if used
    if (input.multiLLM) {
      markdown += '\n\n---\n\n';
      markdown += '## 🤖 Analyse Multi-LLM\n\n';

      // Detailed explanation
      markdown += input.multiLLM.detailedExplanation;
      markdown += '\n\n';

      // Comparison points
      if (input.multiLLM.comparisonPoints.length > 0) {
        markdown += '### Comparaison des modèles:\n\n';
        input.multiLLM.comparisonPoints.forEach((point) => {
          markdown += `${point}\n`;
        });
        markdown += '\n';
      }

      // Sort models by score descending
      const sortedModels = [...input.multiLLM.models].sort((a, b) => b.score - a.score);

      // Summaries of each model's plan
      markdown += '---\n\n';
      markdown += '### 📊 Résumés des plans proposés\n\n';

      sortedModels.forEach((model, index) => {
        const emoji = model.model === input.multiLLM!.chosenModel ? '🏆' : '📝';
        markdown += `#### ${emoji} Plan ${index + 1}: ${model.model.split('/')[1] || model.model}\n\n`;
        markdown += model.summary;
        markdown += '\n\n';
      });

      markdown += '---\n\n';
      markdown += '> 🎯 Cette spécification a été générée par **3 LLMs en parallèle** (Claude Sonnet 4, GPT-4, Gemini 2.0) et le meilleur résultat a été automatiquement sélectionné basé sur la complétude, la pertinence au contexte, et la qualité des étapes d\'implémentation.\n';
    }

    // Append to issue description
    await client.appendToDescription(input.linearId, markdown);

    logger.info('Spec appended to Linear issue', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to append spec to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Add a warning comment to Linear issue after spec generation
 */
export async function appendWarningToLinearIssue(input: {
  projectId: string;
  linearId: string;
  message?: string;
}): Promise<void> {
  logger.info('Adding warning comment to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Use custom message or default
    const warningMessage =
      input.message ||
      process.env.LINEAR_SPEC_WARNING_MESSAGE ||
      '⚠️ This specification was generated automatically by DevFlow.\nManual modifications may not be reflected in the development workflow.';

    // Add as comment
    await client.addComment(input.linearId, formatWarningMessage(warningMessage));

    logger.info('Warning comment added to Linear issue', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to add warning to Linear', error as Error, { linearId: input.linearId });
    // Non-critical operation - don't throw
    logger.warn('Continuing despite warning comment failure');
  }
}

/**
 * Append refinement content to Linear issue description
 * Phase 1 of Three-Phase Agile Workflow
 *
 * Uses structured formatting with collapsible sections and progress summary
 */
export async function appendRefinementToLinearIssue(input: {
  projectId: string;
  linearId: string;
  refinement: RefinementOutput;
  council?: CouncilSummary;
}): Promise<void> {
  logger.info('Appending refinement to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Get current description to preserve original content and existing phases
    const issue = await client.getIssue(input.linearId);
    const currentDescription = issue.description || '';

    // Parse existing DevFlow content
    const parsed = parseDevFlowDescription(currentDescription);

    // Format refinement content (without H1 header - will be in collapsible)
    const refinementContent = formatRefinementContent(input.refinement);

    // Build new structured description
    const newDescription = formatDevFlowDescription({
      originalDescription: parsed.originalDescription,
      refinement: {
        content: refinementContent,
        councilSummary: input.council,
      },
      // Preserve existing phases if they exist
      userStory: parsed.userStoryContent ? { content: parsed.userStoryContent } : undefined,
      technicalPlan: parsed.technicalPlanContent ? { content: parsed.technicalPlanContent } : undefined,
    });

    // Replace entire description with new structured format
    await client.updateDescription(input.linearId, newDescription);

    logger.info('Refinement appended to Linear issue with structured format', {
      linearId: input.linearId,
      hasCouncil: !!input.council,
    });
  } catch (error) {
    logger.error('Failed to append refinement to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Append user story content to Linear issue description
 * Phase 2 of Three-Phase Agile Workflow
 *
 * Uses structured formatting with collapsible sections and progress summary
 */
export async function appendUserStoryToLinearIssue(input: {
  projectId: string;
  linearId: string;
  userStory: UserStoryGenerationOutput;
  council?: CouncilSummary;
}): Promise<void> {
  logger.info('Appending user story to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Get current description to preserve original content and existing phases
    const issue = await client.getIssue(input.linearId);
    const currentDescription = issue.description || '';

    // Parse existing DevFlow content
    const parsed = parseDevFlowDescription(currentDescription);

    // Format user story content (without H1 header - will be in collapsible)
    const userStoryContent = formatUserStoryContent(input.userStory);

    // Build new structured description
    const newDescription = formatDevFlowDescription({
      originalDescription: parsed.originalDescription,
      // Preserve existing refinement if it exists
      refinement: parsed.refinementContent ? { content: parsed.refinementContent } : undefined,
      userStory: {
        content: userStoryContent,
        councilSummary: input.council,
      },
      // Preserve existing technical plan if it exists
      technicalPlan: parsed.technicalPlanContent ? { content: parsed.technicalPlanContent } : undefined,
    });

    // Replace entire description with new structured format
    await client.updateDescription(input.linearId, newDescription);

    logger.info('User story appended to Linear issue with structured format', {
      linearId: input.linearId,
      hasCouncil: !!input.council,
    });
  } catch (error) {
    logger.error('Failed to append user story to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Append technical plan content to Linear issue description
 * Phase 3 of Three-Phase Agile Workflow
 *
 * Uses structured formatting with collapsible sections and progress summary
 */
export async function appendTechnicalPlanToLinearIssue(input: {
  projectId: string;
  linearId: string;
  plan: TechnicalPlanGenerationOutput;
  contextUsed?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    filesAnalyzed: string[];
    usingRAG: boolean;
  };
  council?: CouncilSummary;
  bestPractices?: {
    bestPractices: string;
    perplexityModel: string;
  };
}): Promise<void> {
  logger.info('Appending technical plan to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Get current description to preserve original content and existing phases
    const issue = await client.getIssue(input.linearId);
    const currentDescription = issue.description || '';

    // Parse existing DevFlow content
    const parsed = parseDevFlowDescription(currentDescription);

    // Format technical plan content (without H1 header - will be in collapsible)
    const technicalPlanContent = formatTechnicalPlanContent(input.plan);

    // Build new structured description
    const newDescription = formatDevFlowDescription({
      originalDescription: parsed.originalDescription,
      // Preserve existing phases if they exist
      refinement: parsed.refinementContent ? { content: parsed.refinementContent } : undefined,
      userStory: parsed.userStoryContent ? { content: parsed.userStoryContent } : undefined,
      technicalPlan: {
        content: technicalPlanContent,
        councilSummary: input.council,
        contextUsed: input.contextUsed,
        bestPractices: input.bestPractices,
      },
    });

    // Replace entire description with new structured format
    await client.updateDescription(input.linearId, newDescription);

    logger.info('Technical plan appended to Linear issue with structured format', {
      linearId: input.linearId,
      hasCouncil: !!input.council,
      hasContext: !!input.contextUsed,
      hasBestPractices: !!input.bestPractices,
    });
  } catch (error) {
    logger.error('Failed to append technical plan to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Add a comment to a Linear issue
 */
export async function addCommentToLinearIssue(input: {
  projectId: string;
  linearId: string;
  body: string;
}): Promise<{ commentId: string }> {
  logger.info('Adding comment to Linear issue', { linearId: input.linearId });

  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);
    const commentId = await client.addComment(input.linearId, input.body);

    logger.info('Comment added to Linear issue', {
      linearId: input.linearId,
      commentId,
    });

    return { commentId };
  } catch (error) {
    logger.error('Failed to add comment to Linear issue', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Create Linear sub-issues from refinement split suggestion
 * Automatically creates sub-tasks when refinement complexity is L or XL
 */
export async function createLinearSubtasks(input: {
  projectId: string;
  parentIssueId: string;
  proposedStories: Array<{
    title: string;
    description: string;
    dependencies?: number[];
    acceptanceCriteria?: string[];
  }>;
  /** Override status for created sub-issues (e.g., "To Refinement") */
  initialStatus?: string;
}): Promise<{
  created: Array<{ index: number; issueId: string; identifier: string; title: string }>;
  failed: Array<{ index: number; title: string; error: string }>;
}> {
  logger.info('Creating sub-issues', {
    parentIssueId: input.parentIssueId,
    count: input.proposedStories.length,
  });

  const apiKey = await resolveLinearApiKey(input.projectId);
  const client = createLinearClient(apiKey);

  const created: Array<{ index: number; issueId: string; identifier: string; title: string }> = [];
  const failed: Array<{ index: number; title: string; error: string }> = [];

  try {
    // Get parent issue details
    const parentIssue = await client.getIssue(input.parentIssueId);
    const team = await parentIssue.team;
    const parentState = await parentIssue.state;

    if (!team) {
      throw new Error(`Parent issue ${input.parentIssueId} has no team`);
    }

    const teamId = team.id;

    // Resolve target state: use initialStatus if provided, otherwise inherit from parent
    let targetStateId = parentState?.id;

    if (input.initialStatus) {
      const states = await team.states();
      const targetState = states.nodes.find(
        (s) => s.name.toLowerCase() === input.initialStatus!.toLowerCase()
      );

      if (targetState) {
        targetStateId = targetState.id;
        logger.info('Using initial status for sub-issues', {
          statusName: input.initialStatus,
          stateId: targetStateId,
        });
      } else {
        logger.warn('Initial status not found, using parent status', {
          requestedStatus: input.initialStatus,
          fallbackStateId: targetStateId,
        });
      }
    }

    // Create each sub-issue
    for (let i = 0; i < input.proposedStories.length; i++) {
      const story = input.proposedStories[i];

      try {
        // Build description with dependencies and acceptance criteria
        let description = story.description;

        // Add dependencies section
        if (story.dependencies && story.dependencies.length > 0) {
          description += '\n\n## Dependencies\n';
          story.dependencies.forEach((depIndex) => {
            if (depIndex < input.proposedStories.length) {
              description += `- Depends on: **${input.proposedStories[depIndex].title}**\n`;
            }
          });
        }

        // Add acceptance criteria section
        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          description += '\n\n## Acceptance Criteria\n';
          story.acceptanceCriteria.forEach((criterion, idx) => {
            description += `${idx + 1}. ${criterion}\n`;
          });
        }

        // Create sub-issue
        const issue = await client.createIssue({
          teamId,
          title: story.title,
          description,
          parentId: input.parentIssueId,
          stateId: targetStateId,
          subIssueSortOrder: i,
        });

        created.push({
          index: i,
          issueId: issue.id,
          identifier: issue.identifier,
          title: story.title,
        });

        logger.info('Sub-issue created', {
          index: i,
          identifier: issue.identifier,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to create sub-issue ${i}`, error as Error);

        failed.push({
          index: i,
          title: story.title,
          error: errorMessage,
        });
      }
    }

    logger.info('Sub-issue creation complete', {
      total: input.proposedStories.length,
      created: created.length,
      failed: failed.length,
    });

    return { created, failed };
  } catch (error) {
    logger.error('Failed to create sub-issues', error as Error);
    throw error;
  }
}

/**
 * Add task type label to a Linear issue
 * Creates the label if it doesn't exist in the team
 *
 * Non-blocking: If labeling fails, logs warning but doesn't throw
 * Idempotent: Skips if issue already has a task type label
 */
export async function addTaskTypeLabel(input: {
  projectId: string;
  issueId: string;
  teamId: string;
  taskType: string;
}): Promise<{ labelId: string; created: boolean }> {
  logger.info('Adding task type label to issue', {
    issueId: input.issueId,
    taskType: input.taskType,
  });

  const apiKey = await resolveLinearApiKey(input.projectId);
  const client = createLinearClient(apiKey);
  const labelService = createLabelService(client);

  try {
    // Check if issue already has a task type label
    const hasLabel = await labelService.hasTaskTypeLabel(input.issueId);

    if (hasLabel) {
      logger.info('Issue already has a task type label, skipping', {
        issueId: input.issueId,
      });
      return { labelId: '', created: false };
    }

    // Ensure label exists (get or create)
    const labelId = await labelService.ensureTaskTypeLabel(input.teamId, input.taskType);

    // Add label to issue
    await client.addLabelsToIssue(input.issueId, [labelId]);

    logger.info('Task type label added', {
      issueId: input.issueId,
      taskType: input.taskType,
      labelId,
    });

    return { labelId, created: true };
  } catch (error) {
    logger.error('Failed to add task type label', error as Error, input);
    // Non-critical operation - log but don't throw
    // This allows the workflow to continue even if labeling fails
    logger.warn('Continuing workflow despite label failure');
    return { labelId: '', created: false };
  }
}

// ============================================
// PO Questions Activities
// ============================================

/**
 * Format a question as a Linear comment
 */
function formatQuestionComment(question: string, index: number, total: number): string {
  return `❓ **Question pour le Product Owner** (${index + 1}/${total})

> ${question}

---
*Répondez à ce commentaire pour que DevFlow puisse continuer le refinement.*`;
}

/**
 * Post questions for the Product Owner as individual Linear comments
 * Each question becomes a separate comment for easy threading
 *
 * @returns Array of comment IDs created
 */
export async function postQuestionsAsComments(input: {
  taskId: string; // Local task ID (not Linear ID)
  projectId: string;
  linearIssueId: string;
  questions: string[];
}): Promise<{ questionCommentIds: string[] }> {
  logger.info('Posting questions as comments', {
    taskId: input.taskId,
    linearIssueId: input.linearIssueId,
    questionsCount: input.questions.length,
  });

  if (input.questions.length === 0) {
    return { questionCommentIds: [] };
  }

  const apiKey = await resolveLinearApiKey(input.projectId);
  const client = createLinearClient(apiKey);

  const questionCommentIds: string[] = [];

  try {
    // Find the Task in database by linearId
    const task = await prisma.task.findFirst({
      where: { linearId: input.linearIssueId },
    });

    if (!task) {
      throw new Error(`Task not found for linearId: ${input.linearIssueId}`);
    }

    // Post each question as a separate comment
    for (let i = 0; i < input.questions.length; i++) {
      const question = input.questions[i];
      const commentBody = formatQuestionComment(question, i, input.questions.length);

      // Create comment in Linear
      const commentId = await client.addComment(input.linearIssueId, commentBody);
      questionCommentIds.push(commentId);

      // Store question in database for tracking
      await prisma.taskQuestion.create({
        data: {
          taskId: task.id,
          questionText: question,
          linearCommentId: commentId,
          answered: false,
        },
      });

      logger.info('Question posted as comment', {
        questionIndex: i,
        commentId,
        taskId: task.id,
      });
    }

    // Mark task as awaiting PO answers
    await prisma.task.update({
      where: { id: task.id },
      data: { awaitingPOAnswers: true },
    });

    logger.info('All questions posted, task marked as awaiting answers', {
      taskId: task.id,
      questionsCount: input.questions.length,
    });

    return { questionCommentIds };
  } catch (error) {
    logger.error('Failed to post questions as comments', error as Error, {
      linearIssueId: input.linearIssueId,
    });
    throw error;
  }
}

/**
 * Check if all questions for a task have been answered
 * Used by the workflow to determine if it should continue
 */
export async function checkQuestionsAnswered(input: {
  taskId: string;
  projectId: string;
}): Promise<{ allAnswered: boolean; answers: Record<string, string>; pendingCount: number }> {
  logger.info('Checking if all questions are answered', { taskId: input.taskId });

  try {
    // Find task by linearId
    const task = await prisma.task.findFirst({
      where: { linearId: input.taskId },
      include: { questions: true },
    });

    if (!task) {
      throw new Error(`Task not found for linearId: ${input.taskId}`);
    }

    const questions = task.questions;
    const answers: Record<string, string> = {};
    let pendingCount = 0;

    for (const q of questions) {
      if (q.answered && q.answerText) {
        answers[q.questionText] = q.answerText;
      } else {
        pendingCount++;
      }
    }

    const allAnswered = pendingCount === 0 && questions.length > 0;

    logger.info('Questions status checked', {
      taskId: task.id,
      totalQuestions: questions.length,
      answered: questions.length - pendingCount,
      pending: pendingCount,
      allAnswered,
    });

    return { allAnswered, answers, pendingCount };
  } catch (error) {
    logger.error('Failed to check questions status', error as Error, { taskId: input.taskId });
    throw error;
  }
}

/**
 * Get all PO answers for a task (to inject into refinement prompt on re-run)
 */
export async function getPOAnswersForTask(input: {
  linearIssueId: string;
  projectId: string;
}): Promise<{ answers: Array<{ question: string; answer: string }> }> {
  logger.info('Getting PO answers for task', { linearIssueId: input.linearIssueId });

  try {
    const task = await prisma.task.findFirst({
      where: { linearId: input.linearIssueId },
      include: {
        questions: {
          where: { answered: true },
        },
      },
    });

    if (!task) {
      return { answers: [] };
    }

    const answers = task.questions
      .filter((q) => q.answered && q.answerText)
      .map((q) => ({
        question: q.questionText,
        answer: q.answerText!,
      }));

    logger.info('PO answers retrieved', {
      linearIssueId: input.linearIssueId,
      answersCount: answers.length,
    });

    return { answers };
  } catch (error) {
    logger.error('Failed to get PO answers', error as Error, { linearIssueId: input.linearIssueId });
    throw error;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract acceptance criteria from issue description
 * Looks for markdown checklist items: - [ ] or - [x]
 */
function extractAcceptanceCriteria(description: string): string[] {
  if (!description) return [];

  const criteria: string[] = [];
  const lines = description.split('\n');

  for (const line of lines) {
    // Match markdown checklist items
    const match = line.match(/^[\s]*[-*]\s*\[[ x]\]\s*(.+)$/i);
    if (match) {
      criteria.push(match[1].trim());
    }
  }

  // If no checklist items found, try to find a section titled "Acceptance Criteria"
  if (criteria.length === 0) {
    const acSection = description.match(/(?:acceptance criteria|ac)[\s:]*\n([\s\S]*?)(?:\n\n|\n#|$)/i);
    if (acSection) {
      const sectionLines = acSection[1].split('\n');
      for (const line of sectionLines) {
        const bulletMatch = line.match(/^[\s]*[-*]\s*(.+)$/);
        if (bulletMatch) {
          criteria.push(bulletMatch[1].trim());
        }
      }
    }
  }

  return criteria;
}
