/**
 * Linear Sync Service
 *
 * Auto-detection and bidirectional synchronization between Task model and Linear issues.
 * This service can be used outside of Temporal workflows for direct sync operations.
 */

import { createLogger } from '@devflow/common';
import { LinearClient, LinearCustomField } from './linear.client';
import { LinearMapper } from './linear.mapper';
import { DEVFLOW_CUSTOM_FIELDS } from './linear-setup.service';

const logger = createLogger('LinearSyncService');

// ============================================
// Field Mapping Configuration
// ============================================

/**
 * Defines how Task fields map to Linear fields
 * This is the source of truth for synchronization
 */
export const TASK_TO_LINEAR_FIELD_MAP = {
  // Direct mappings
  linearId: { linearField: 'id', direction: 'linear_to_task' },
  title: { linearField: 'title', direction: 'bidirectional' },
  description: { linearField: 'description', direction: 'bidirectional' },
  priority: { linearField: 'priority', direction: 'bidirectional', transform: 'priority' },
  status: { linearField: 'state.name', direction: 'bidirectional', transform: 'status' },
  assignee: { linearField: 'assignee.name', direction: 'linear_to_task' },
  labels: { linearField: 'labels', direction: 'bidirectional', transform: 'labels' },

  // Fields that need special handling
  storyPoints: { linearField: 'estimate', direction: 'bidirectional' },
  epic: { linearField: 'parent.identifier', direction: 'linear_to_task' },

  // Custom fields
  figmaUrl: { linearField: `customField:${DEVFLOW_CUSTOM_FIELDS.FIGMA_URL}`, direction: 'bidirectional' },
  sentryUrl: { linearField: `customField:${DEVFLOW_CUSTOM_FIELDS.SENTRY_URL}`, direction: 'bidirectional' },
  githubIssueUrl: { linearField: `customField:${DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL}`, direction: 'bidirectional' },

  // Metadata fields (stored in Task.metadata JSON)
  'metadata.identifier': { linearField: 'identifier', direction: 'linear_to_task' },
  'metadata.url': { linearField: 'url', direction: 'linear_to_task' },
  'metadata.cycleId': { linearField: 'cycle.id', direction: 'linear_to_task' },
  'metadata.cycleName': { linearField: 'cycle.name', direction: 'linear_to_task' },
  'metadata.parentId': { linearField: 'parent.id', direction: 'linear_to_task' },
  'metadata.teamId': { linearField: 'team.id', direction: 'linear_to_task' },
  'metadata.teamKey': { linearField: 'team.key', direction: 'linear_to_task' },
} as const;

export type TaskFieldKey = keyof typeof TASK_TO_LINEAR_FIELD_MAP;
export type SyncDirection = 'linear_to_task' | 'task_to_linear' | 'bidirectional';

// ============================================
// Types
// ============================================

export interface LinearFullIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  estimate?: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  state?: {
    id: string;
    name: string;
    type: string;
  };
  assignee?: {
    id: string;
    name: string;
    email?: string;
  };
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  parent?: {
    id: string;
    identifier: string;
    title: string;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
  };
  team?: {
    id: string;
    key: string;
    name: string;
  };
  customFields?: Map<string, string>;
}

export interface TaskSyncData {
  linearId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
  epic?: string;
  storyPoints?: number;
  labels: string[];
  figmaUrl?: string;
  sentryUrl?: string;
  githubIssueUrl?: string;
  metadata: {
    identifier: string;
    url: string;
    cycleId?: string;
    cycleName?: string;
    parentId?: string;
    teamId: string;
    teamKey: string;
  };
}

export interface SyncDiff {
  field: string;
  taskValue: any;
  linearValue: any;
  direction: SyncDirection;
}

export interface SyncResult {
  success: boolean;
  synced: string[];
  errors: string[];
  diffs: SyncDiff[];
}

// ============================================
// Linear Sync Service
// ============================================

export class LinearSyncService {
  private client: LinearClient;
  private mapper: LinearMapper;

  constructor(client: LinearClient) {
    this.client = client;
    this.mapper = new LinearMapper();
  }

  /**
   * Fetch full issue data from Linear including all syncable fields
   */
  async fetchFullIssue(issueId: string): Promise<LinearFullIssue> {
    logger.info('Fetching full issue from Linear', { issueId });

    try {
      const issue = await this.client.getIssue(issueId);

      // Fetch related data
      const [state, assignee, labels, parent, cycle, team] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.labels(),
        issue.parent,
        issue.cycle,
        issue.team,
      ]);

