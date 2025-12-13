/**
 * Linear Sync API Service
 *
 * Handles synchronization between Linear and DevFlow database.
 * Uses OAuth tokens per-project from OAuthConnection.
 */

import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { createLogger } from '@devflow/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createLinearClient,
  createLinearSyncService,
  LinearSyncService,
  TaskSyncData,
} from '@devflow/sdk';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';

const logger = createLogger('LinearSyncApiService');

export interface SyncTaskResult {
  taskId: string;
  linearId: string;
  identifier: string;
  action: 'created' | 'updated' | 'unchanged';
  changes?: string[];
}

export interface CommentContext {
  issueId: string;
  commentId: string;
  body: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface CommentAction {
  type: 'sync' | 'refresh' | 'none' | 'command';
  command?: string;
  args?: string[];
}

@Injectable()
export class LinearSyncApiService {
  constructor(
    private prisma: PrismaService,
    private tokenRefreshService: TokenRefreshService,
  ) {}

  /**
   * Get LinearSyncService for a project using OAuth token
   */
  private async getSyncService(projectId: string): Promise<LinearSyncService> {
    const token = await this.tokenRefreshService.getAccessToken(
      projectId,
      OAuthProvider.LINEAR,
    );

    const client = createLinearClient(token);
    return createLinearSyncService(client);
  }

  /**
   * Sync a single issue from Linear to database
   */
  async syncIssueToDatabase(
    projectId: string,
    linearId: string,
  ): Promise<SyncTaskResult> {
    logger.info('Syncing issue to database', { projectId, linearId });

    const syncService = await this.getSyncService(projectId);

    // Fetch full issue from Linear
    const fullIssue = await syncService.fetchFullIssue(linearId);
    const taskData = syncService.mapLinearToTask(fullIssue);

    // Check if task exists
    const existingTask = await this.prisma.task.findUnique({
      where: { linearId },
    });

    if (existingTask) {
      // Compare and update
      const changes: string[] = [];

      const updateData: any = {};

      if (existingTask.title !== taskData.title) {
        updateData.title = taskData.title;
        changes.push('title');
      }
      if (existingTask.description !== taskData.description) {
        updateData.description = taskData.description;
        changes.push('description');
      }
      if (existingTask.assignee !== taskData.assignee) {
        updateData.assignee = taskData.assignee;
        changes.push('assignee');
      }
      if (existingTask.storyPoints !== taskData.storyPoints) {
        updateData.storyPoints = taskData.storyPoints;
        changes.push('storyPoints');
      }
      if (existingTask.epic !== taskData.epic) {
        updateData.epic = taskData.epic;
        changes.push('epic');
      }
      if (existingTask.figmaUrl !== taskData.figmaUrl) {
        updateData.figmaUrl = taskData.figmaUrl;
        changes.push('figmaUrl');
      }
      if (existingTask.sentryUrl !== taskData.sentryUrl) {
        updateData.sentryUrl = taskData.sentryUrl;
        changes.push('sentryUrl');
      }
      if (existingTask.githubIssueUrl !== taskData.githubIssueUrl) {
        updateData.githubIssueUrl = taskData.githubIssueUrl;
        changes.push('githubIssueUrl');
      }

      // Compare labels
      const existingLabels = existingTask.labels || [];
      const newLabels = taskData.labels || [];
      if (JSON.stringify(existingLabels.sort()) !== JSON.stringify(newLabels.sort())) {
        updateData.labels = newLabels;
        changes.push('labels');
      }

      // Update metadata
      const existingMetadata = (existingTask.metadata as any) || {};
      if (
        existingMetadata.identifier !== taskData.metadata.identifier ||
        existingMetadata.url !== taskData.metadata.url ||
        existingMetadata.teamId !== taskData.metadata.teamId
      ) {
        updateData.metadata = taskData.metadata;
        changes.push('metadata');
      }

      if (changes.length > 0) {
        await this.prisma.task.update({
          where: { linearId },
          data: updateData,
        });

        logger.info('Task updated from Linear', {
          taskId: existingTask.id,
          linearId,
          changes,
        });

        return {
          taskId: existingTask.id,
          linearId,
          identifier: taskData.metadata.identifier,
          action: 'updated',
          changes,
        };
      }

      return {
        taskId: existingTask.id,
        linearId,
        identifier: taskData.metadata.identifier,
        action: 'unchanged',
      };
    }

    // Create new task
    const newTask = await this.prisma.task.create({
      data: {
        projectId,
        linearId,
        title: taskData.title,
        description: taskData.description,
        status: this.mapLinearStatus(taskData.status),
        priority: this.mapLinearPriority(taskData.priority),
        assignee: taskData.assignee,
        storyPoints: taskData.storyPoints,
        epic: taskData.epic,
        labels: taskData.labels,
        figmaUrl: taskData.figmaUrl,
        sentryUrl: taskData.sentryUrl,
        githubIssueUrl: taskData.githubIssueUrl,
        metadata: taskData.metadata,
      },
    });

    logger.info('Task created from Linear', {
      taskId: newTask.id,
      linearId,
      identifier: taskData.metadata.identifier,
    });

    return {
      taskId: newTask.id,
      linearId,
      identifier: taskData.metadata.identifier,
      action: 'created',
    };
  }

