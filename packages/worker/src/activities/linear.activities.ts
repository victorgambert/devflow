/**
 * Linear Integration Activities - OAuth Ready (Phase 5)
 * Linear OAuth Device Flow will be added in Phase 6
 */

import { createLogger } from '@devflow/common';
import type {
  RefinementOutput,
  UserStoryGenerationOutput,
  TechnicalPlanGenerationOutput,
} from '@devflow/common';
import {
  createLinearClient,
  createLabelService,
  formatSpecAsMarkdown,
  formatWarningMessage,
  formatRefinementAsMarkdown,
  formatUserStoryAsMarkdown,
  formatTechnicalPlanAsMarkdown,
  DEVFLOW_CUSTOM_FIELDS,
} from '@devflow/sdk';
import { oauthResolver } from '@/services/oauth-context';
import {
  parseExternalLinksFromDescription,
  type ExternalContextLinks,
} from './context-extraction.activities';

const logger = createLogger('LinearActivities');

/**
 * Resolve Linear API key for a project via OAuth
 * TODO Phase 6: Implement Linear OAuth Device Flow
 * For now, throws error until Linear OAuth is implemented
 */
async function resolveLinearApiKey(projectId: string): Promise<string> {
  try {
    const token = await oauthResolver.resolveLinearToken(projectId);
    logger.info('Using OAuth token for Linear', { projectId });
    return token;
  } catch (error) {
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

    logger.info('Task synced from Linear', { identifier: task.identifier, teamId });

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
 */
export async function appendRefinementToLinearIssue(input: {
  projectId: string;
  linearId: string;
  refinement: RefinementOutput;
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
    }>;
    bestModel: string;
    detailedExplanation: string;
  };
}): Promise<void> {
  logger.info('Appending refinement to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Format refinement as markdown
    let markdown = formatRefinementAsMarkdown(input.refinement);

    // Add multi-LLM comparison section if used
    if (input.multiLLM) {
      markdown += '\n\n---\n\n';
      markdown += '## 🤖 Multi-LLM Analysis\n\n';
      markdown += input.multiLLM.detailedExplanation;
    }

    // Append to issue description
    await client.appendToDescription(input.linearId, markdown);

    logger.info('Refinement appended to Linear issue', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to append refinement to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Append user story content to Linear issue description
 * Phase 2 of Three-Phase Agile Workflow
 */
export async function appendUserStoryToLinearIssue(input: {
  projectId: string;
  linearId: string;
  userStory: UserStoryGenerationOutput;
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
    }>;
    bestModel: string;
    detailedExplanation: string;
  };
}): Promise<void> {
  logger.info('Appending user story to Linear issue', { linearId: input.linearId });

  // Resolve Linear API key via OAuth
  const apiKey = await resolveLinearApiKey(input.projectId);

  try {
    const client = createLinearClient(apiKey);

    // Format user story as markdown
    let markdown = formatUserStoryAsMarkdown(input.userStory);

    // Add multi-LLM comparison section if used
    if (input.multiLLM) {
      markdown += '\n\n---\n\n';
      markdown += '## 🤖 Multi-LLM Analysis\n\n';
      markdown += input.multiLLM.detailedExplanation;
    }

    // Append to issue description
    await client.appendToDescription(input.linearId, markdown);

    logger.info('User story appended to Linear issue', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to append user story to Linear', error as Error, { linearId: input.linearId });
    throw error;
  }
}

/**
 * Append technical plan content to Linear issue description
 * Phase 3 of Three-Phase Agile Workflow
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
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
    }>;
    bestModel: string;
    detailedExplanation: string;
  };
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

    // Format technical plan as markdown
    let markdown = formatTechnicalPlanAsMarkdown(input.plan);

    // Add codebase context section if provided
    if (input.contextUsed) {
      markdown += '\n\n---\n\n';
      markdown += '## 🔍 Codebase Context\n\n';
      markdown += `**Language:** ${input.contextUsed.language}\n`;

      if (input.contextUsed.framework) {
        markdown += `**Framework:** ${input.contextUsed.framework}\n`;
      }

      markdown += `**Dependencies analyzed:** ${input.contextUsed.dependencies}\n`;
      markdown += `**Conventions found:** ${input.contextUsed.conventions}\n`;
      markdown += `**Using RAG:** ${input.contextUsed.usingRAG ? 'Yes' : 'No (legacy analysis)'}\n`;

      if (input.contextUsed.filesAnalyzed && input.contextUsed.filesAnalyzed.length > 0) {
        markdown += '\n**Referenced files:**\n';
        input.contextUsed.filesAnalyzed.forEach((file) => {
          markdown += `- \`${file}\`\n`;
        });
      }

      markdown += '\n> This plan was generated with codebase context to follow existing patterns.\n';
    }

    // Add best practices section if provided
    if (input.bestPractices) {
      markdown += '\n\n---\n\n';
      markdown += '## 💡 Industry Best Practices\n\n';
      markdown += `> Fetched from ${input.bestPractices.perplexityModel}\n\n`;
      markdown += input.bestPractices.bestPractices;
      markdown += '\n\n> These best practices were retrieved from Perplexity to ensure the implementation follows industry standards.\n';
    }

    // Add multi-LLM comparison section if used
    if (input.multiLLM) {
      markdown += '\n\n---\n\n';
      markdown += '## 🤖 Multi-LLM Analysis\n\n';
      markdown += input.multiLLM.detailedExplanation;
    }

    // Append to issue description
    await client.appendToDescription(input.linearId, markdown);

    logger.info('Technical plan appended to Linear issue', { linearId: input.linearId });
  } catch (error) {
    logger.error('Failed to append technical plan to Linear', error as Error, { linearId: input.linearId });
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
    const state = await parentIssue.state;

    if (!team) {
      throw new Error(`Parent issue ${input.parentIssueId} has no team`);
    }

    const teamId = team.id;
    const parentStateId = state?.id;

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
          stateId: parentStateId,
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
