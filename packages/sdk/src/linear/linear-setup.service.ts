/**
 * Linear Setup Service
 *
 * Handles automatic setup of Linear workspace for DevFlow integration:
 * - Custom Fields (Figma URL, Sentry URL, GitHub Issue URL)
 * - Workflow States validation
 */

import { createLogger } from '@devflow/common';
import { LinearClient, LinearCustomField } from './linear.client';

const logger = createLogger('LinearSetupService');

/**
 * DevFlow custom fields that should be created in Linear
 */
export const DEVFLOW_CUSTOM_FIELDS = {
  FIGMA_URL: 'Figma URL',
  SENTRY_URL: 'Sentry URL',
  GITHUB_ISSUE_URL: 'GitHub Issue URL',
} as const;

export type DevFlowCustomFieldKey = keyof typeof DEVFLOW_CUSTOM_FIELDS;

export interface SetupCustomFieldsResult {
  created: string[];
  existing: string[];
  fieldIds: Record<DevFlowCustomFieldKey, string>;
}

export interface ValidateSetupResult {
  valid: boolean;
  missing: string[];
  fieldIds: Record<string, string>;
}

export class LinearSetupService {
  constructor(private client: LinearClient) {}

  /**
   * Ensure all DevFlow custom fields exist in the Linear team
   * Creates any missing fields and returns the IDs of all fields
   */
  async ensureCustomFields(teamId: string): Promise<SetupCustomFieldsResult> {
    logger.info('Ensuring DevFlow custom fields exist', { teamId });

    const existingFields = await this.client.getCustomFields(teamId);
    const created: string[] = [];
    const existing: string[] = [];
    const fieldIds: Record<string, string> = {};

    for (const [key, name] of Object.entries(DEVFLOW_CUSTOM_FIELDS)) {
      const existingField = existingFields.find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );

      if (existingField) {
        fieldIds[key] = existingField.id;
        existing.push(name);
        logger.info('Custom field already exists', { name, id: existingField.id });
      } else {
        try {
          const newField = await this.client.createCustomField(teamId, name, 'text');
          fieldIds[key] = newField.id;
          created.push(name);
          logger.info('Custom field created', { name, id: newField.id });
        } catch (error) {
          logger.error('Failed to create custom field', error as Error, { name });
          throw new Error(`Failed to create custom field "${name}": ${(error as Error).message}`);
        }
      }
    }

    logger.info('Custom fields setup complete', {
      teamId,
      created: created.length,
      existing: existing.length,
    });

    return {
      created,
      existing,
      fieldIds: fieldIds as Record<DevFlowCustomFieldKey, string>,
    };
  }

  /**
   * Validate that all DevFlow custom fields exist
   * Does not create any fields, just checks
   */
  async validateSetup(teamId: string): Promise<ValidateSetupResult> {
    logger.info('Validating DevFlow custom fields', { teamId });

    const existingFields = await this.client.getCustomFields(teamId);
    const missing: string[] = [];
    const fieldIds: Record<string, string> = {};

    for (const [key, name] of Object.entries(DEVFLOW_CUSTOM_FIELDS)) {
      const existingField = existingFields.find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );

      if (existingField) {
        fieldIds[key] = existingField.id;
      } else {
        missing.push(name);
      }
    }

    const valid = missing.length === 0;

    logger.info('Validation complete', {
      teamId,
      valid,
      missing,
    });

    return {
      valid,
      missing,
      fieldIds,
    };
  }

  /**
   * Get custom field values from an issue and map to DevFlow fields
   */
  async getDevFlowFieldValues(
    issueId: string
  ): Promise<{
    figmaUrl?: string;
    sentryUrl?: string;
    githubIssueUrl?: string;
  }> {
    const customFields = await this.client.getIssueCustomFields(issueId);

    return {
      figmaUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.FIGMA_URL),
      sentryUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.SENTRY_URL),
      githubIssueUrl: customFields.get(DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL),
    };
  }
}

/**
 * Create a LinearSetupService instance
 */
export function createLinearSetupService(client: LinearClient): LinearSetupService {
  return new LinearSetupService(client);
}
