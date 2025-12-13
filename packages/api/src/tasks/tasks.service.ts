/**
 * Tasks Service - Refactored with Prisma + Linear Integration
 * Bidirectional sync: DB ↔ Linear
 */

import { Injectable, NotFoundException, forwardRef, Inject, Optional } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateTaskDto, UpdateTaskDto } from '@/tasks/dto';
import { WorkflowsService } from '@/workflows/workflows.service';
import { LinearSyncApiService } from '@/linear/linear-sync-api.service';

@Injectable()
export class TasksService {
  private logger = createLogger('TasksService');

  /** Auto-sync Task updates to Linear */
  private autoSyncToLinear: boolean;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => WorkflowsService))
    private workflowsService: WorkflowsService,
    @Optional() private linearSyncService?: LinearSyncApiService,
  ) {
    // Enable auto-sync to Linear by default
    this.autoSyncToLinear = process.env.LINEAR_AUTO_SYNC_TO_LINEAR !== 'false';
    this.logger.info('TasksService initialized', {
      autoSyncToLinear: this.autoSyncToLinear,
      linearSyncServiceAvailable: !!this.linearSyncService,
    });
  }

  async findAll() {
    this.logger.info('Finding all tasks');
    
    return this.prisma.task.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    this.logger.info('Finding task', { id });
    
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        workflows: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        specs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }

  async create(dto: CreateTaskDto) {
    this.logger.info('Creating task', { title: dto.title });

    // Map priority to Prisma enum
    const priorityMap: Record<string, any> = {
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };

    return this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        linearId: dto.linearId,
        title: dto.title,
        description: dto.description,
        priority: priorityMap[dto.priority] || dto.priority,
        // assignee: dto.assignee,
      },
      include: {
        project: true,
      },
    });
  }

  async update(id: string, updates: UpdateTaskDto) {
    this.logger.info('Updating task', { id });

    // Get existing task to check for status changes
    const existingTask = await this.findOne(id);

    const updated = await this.prisma.task.update({
      where: { id },
      data: updates as any,
      include: {
        project: true,
      },
    });

    // Check if status changed to SPECIFICATION
    const statusChanged = updates.status && updates.status !== existingTask.status;
    const movedToSpecification = statusChanged && updates.status === 'SPECIFICATION';

    if (movedToSpecification) {
      this.logger.info('Task moved to SPECIFICATION status, triggering spec generation', {
        taskId: id,
        linearId: updated.linearId,
      });

      try {
        // Trigger spec generation workflow
        const workflowResult = await this.workflowsService.startSpecGeneration(
          updated.linearId || id,
          updated.projectId,
          'system',
        );

        this.logger.info('Spec generation workflow started', {
          taskId: id,
          workflowId: workflowResult.workflowId,
        });
      } catch (error) {
        this.logger.error('Failed to start spec generation workflow', error as Error, { id });
        // Don't fail the update if workflow start fails
      }
    }

    // Auto-sync back to Linear if task has linearId
    if (this.autoSyncToLinear && this.linearSyncService && updated.linearId) {
      try {
        this.logger.info('Auto-syncing task to Linear', {
          taskId: id,
          linearId: updated.linearId,
        });

        const syncResult = await this.linearSyncService.syncTaskToLinear(
          updated.projectId,
          id,
        );

        this.logger.info('Task synced to Linear', {
          taskId: id,
          linearId: updated.linearId,
          synced: syncResult.synced,
          errors: syncResult.errors,
        });
      } catch (error) {
        this.logger.error('Failed to sync task to Linear', error as Error, { id });
        // Don't fail the update if Linear sync fails
      }
    }

    return updated;
  }

  /**
   * Get tasks by project
   */
  async findByProject(projectId: string) {
    this.logger.info('Finding tasks by project', { projectId });
    
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get tasks by status
   */
  async findByStatus(status: string) {
    this.logger.info('Finding tasks by status', { status });
    
    return this.prisma.task.findMany({
      where: { status: status as any },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Get task statistics
   */
  async getStatistics(projectId?: string) {
    this.logger.info('Getting task statistics', { projectId });

    const where = projectId ? { projectId } : {};

    const [total, byStatus, byPriority] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriority.reduce((acc, stat) => {
        acc[stat.priority] = stat._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Sync tasks from Linear (manual trigger)
   * Note: Tasks are now auto-synced via webhooks, this is for manual sync
   */
  async syncFromLinear(projectId?: string, _status?: string) {
    if (!this.linearSyncService) {
      throw new Error('LinearSyncApiService not available');
    }

    if (!projectId) {
      projectId = process.env.DEFAULT_PROJECT_ID;
    }

    if (!projectId) {
      throw new Error('projectId is required (or set DEFAULT_PROJECT_ID)');
    }

    this.logger.info('Manual sync from Linear requested', { projectId });

    // Get all tasks with linearId for this project
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        linearId: { not: null },
      },
      select: {
        id: true,
        linearId: true,
      },
    });

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const task of tasks) {
      if (!task.linearId) continue;

      try {
        const result = await this.linearSyncService.syncIssueToDatabase(
          projectId,
          task.linearId,
        );

        synced++;
        if (result.action === 'updated') {
          updated++;
        }
      } catch (error) {
        this.logger.error('Failed to sync task from Linear', error as Error, {
          taskId: task.id,
          linearId: task.linearId,
        });
        errors++;
      }
    }

    this.logger.info('Manual sync completed', { synced, updated, errors });

    return {
      synced,
      updated,
      errors,
      total: tasks.length,
      message: 'Tasks are auto-synced via webhooks. This manual sync is for recovery purposes.',
    };
  }
}
