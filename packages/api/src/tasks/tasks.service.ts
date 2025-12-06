/**
 * Tasks Service - Refactored with Prisma + Linear Integration
 */

import { Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { createLogger } from '@soma-squad-ai/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinearClient } from '@soma-squad-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class TasksService {
  private logger = createLogger('TasksService');
  private linearClient: LinearClient | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => WorkflowsService))
    private workflowsService: WorkflowsService,
  ) {
    // Initialize Linear client if configured
    const linearApiKey = this.config.get('LINEAR_API_KEY');

    if (linearApiKey) {
      this.linearClient = new LinearClient({
        apiKey: linearApiKey,
      });
      this.logger.info('Linear client initialized');
    } else {
      this.logger.warn('Linear not configured - sync features will be disabled');
    }
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

    return this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        linearId: dto.linearId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as any,
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

    // Sync back to Linear if task has linearId
    if (this.linearClient && updated.linearId) {
      try {
        await this.syncTaskToLinear(updated);
      } catch (error) {
        this.logger.error('Failed to sync task to Linear', error as Error, { id });
        // Don't fail the update if Linear sync fails
      }
    }

    return updated;
  }

  /**
   * Sync tasks from Linear to local database
   */
  async syncFromLinear(projectId?: string, status?: string) {
    if (!this.linearClient) {
      throw new Error('Linear not configured');
    }

    this.logger.info('Syncing tasks from Linear', { projectId, status });

    try {
      // Get tasks from Linear (optionally filtered by status)
      const linearTasks = status
        ? await this.linearClient.queryIssuesByStatus(status)
        : await this.linearClient.queryIssues({ first: 100 });

      this.logger.info('Retrieved tasks from Linear', { count: linearTasks.length });

      let synced = 0;
      let created = 0;
      let updated = 0;

      for (const linearTask of linearTasks) {
        try {
          // Check if task exists by linearId
          const existing = await this.prisma.task.findUnique({
            where: { linearId: linearTask.linearId },
          });

          const taskData = {
            title: linearTask.title,
            description: linearTask.description || '',
            status: this.mapLinearStatus(linearTask.status),
            priority: this.mapLinearPriority(linearTask.priority),
            assignee: linearTask.assignee,
            labels: linearTask.labels || [],
          };

          if (existing) {
            // Check if status changed to SPECIFICATION
            const statusChanged = taskData.status !== existing.status;
            const movedToSpecification = statusChanged && taskData.status === 'SPECIFICATION';

            // Update existing task
            await this.prisma.task.update({
              where: { id: existing.id },
              data: taskData,
            });
            updated++;

            // Trigger spec generation if moved to SPECIFICATION
            if (movedToSpecification) {
              this.logger.info('Task synced with SPECIFICATION status, triggering spec generation', {
                taskId: existing.id,
                linearId: linearTask.linearId,
              });

              try {
                await this.workflowsService.startSpecGeneration(
                  linearTask.linearId,
                  projectId || existing.projectId,
                  'system',
                );
              } catch (error) {
                this.logger.error('Failed to start spec generation workflow during sync', error as Error);
              }
            }
          } else if (projectId) {
            // Create new task
            await this.prisma.task.create({
              data: {
                ...taskData,
                projectId,
                linearId: linearTask.linearId,
              },
            });
            created++;
          }

          synced++;
        } catch (error) {
          this.logger.error('Failed to sync task', error as Error, {
            linearId: linearTask.linearId,
          });
        }
      }

      this.logger.info('Sync completed', { synced, created, updated });

      return {
        synced,
        created,
        updated,
        total: linearTasks.length,
      };
    } catch (error) {
      this.logger.error('Failed to sync from Linear', error as Error);
      throw error;
    }
  }

  /**
   * Sync a task to Linear
   */
  private async syncTaskToLinear(task: any) {
    if (!this.linearClient || !task.linearId) {
      return;
    }

    this.logger.info('Syncing task to Linear', { id: task.id, linearId: task.linearId });

    await this.linearClient.updateStatus(task.linearId, this.mapStatusToLinear(task.status));
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

  // Status mapping helpers
  private mapLinearStatus(linearStatus: string): any {
    const normalizedStatus = linearStatus.toLowerCase();

    if (normalizedStatus.includes('backlog') || normalizedStatus.includes('triage') || normalizedStatus.includes('todo')) {
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
    if (normalizedStatus.includes('done') || normalizedStatus.includes('complete') || normalizedStatus.includes('closed')) {
      return 'DONE';
    }
    if (normalizedStatus.includes('block') || normalizedStatus.includes('cancel')) {
      return 'BLOCKED';
    }
    return 'TODO';
  }

  private mapStatusToLinear(status: string): string {
    const statusMap: Record<string, string> = {
      TODO: 'Todo',
      SPECIFICATION: 'Spec Ready',
      IN_PROGRESS: 'In Progress',
      IN_REVIEW: 'In Review',
      TESTING: 'Testing',
      DONE: 'Done',
      BLOCKED: 'Blocked',
    };
    return statusMap[status] || 'Todo';
  }

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