      // Fetch custom fields
      const customFields = await this.client.getIssueCustomFields(issueId);

      const fullIssue: LinearFullIssue = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || undefined,
        priority: issue.priority,
        estimate: issue.estimate || undefined,
        url: issue.url,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        state: state ? {
          id: state.id,
          name: state.name,
          type: state.type,
        } : undefined,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email || undefined,
        } : undefined,
        labels: labels.nodes.map(l => ({
          id: l.id,
          name: l.name,
          color: l.color,
        })),
        parent: parent ? {
          id: parent.id,
          identifier: parent.identifier,
          title: parent.title,
        } : undefined,
        cycle: cycle ? {
          id: cycle.id,
          name: cycle.name || `Cycle ${cycle.number}`,
          number: cycle.number,
        } : undefined,
        team: team ? {
          id: team.id,
          key: team.key,
          name: team.name,
        } : undefined,
        customFields,
      };

      logger.info('Full issue fetched', {
        identifier: fullIssue.identifier,
        hasParent: !!fullIssue.parent,
        hasCycle: !!fullIssue.cycle,
        customFieldCount: customFields.size,
      });

      return fullIssue;
    } catch (error) {
      logger.error('Failed to fetch full issue', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Convert Linear issue to TaskSyncData using the field mapping
   */
  mapLinearToTask(issue: LinearFullIssue): TaskSyncData {
    return {
      linearId: issue.id,
      title: issue.title,
      description: issue.description || '',
      status: this.mapper.mapStatusFromLinear(issue.state?.name),
      priority: this.mapper.mapPriorityFromLinear(issue.priority),
      assignee: issue.assignee?.name,
      epic: issue.parent?.identifier,
      storyPoints: issue.estimate,
      labels: issue.labels?.map(l => l.name) || [],
      figmaUrl: issue.customFields?.get(DEVFLOW_CUSTOM_FIELDS.FIGMA_URL),
      sentryUrl: issue.customFields?.get(DEVFLOW_CUSTOM_FIELDS.SENTRY_URL),
      githubIssueUrl: issue.customFields?.get(DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL),
      metadata: {
        identifier: issue.identifier,
        url: issue.url,
        cycleId: issue.cycle?.id,
        cycleName: issue.cycle?.name,
        parentId: issue.parent?.id,
        teamId: issue.team?.id || '',
        teamKey: issue.team?.key || '',
      },
    };
  }

  /**
   * Compare task data with Linear data and return differences
   */
  compareTaskWithLinear(
    taskData: Partial<TaskSyncData>,
    linearData: TaskSyncData
  ): SyncDiff[] {
    const diffs: SyncDiff[] = [];

    for (const [taskField, mapping] of Object.entries(TASK_TO_LINEAR_FIELD_MAP)) {
      // Skip metadata fields for now (they're nested)
      if (taskField.startsWith('metadata.')) continue;

      const taskValue = (taskData as any)[taskField];
      const linearValue = (linearData as any)[taskField];

      // Check if values differ
      if (!this.valuesEqual(taskValue, linearValue)) {
        diffs.push({
          field: taskField,
          taskValue,
          linearValue,
          direction: mapping.direction as SyncDirection,
        });
      }
    }

    return diffs;
  }

  /**
   * Sync task to Linear (update Linear with task data)
   * Only syncs fields marked as 'bidirectional' or 'task_to_linear'
   */
  async syncTaskToLinear(
    issueId: string,
    taskData: Partial<TaskSyncData>,
    options: { dryRun?: boolean } = {}
  ): Promise<SyncResult> {
    logger.info('Syncing task to Linear', { issueId, dryRun: options.dryRun });

    const result: SyncResult = {
      success: true,
      synced: [],
      errors: [],
      diffs: [],
    };

    try {
      // Fetch current Linear data
      const linearIssue = await this.fetchFullIssue(issueId);
      const linearData = this.mapLinearToTask(linearIssue);

      // Compare and get diffs
      const diffs = this.compareTaskWithLinear(taskData, linearData);
      result.diffs = diffs;

      // Filter to only fields that can be synced to Linear
      const syncableFields = diffs.filter(d =>
        d.direction === 'bidirectional' || d.direction === 'task_to_linear'
      );

      if (options.dryRun) {
        logger.info('Dry run - would sync fields', {
          fields: syncableFields.map(f => f.field),
        });
        return result;
      }

      // Apply updates to Linear
      for (const diff of syncableFields) {
        try {
          await this.updateLinearField(issueId, linearIssue, diff.field, diff.taskValue);
          result.synced.push(diff.field);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`${diff.field}: ${errorMsg}`);
          result.success = false;
        }
      }

      logger.info('Sync to Linear complete', {
        synced: result.synced.length,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to sync task to Linear', error as Error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Update a specific field in Linear
   */
  private async updateLinearField(
    issueId: string,
    linearIssue: LinearFullIssue,
    field: string,
    value: any
  ): Promise<void> {
    const mapping = TASK_TO_LINEAR_FIELD_MAP[field as TaskFieldKey];
    if (!mapping) {
      throw new Error(`Unknown field: ${field}`);
    }

    switch (field) {
      case 'title':
      case 'description':
        // Direct update via API
        await this.client['client'].updateIssue(issueId, { [field]: value });
        break;

      case 'priority':
        const linearPriority = this.mapper.mapPriorityToLinear(value);
        await this.client['client'].updateIssue(issueId, { priority: linearPriority });
        break;

      case 'status':
        await this.client.updateStatus(issueId, this.mapper.mapStatusToLinear(value));
        break;

      case 'storyPoints':
        await this.client['client'].updateIssue(issueId, { estimate: value });
        break;

      case 'labels':
        // Get or create labels, then update
        const teamId = linearIssue.team?.id;
        if (teamId && Array.isArray(value)) {
          await this.syncLabels(issueId, teamId, value);
        }
        break;

      case 'figmaUrl':
      case 'sentryUrl':
      case 'githubIssueUrl':
        await this.updateCustomField(issueId, linearIssue.team?.id || '', field, value);
        break;

      default:
        logger.warn('Field not supported for sync to Linear', { field });
    }
  }

  /**
   * Sync labels to Linear (create missing labels, update issue)
   */
  private async syncLabels(issueId: string, teamId: string, labelNames: string[]): Promise<void> {
    const existingLabels = await this.client.getTeamLabels(teamId);
    const labelIds: string[] = [];

    for (const name of labelNames) {
      let label = existingLabels.find(l => l.name.toLowerCase() === name.toLowerCase());

      if (!label) {
        // Create label if it doesn't exist
        label = await this.client.createLabel(teamId, name);
      }

      labelIds.push(label.id);
    }

    // Update issue with label IDs
    await this.client['client'].updateIssue(issueId, { labelIds });
  }

  /**
   * Update a custom field on an issue
   */
  private async updateCustomField(
    issueId: string,
    teamId: string,
    fieldKey: string,
    value: string | undefined
  ): Promise<void> {
    const fieldNameMap: Record<string, string> = {
      figmaUrl: DEVFLOW_CUSTOM_FIELDS.FIGMA_URL,
      sentryUrl: DEVFLOW_CUSTOM_FIELDS.SENTRY_URL,
      githubIssueUrl: DEVFLOW_CUSTOM_FIELDS.GITHUB_ISSUE_URL,
    };

    const fieldName = fieldNameMap[fieldKey];
    if (!fieldName) return;

    // Get custom field ID
    const customFields = await this.client.getCustomFields(teamId);
    const field = customFields.find(f => f.name === fieldName);

    if (field && value) {
      await this.client.updateIssueCustomField(issueId, field.id, value);
    }
  }

  /**
   * Check if two values are equal (handles arrays)
   */
  private valuesEqual(a: any, b: any): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((v, i) => v === sortedB[i]);
    }
    return a === b;
  }

  /**
   * Get list of fields that can be synced and their current mapping
   */
  getFieldMapping(): Array<{
    taskField: string;
    linearField: string;
    direction: SyncDirection;
  }> {
    return Object.entries(TASK_TO_LINEAR_FIELD_MAP).map(([taskField, mapping]) => ({
      taskField,
      linearField: mapping.linearField,
      direction: mapping.direction as SyncDirection,
    }));
  }

  /**
   * Get fields that are currently not synced (one-way only)
   */
  getUnsyncedFields(): string[] {
    return Object.entries(TASK_TO_LINEAR_FIELD_MAP)
      .filter(([_, mapping]) => mapping.direction === 'linear_to_task')
      .map(([field]) => field);
  }
}

/**
 * Create a LinearSyncService instance
 */
export function createLinearSyncService(client: LinearClient): LinearSyncService {
  return new LinearSyncService(client);
}
