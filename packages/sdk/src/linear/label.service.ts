/**
 * Linear Label Service
 *
 * Handles automatic label management for DevFlow task types:
 * - feature, bug, enhancement, chore
 */

import { createLogger } from '@devflow/common';
import { LinearClient } from './linear.client';

const logger = createLogger('LabelService');

/**
 * DevFlow task type labels with predefined colors
 */
export const TASK_TYPE_LABELS: Record<string, { name: string; color: string }> = {
  feature: { name: 'feature', color: '#22c55e' }, // green
  bug: { name: 'bug', color: '#ef4444' }, // red
  enhancement: { name: 'enhancement', color: '#3b82f6' }, // blue
  chore: { name: 'chore', color: '#6b7280' }, // gray
} as const;

export type TaskType = keyof typeof TASK_TYPE_LABELS;

export class LabelService {
  constructor(private client: LinearClient) {}

  /**
   * Get or create a label in the team
   * Returns the label ID
   */
  async ensureLabel(teamId: string, name: string, color?: string): Promise<string> {
    logger.info('Ensuring label exists', { teamId, name });

    try {
      // Get existing labels
      const existingLabels = await this.client.getTeamLabels(teamId);

      // Check if label already exists (case-insensitive)
      const existing = existingLabels.find(l => l.name.toLowerCase() === name.toLowerCase());

      if (existing) {
        logger.info('Label already exists', { name, id: existing.id });
        return existing.id;
      }

      // Create new label
      const newLabel = await this.client.createLabel(teamId, name, color);
      logger.info('Label created', { name, id: newLabel.id });
      return newLabel.id;
    } catch (error) {
      logger.error('Failed to ensure label', error as Error, { teamId, name });
      throw error;
    }
  }

  /**
   * Ensure task type label exists and return its ID
   * Uses predefined colors for consistency
   */
  async ensureTaskTypeLabel(teamId: string, taskType: string): Promise<string> {
    const labelConfig = TASK_TYPE_LABELS[taskType as TaskType];

    if (!labelConfig) {
      logger.warn('Unknown task type, using as-is', { taskType });
      return this.ensureLabel(teamId, taskType);
    }

    return this.ensureLabel(teamId, labelConfig.name, labelConfig.color);
  }

  /**
   * Check if an issue already has a task type label
   */
  async hasTaskTypeLabel(issueId: string): Promise<boolean> {
    try {
      const issue = await this.client.getIssue(issueId);
      const labels = await issue.labels();

      const taskTypeNames = Object.values(TASK_TYPE_LABELS).map(l => l.name.toLowerCase());

      return labels.nodes.some(l => taskTypeNames.includes(l.name.toLowerCase()));
    } catch (error) {
      logger.error('Failed to check task type labels', error as Error, { issueId });
      return false; // Assume no label on error
    }
  }
}

/**
 * Create a LabelService instance
 */
export function createLabelService(client: LinearClient): LabelService {
  return new LabelService(client);
}
