/**
 * Linear Integration Activities - Temporal activities for Linear integration
 */

import { createLogger } from '@devflow/common';
import { createLinearClient, formatSpecAsMarkdown, formatWarningMessage } from '@devflow/sdk';

const logger = createLogger('LinearActivities');

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
  acceptanceCriteria?: string[];
}

// ============================================
// Activities
// ============================================

/**
 * Sync task from Linear
 */
export async function syncLinearTask(input: SyncLinearTaskInput): Promise<SyncLinearTaskOutput> {
  logger.info('Syncing task from Linear', input);

  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured');
  }

  try {
    const client = createLinearClient();
    const task = await client.getTask(input.taskId);

    logger.info('Task synced from Linear', { identifier: task.identifier });

    // Extract acceptance criteria from description (lines starting with "- [ ]" or "- [x]")
    const acceptanceCriteria = extractAcceptanceCriteria(task.description);

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
      acceptanceCriteria,
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
  linearId: string;
  updates: {
    status?: string;
    description?: string;
  };
}): Promise<void> {
  logger.info('Updating task in Linear', { linearId: input.linearId });

  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured');
  }

  try {
    const client = createLinearClient();

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
export async function queryLinearTasksByStatus(status: string): Promise<SyncLinearTaskOutput[]> {
  logger.info('Querying Linear tasks by status', { status });

  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured');
  }

  try {
    const client = createLinearClient();
    const tasks = await client.queryIssuesByStatus(status);

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

  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured');
  }

  try {
    const client = createLinearClient();

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
  linearId: string;
  message?: string;
}): Promise<void> {
  logger.info('Adding warning comment to Linear issue', { linearId: input.linearId });

  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured');
  }

  try {
    const client = createLinearClient();

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