  /**
   * Sync task from database to Linear
   */
  async syncTaskToLinear(
    projectId: string,
    taskId: string,
    options: { dryRun?: boolean } = {},
  ): Promise<{ synced: string[]; errors: string[] }> {
    logger.info('Syncing task to Linear', { projectId, taskId, dryRun: options.dryRun });

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!task.linearId) {
      throw new Error(`Task ${taskId} has no Linear ID`);
    }

    const syncService = await this.getSyncService(projectId);

    const taskData: Partial<TaskSyncData> = {
      title: task.title,
      description: task.description,
      priority: task.priority,
      labels: task.labels || [],
      storyPoints: task.storyPoints || undefined,
      figmaUrl: task.figmaUrl || undefined,
      sentryUrl: task.sentryUrl || undefined,
      githubIssueUrl: task.githubIssueUrl || undefined,
    };

    const result = await syncService.syncTaskToLinear(task.linearId, taskData, options);

    return {
      synced: result.synced,
      errors: result.errors,
    };
  }

  /**
   * Parse a Linear comment to determine if it contains a DevFlow command
   * Commands: @devflow sync, @devflow refresh, @devflow status
   */
  parseCommentForCommand(comment: CommentContext): CommentAction {
    const body = comment.body.toLowerCase().trim();

    // Check for @devflow mentions
    const devflowMention = body.match(/@devflow\s+(\w+)(?:\s+(.*))?/);

    if (devflowMention) {
      const command = devflowMention[1];
      const args = devflowMention[2]?.split(/\s+/).filter(Boolean) || [];

      switch (command) {
        case 'sync':
        case 'refresh':
          return { type: 'sync' };

        case 'status':
        case 'info':
          return { type: 'command', command: 'status', args };

        default:
          return { type: 'command', command, args };
      }
    }

    // No command found
    return { type: 'none' };
  }

  /**
   * Handle a Linear comment webhook
   * Returns action taken and result
   */
  async handleComment(
    projectId: string,
    comment: CommentContext,
  ): Promise<{
    action: CommentAction;
    result?: SyncTaskResult;
    message?: string;
  }> {
    logger.info('Handling Linear comment', {
      projectId,
      issueId: comment.issueId,
      commentId: comment.commentId,
    });

    const action = this.parseCommentForCommand(comment);

    if (action.type === 'none') {
      logger.debug('No DevFlow command in comment', { commentId: comment.commentId });
      return { action };
    }

    if (action.type === 'sync') {
      logger.info('Sync command detected, syncing issue', {
        issueId: comment.issueId,
      });

      const result = await this.syncIssueToDatabase(projectId, comment.issueId);

      return {
        action,
        result,
        message: `Synced issue ${result.identifier}: ${result.action}${
          result.changes ? ` (${result.changes.join(', ')})` : ''
        }`,
      };
    }

    if (action.type === 'command') {
      logger.info('DevFlow command detected', {
        command: action.command,
        args: action.args,
      });

      // Handle other commands (status, etc.)
      return {
        action,
        message: `Command "${action.command}" received but not yet implemented`,
      };
    }

    return { action };
  }

  /**
   * Map Linear status string to Prisma TaskStatus enum
   */
  private mapLinearStatus(linearStatus: string): any {
    const normalizedStatus = linearStatus.toLowerCase();

    if (
      normalizedStatus.includes('backlog') ||
      normalizedStatus.includes('triage') ||
      normalizedStatus.includes('todo')
    ) {
      return 'TODO';
    }
    if (normalizedStatus.includes('spec')) {
      return 'SPECIFICATION';
    }
    if (normalizedStatus.includes('progress') || normalizedStatus.includes('doing')) {
      return 'IN_PROGRESS';
    }
    if (normalizedStatus.includes('review')) {
      return 'IN_REVIEW';
    }
    if (normalizedStatus.includes('test') || normalizedStatus.includes('qa')) {
      return 'TESTING';
    }
    if (
      normalizedStatus.includes('done') ||
      normalizedStatus.includes('complete') ||
      normalizedStatus.includes('closed')
    ) {
      return 'DONE';
    }
    if (normalizedStatus.includes('block') || normalizedStatus.includes('cancel')) {
      return 'BLOCKED';
    }
    return 'TODO';
  }

  /**
   * Map Linear priority string to Prisma TaskPriority enum
   */
  private mapLinearPriority(linearPriority: string): any {
    const normalizedPriority = linearPriority.toLowerCase();

    if (normalizedPriority.includes('urgent') || normalizedPriority.includes('critical')) {
      return 'CRITICAL';
    }
    if (normalizedPriority.includes('high')) {
      return 'HIGH';
    }
    if (normalizedPriority.includes('medium') || normalizedPriority.includes('normal')) {
      return 'MEDIUM';
    }
    if (normalizedPriority.includes('low')) {
      return 'LOW';
    }
    return 'MEDIUM';
  }
}
