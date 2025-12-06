/**
 * Linear Client - SDK implementation using @linear/sdk
 */

import { LinearClient as LinearSDK, Issue, WorkflowState } from '@linear/sdk';
import { createLogger } from '@soma-squad-ai/common';
import { LinearConfig, LinearIssue, LinearQueryOptions, LinearTask } from './linear.types';
import { LinearMapper } from './linear.mapper';

export class LinearClient {
  private client: LinearSDK;
  private config: LinearConfig;
  private mapper: LinearMapper;
  private logger = createLogger('LinearClient');

  constructor(config: LinearConfig) {
    this.config = config;
    this.client = new LinearSDK({ apiKey: config.apiKey });
    this.mapper = new LinearMapper();
  }

  // ============================================
  // Issue Operations
  // ============================================

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<Issue> {
    this.logger.info('Getting issue', { issueId });
    return this.client.issue(issueId);
  }

  /**
   * Get full issue details as LinearTask
   */
  async getTask(issueId: string): Promise<LinearTask> {
    this.logger.info('Getting task from Linear', { issueId });

    try {
      const issue = await this.client.issue(issueId);
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      const linearIssue: LinearIssue = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        priorityLabel: this.mapper.mapPriorityToLabel(issue.priority),
        state: state ? { id: state.id, name: state.name, color: state.color, type: state.type } : undefined,
        assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
        labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
        url: issue.url,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      };

      return this.mapper.issueToTask(linearIssue);
    } catch (error) {
      this.logger.error('Failed to get task', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Query issues by team and optional filters
   */
  async queryIssues(options?: LinearQueryOptions): Promise<LinearTask[]> {
    this.logger.info('Querying issues', options);

    try {
      const filter: any = {};

      if (options?.teamId) {
        filter.team = { id: { eq: options.teamId } };
      }

      if (options?.states && options.states.length > 0) {
        filter.state = { name: { in: options.states } };
      }

      if (options?.assigneeId) {
        filter.assignee = { id: { eq: options.assigneeId } };
      }

      if (options?.priority !== undefined) {
        filter.priority = { eq: options.priority };
      }

      const issues = await this.client.issues({
        filter,
        first: options?.first || 50,
        after: options?.after,
      });

      const tasks: LinearTask[] = [];
      for (const issue of issues.nodes) {
        const state = await issue.state;
        const assignee = await issue.assignee;
        const labels = await issue.labels();

        const linearIssue: LinearIssue = {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          priorityLabel: this.mapper.mapPriorityToLabel(issue.priority),
          state: state ? { id: state.id, name: state.name, color: state.color, type: state.type } : undefined,
          assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
          labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
          url: issue.url,
          createdAt: issue.createdAt.toISOString(),
          updatedAt: issue.updatedAt.toISOString(),
        };

        tasks.push(this.mapper.issueToTask(linearIssue));
      }

      this.logger.info('Issues queried', { count: tasks.length });
      return tasks;
    } catch (error) {
      this.logger.error('Failed to query issues', error as Error);
      throw error;
    }
  }

  /**
   * Query issues by status name
   */
  async queryIssuesByStatus(statusName: string): Promise<LinearTask[]> {
    return this.queryIssues({ states: [statusName] });
  }

  // ============================================
  // Update Operations
  // ============================================

  /**
   * Update issue description (replace)
   */
  async updateDescription(issueId: string, description: string): Promise<void> {
    this.logger.info('Updating issue description', { issueId });

    try {
      await this.client.updateIssue(issueId, { description });
      this.logger.info('Description updated', { issueId });
    } catch (error) {
      this.logger.error('Failed to update description', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Append content to existing description
   */
  async appendToDescription(issueId: string, content: string): Promise<void> {
    this.logger.info('Appending to issue description', { issueId });

    try {
      const issue = await this.getIssue(issueId);
      const currentDescription = issue.description || '';
      const newDescription = currentDescription + '\n\n---\n\n' + content;

      await this.updateDescription(issueId, newDescription);
    } catch (error) {
      this.logger.error('Failed to append to description', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Update issue status by status name
   */
  async updateStatus(issueId: string, statusName: string): Promise<void> {
    this.logger.info('Updating issue status', { issueId, statusName });

    try {
      const issue = await this.getIssue(issueId);
      const team = await issue.team;

      if (!team) {
        throw new Error(`Issue ${issueId} has no team`);
      }

      const states = await team.states();
      const targetState = states.nodes.find(
        (s: WorkflowState) => s.name.toLowerCase() === statusName.toLowerCase()
      );

      if (!targetState) {
        throw new Error(`Status "${statusName}" not found in team workflow`);
      }

      await this.client.updateIssue(issueId, { stateId: targetState.id });
      this.logger.info('Status updated', { issueId, statusName });
    } catch (error) {
      this.logger.error('Failed to update status', error as Error, { issueId, statusName });
      throw error;
    }
  }

  // ============================================
  // Comment Operations
  // ============================================

  /**
   * Add a comment to an issue
   */
  async addComment(issueId: string, body: string): Promise<void> {
    this.logger.info('Adding comment to issue', { issueId });

    try {
      await this.client.createComment({ issueId, body });
      this.logger.info('Comment added', { issueId });
    } catch (error) {
      this.logger.error('Failed to add comment', error as Error, { issueId });
      throw error;
    }
  }

  /**
   * Add a warning comment to an issue (for AI-generated content)
   */
  async addWarningComment(issueId: string, message?: string): Promise<void> {
    const warningMessage = message || process.env.LINEAR_SPEC_WARNING_MESSAGE ||
      '⚠️ This specification was generated by Soma Squad AI. Please review before implementation.';

    await this.addComment(issueId, warningMessage);
  }

  // ============================================
  // Utility Operations
  // ============================================

  /**
   * Test connection to Linear
   */
  async testConnection(): Promise<boolean> {
    try {
      const viewer = await this.client.viewer;
      this.logger.info('Connected to Linear', { user: viewer.name });
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Linear', error as Error);
      return false;
    }
  }

  /**
   * Get available workflow states for a team
   */
  async getWorkflowStates(teamId: string): Promise<Array<{ id: string; name: string; type: string }>> {
    const team = await this.client.team(teamId);
    const states = await team.states();

    return states.nodes.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
    }));
  }

  /**
   * Get teams accessible to the user
   */
  async getTeams(): Promise<Array<{ id: string; key: string; name: string }>> {
    const teams = await this.client.teams();

    return teams.nodes.map(t => ({
      id: t.id,
      key: t.key,
      name: t.name,
    }));
  }
}

/**
 * Create a LinearClient instance from environment variables
 */
export function createLinearClient(): LinearClient {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY environment variable is not set');
  }

  return new LinearClient({
    apiKey,
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
    triggerStatus: process.env.LINEAR_TRIGGER_STATUS,
    nextStatus: process.env.LINEAR_NEXT_STATUS,
  });
}
