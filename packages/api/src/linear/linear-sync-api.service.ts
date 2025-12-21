/**
 * Linear Sync API Service
 *
 * Handles synchronization between Linear and DevFlow database.
 * Uses OAuth tokens per-project from OAuthConnection.
 */

import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import {
  createLogger,
  DEFAULT_WORKFLOW_CONFIG,
  getStatusRank,
  getStatusAtRank,
} from '@devflow/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createLinearClient,
  createLinearSyncService,
  LinearSyncService,
  LinearClient,
  TaskSyncData,
  LinearComment,
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
   * Get LinearClient for a project using OAuth token
   */
  private async getLinearClient(projectId: string): Promise<LinearClient> {
    const token = await this.tokenRefreshService.getAccessToken(
      projectId,
      OAuthProvider.LINEAR,
    );

    return createLinearClient(token);
  }

  /**
   * Get LinearSyncService for a project using OAuth token
   */
  private async getSyncService(projectId: string): Promise<LinearSyncService> {
    const client = await this.getLinearClient(projectId);
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

  // ============================================
  // Comment Synchronization
  // ============================================

  /**
   * Sync a single comment from Linear to database
   */
  async syncCommentToDatabase(
    projectId: string,
    linearCommentId: string,
    linearIssueId: string,
  ): Promise<{
    commentId: string;
    action: 'created' | 'updated' | 'skipped';
  }> {
    logger.info('Syncing comment to database', { linearCommentId, linearIssueId });

    // Find the task by linearId
    const task = await this.prisma.task.findUnique({
      where: { linearId: linearIssueId },
    });

    if (!task) {
      logger.warn('Task not found for comment sync, skipping', { linearIssueId });
      return { commentId: '', action: 'skipped' };
    }

    // Get comment from Linear
    const client = await this.getLinearClient(projectId);
    const linearComment = await client.getComment(linearCommentId);

    if (!linearComment) {
      logger.warn('Comment not found in Linear', { linearCommentId });
      return { commentId: '', action: 'skipped' };
    }

    // Check if comment exists
    const existingComment = await this.prisma.taskComment.findUnique({
      where: { linearId: linearCommentId },
    });

    if (existingComment) {
      // Update existing comment
      await this.prisma.taskComment.update({
        where: { linearId: linearCommentId },
        data: {
          body: linearComment.body,
          linearUpdatedAt: new Date(linearComment.updatedAt),
        },
      });

      logger.info('Comment updated', { commentId: existingComment.id });
      return { commentId: existingComment.id, action: 'updated' };
    }

    // Create new comment
    const newComment = await this.prisma.taskComment.create({
      data: {
        taskId: task.id,
        linearId: linearCommentId,
        body: linearComment.body,
        authorId: linearComment.authorId,
        authorName: linearComment.authorName,
        authorEmail: linearComment.authorEmail,
        linearCreatedAt: new Date(linearComment.createdAt),
        linearUpdatedAt: new Date(linearComment.updatedAt),
      },
    });

    logger.info('Comment created', { commentId: newComment.id });
    return { commentId: newComment.id, action: 'created' };
  }

  /**
   * Sync all comments for an issue from Linear to database
   */
  async syncAllCommentsForIssue(
    projectId: string,
    linearIssueId: string,
  ): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: number;
  }> {
    logger.info('Syncing all comments for issue', { linearIssueId });

    // Find the task by linearId
    const task = await this.prisma.task.findUnique({
      where: { linearId: linearIssueId },
    });

    if (!task) {
      logger.warn('Task not found for comments sync', { linearIssueId });
      return { synced: 0, created: 0, updated: 0, errors: 0 };
    }

    // Get all comments from Linear
    const client = await this.getLinearClient(projectId);
    const linearComments = await client.getComments(linearIssueId);

    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const linearComment of linearComments) {
      try {
        const existingComment = await this.prisma.taskComment.findUnique({
          where: { linearId: linearComment.id },
        });

        if (existingComment) {
          // Update existing comment
          await this.prisma.taskComment.update({
            where: { linearId: linearComment.id },
            data: {
              body: linearComment.body,
              linearUpdatedAt: new Date(linearComment.updatedAt),
            },
          });
          updated++;
        } else {
          // Create new comment
          await this.prisma.taskComment.create({
            data: {
              taskId: task.id,
              linearId: linearComment.id,
              body: linearComment.body,
              authorId: linearComment.authorId,
              authorName: linearComment.authorName,
              authorEmail: linearComment.authorEmail,
              linearCreatedAt: new Date(linearComment.createdAt),
              linearUpdatedAt: new Date(linearComment.updatedAt),
            },
          });
          created++;
        }
        synced++;
      } catch (error) {
        logger.error('Failed to sync comment', error as Error, {
          linearCommentId: linearComment.id,
        });
        errors++;
      }
    }

    logger.info('Comments sync completed', { synced, created, updated, errors });
    return { synced, created, updated, errors };
  }

  /**
   * Create a comment in Linear from DevFlow
   */
  async createCommentInLinear(
    projectId: string,
    taskId: string,
    body: string,
  ): Promise<{ linearCommentId?: string; localCommentId?: string; error?: string }> {
    logger.info('Creating comment in Linear', { taskId });

    // Find the task
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    if (!task.linearId) {
      return { error: `Task ${taskId} has no Linear ID` };
    }

    try {
      // Create comment in Linear
      const client = await this.getLinearClient(projectId);
      await client.addComment(task.linearId, body);

      // Note: Linear's addComment doesn't return the comment ID directly
      // The comment will be synced back via webhook
      logger.info('Comment created in Linear', { linearIssueId: task.linearId });

      return { linearCommentId: 'pending-webhook-sync' };
    } catch (error) {
      logger.error('Failed to create comment in Linear', error as Error, { taskId });
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all comments for a task from database
   */
  async getTaskComments(taskId: string): Promise<any[]> {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { linearCreatedAt: 'asc' },
    });
  }

  // ============================================
  // PO Question Tracking
  // ============================================

  /**
   * Check if a comment is an answer to a DevFlow question
   * Returns true if the parent comment ID matches a TaskQuestion's linearCommentId
   */
  async checkIfAnswerToQuestion(
    parentCommentId: string,
    projectId: string,
  ): Promise<boolean> {
    logger.info('Checking if comment is answer to question', { parentCommentId });

    const question = await this.prisma.taskQuestion.findUnique({
      where: { linearCommentId: parentCommentId },
    });

    return !!question;
  }

  /**
   * Mark a question as answered
   * Updates the TaskQuestion with the answer text and comment ID
   */
  async markQuestionAnswered(
    questionCommentId: string,
    answerText: string,
    answerCommentId: string,
  ): Promise<{ taskId: string; questionId: string }> {
    logger.info('Marking question as answered', { questionCommentId, answerCommentId });

    const question = await this.prisma.taskQuestion.update({
      where: { linearCommentId: questionCommentId },
      data: {
        answered: true,
        answerText,
        answerCommentId,
        answeredAt: new Date(),
      },
    });

    logger.info('Question marked as answered', {
      questionId: question.id,
      taskId: question.taskId,
    });

    return { taskId: question.taskId, questionId: question.id };
  }

  /**
   * Check if all questions for a task have been answered
   * Returns true if all TaskQuestions for the task have answered=true
   */
  async checkAllQuestionsAnswered(linearIssueId: string): Promise<{
    allAnswered: boolean;
    total: number;
    answered: number;
    pending: number;
  }> {
    logger.info('Checking if all questions are answered', { linearIssueId });

    const task = await this.prisma.task.findFirst({
      where: { linearId: linearIssueId },
      include: { questions: true },
    });

    if (!task || task.questions.length === 0) {
      return { allAnswered: true, total: 0, answered: 0, pending: 0 };
    }

    const answered = task.questions.filter((q) => q.answered).length;
    const pending = task.questions.length - answered;
    const allAnswered = pending === 0;

    logger.info('Questions status', {
      linearIssueId,
      total: task.questions.length,
      answered,
      pending,
      allAnswered,
    });

    return {
      allAnswered,
      total: task.questions.length,
      answered,
      pending,
    };
  }

  /**
   * Reset awaiting PO answers flag and clear questions when all are answered
   * Called when re-running the workflow after all answers received
   */
  async clearAwaitingPOAnswers(linearIssueId: string): Promise<void> {
    logger.info('Clearing awaiting PO answers flag', { linearIssueId });

    const task = await this.prisma.task.findFirst({
      where: { linearId: linearIssueId },
    });

    if (task) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { awaitingPOAnswers: false },
      });
    }
  }

  /**
   * Get task ID from linear issue ID
   */
  async getTaskIdFromLinearId(linearIssueId: string): Promise<string | null> {
    const task = await this.prisma.task.findFirst({
      where: { linearId: linearIssueId },
    });
    return task?.id || null;
  }

  // ============================================
  // Mapping Helpers
  // ============================================

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

  // ============================================
  // Sub-Issue Cascade Operations
  // ============================================

  /**
   * Cascade status change to all children of an issue
   * When a parent issue is moved to a trigger status (e.g., "To User Story"),
   * all its children are also moved to that status (triggering their workflows in parallel)
   *
   * @returns Summary of cascade operation
   */
  async cascadeStatusToChildren(
    projectId: string,
    parentIssueId: string,
    targetStatus: string,
  ): Promise<{
    parentId: string;
    parentIdentifier?: string;
    childrenCount: number;
    cascaded: Array<{ id: string; identifier: string; success: boolean; error?: string }>;
    skipped: Array<{ id: string; identifier: string; reason: string }>;
  }> {
    logger.info('Cascading status to children', {
      projectId,
      parentIssueId,
      targetStatus,
    });

    const client = await this.getLinearClient(projectId);

    // Get children of the parent issue
    const children = await client.getIssueChildren(parentIssueId);

    if (children.length === 0) {
      logger.info('No children found, nothing to cascade', { parentIssueId });
      return {
        parentId: parentIssueId,
        childrenCount: 0,
        cascaded: [],
        skipped: [],
      };
    }

    // Filter children: only cascade to those not already at target status
    const childrenToUpdate: typeof children = [];
    const skipped: Array<{ id: string; identifier: string; reason: string }> = [];

    for (const child of children) {
      if (child.state?.name.toLowerCase() === targetStatus.toLowerCase()) {
        skipped.push({
          id: child.id,
          identifier: child.identifier,
          reason: `Already at "${targetStatus}"`,
        });
      } else {
        childrenToUpdate.push(child);
      }
    }

    if (childrenToUpdate.length === 0) {
      logger.info('All children already at target status', {
        parentIssueId,
        targetStatus,
        skippedCount: skipped.length,
      });
      return {
        parentId: parentIssueId,
        childrenCount: children.length,
        cascaded: [],
        skipped,
      };
    }

    // Update all children in parallel
    const results = await client.updateMultipleIssuesStatus(
      childrenToUpdate.map((c) => c.id),
      targetStatus,
    );

    // Map results back to include identifiers
    const cascaded = results.map((result, index) => ({
      id: result.issueId,
      identifier: childrenToUpdate[index].identifier,
      success: result.success,
      error: result.error,
    }));

    const successCount = cascaded.filter((r) => r.success).length;
    logger.info('Status cascaded to children', {
      parentIssueId,
      targetStatus,
      total: children.length,
      updated: successCount,
      skipped: skipped.length,
      failed: cascaded.length - successCount,
    });

    return {
      parentId: parentIssueId,
      childrenCount: children.length,
      cascaded,
      skipped,
    };
  }

  /**
   * Check if an issue has children (is a parent/epic)
   */
  async hasChildren(projectId: string, issueId: string): Promise<boolean> {
    const client = await this.getLinearClient(projectId);
    const children = await client.getIssueChildren(issueId);
    return children.length > 0;
  }

  // ============================================
  // Parent Status Rollup
  // ============================================

  /**
   * Calculate the minimum (least progressed) status among children
   * Returns the status name that the parent should have
   *
   * Uses centralized statusOrder from DEFAULT_WORKFLOW_CONFIG
   */
  async calculateParentStatusFromChildren(
    projectId: string,
    parentIssueId: string,
  ): Promise<{
    minimumStatus: string | null;
    childrenStatuses: Array<{ identifier: string; status: string; rank: number }>;
  }> {
    const client = await this.getLinearClient(projectId);
    const children = await client.getIssueChildren(parentIssueId);

    if (children.length === 0) {
      return { minimumStatus: null, childrenStatuses: [] };
    }

    // Get status rank for each child using centralized config
    const childrenStatuses = children.map((child) => ({
      identifier: child.identifier,
      status: child.state?.name || 'Unknown',
      rank: getStatusRank(child.state?.name || 'Unknown'),
    }));

    // Find minimum rank (least progress)
    const minRank = Math.min(...childrenStatuses.map((c) => c.rank));
    const minimumStatus = getStatusAtRank(minRank) || null;

    logger.info('Calculated parent status from children', {
      parentIssueId,
      childrenCount: children.length,
      minimumStatus,
      minRank,
      childrenStatuses,
    });

    return { minimumStatus, childrenStatuses };
  }

  /**
   * Update parent status based on children's minimum status (rollup)
   * Called when a child completes a workflow phase
   *
   * @returns Whether the parent status was updated
   */
  async rollupParentStatus(
    projectId: string,
    childIssueId: string,
  ): Promise<{
    updated: boolean;
    parentId?: string;
    parentIdentifier?: string;
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
  }> {
    logger.info('Rolling up parent status', { projectId, childIssueId });

    const client = await this.getLinearClient(projectId);

    // Get the child issue and its parent
    const childIssue = await client.getIssue(childIssueId);
    const parent = await childIssue.parent;

    if (!parent) {
      logger.debug('Child has no parent, skipping rollup', { childIssueId });
      return { updated: false, reason: 'No parent' };
    }

    const parentState = await parent.state;
    const previousStatus = parentState?.name || 'Unknown';

    // Calculate what status the parent should have
    const { minimumStatus, childrenStatuses } = await this.calculateParentStatusFromChildren(
      projectId,
      parent.id,
    );

    if (!minimumStatus) {
      return {
        updated: false,
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        reason: 'No children or could not calculate minimum status',
      };
    }

    // Check if parent already at the correct status
    if (previousStatus.toLowerCase() === minimumStatus.toLowerCase()) {
      logger.debug('Parent already at correct status', {
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        status: previousStatus,
      });
      return {
        updated: false,
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        previousStatus,
        reason: 'Already at correct status',
      };
    }

    // Update parent status
    try {
      await client.updateStatus(parent.id, minimumStatus);

      logger.info('Parent status rolled up', {
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        previousStatus,
        newStatus: minimumStatus,
        childrenStatuses,
      });

      return {
        updated: true,
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        previousStatus,
        newStatus: minimumStatus,
      };
    } catch (error) {
      logger.error('Failed to rollup parent status', error as Error, {
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        targetStatus: minimumStatus,
      });

      return {
        updated: false,
        parentId: parent.id,
        parentIdentifier: parent.identifier,
        previousStatus,
        reason: `Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
