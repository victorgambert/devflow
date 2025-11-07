/**
 * Tasks Service - Refactored with Prisma + Notion Integration
 */

import { Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { createLogger } from '@soma-squad-ai/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotionClient } from '@soma-squad-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class TasksService {
  private logger = createLogger('TasksService');
  private notionClient: NotionClient | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => WorkflowsService))
    private workflowsService: WorkflowsService,
  ) {
    // Initialize Notion client if configured
    const notionApiKey = this.config.get('NOTION_API_KEY');
    const notionDatabaseId = this.config.get('NOTION_DATABASE_ID');

    if (notionApiKey && notionDatabaseId) {
      this.notionClient = new NotionClient({
        apiKey: notionApiKey,
        databaseId: notionDatabaseId,
      });
      this.logger.info('Notion client initialized');
    } else {
      this.logger.warn('Notion not configured - sync features will be disabled');
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
        notionId: dto.notionId,
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
        notionId: updated.notionId,
      });

      try {
        // Trigger spec generation workflow
        const workflowResult = await this.workflowsService.startSpecGeneration(
          updated.notionId || id,
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

    // Sync back to Notion if task has notionId
    if (this.notionClient && updated.notionId) {
      try {
        await this.syncTaskToNotion(updated);
      } catch (error) {
        this.logger.error('Failed to sync task to Notion', error as Error, { id });
        // Don't fail the update if Notion sync fails
      }
    }

    return updated;
  }

  /**
   * Sync tasks from Notion to local database
   */
  async syncFromNotion(projectId?: string) {
    if (!this.notionClient) {
      throw new Error('Notion not configured');
    }

    this.logger.info('Syncing tasks from Notion', { projectId });

    try {
      // Get recent tasks from Notion (last 24 hours)
      const notionTasks = await this.notionClient.getRecentlyUpdatedTasks(24);
      
      this.logger.info('Retrieved tasks from Notion', { count: notionTasks.length });

      let synced = 0;
      let created = 0;
      let updated = 0;

      for (const notionTask of notionTasks) {
        try {
          // Check if task exists by notionId
          const existing = await this.prisma.task.findUnique({
            where: { notionId: notionTask.id },
          });

          const taskData = {
            title: notionTask.title,
            description: notionTask.description || '',
            status: this.mapNotionStatus(notionTask.status),
            priority: this.mapNotionPriority(notionTask.priority),
            assignee: notionTask.assignee,
            epic: notionTask.epic,
            storyPoints: notionTask.storyPoints,
            labels: notionTask.labels || [],
            metadata: notionTask.properties,
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
                notionId: notionTask.id,
              });

              try {
                await this.workflowsService.startSpecGeneration(
                  notionTask.id,
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
                notionId: notionTask.id,
              },
            });
            created++;
          }

          synced++;
        } catch (error) {
          this.logger.error('Failed to sync task', error as Error, {
            notionId: notionTask.id,
          });
        }
      }

      this.logger.info('Sync completed', { synced, created, updated });

      return {
        synced,
        created,
        updated,
        total: notionTasks.length,
      };
    } catch (error) {
      this.logger.error('Failed to sync from Notion', error as Error);
      throw error;
    }
  }

  /**
   * Sync a task to Notion
   */
  private async syncTaskToNotion(task: any) {
    if (!this.notionClient || !task.notionId) {
      return;
    }

    this.logger.info('Syncing task to Notion', { id: task.id, notionId: task.notionId });

    await this.notionClient.updateTask(task.notionId, {
      id: task.notionId,
      title: task.title,
      description: task.description,
      status: this.mapStatusToNotion(task.status),
      priority: this.mapPriorityToNotion(task.priority),
      assignee: task.assignee,
      epic: task.epic,
      storyPoints: task.storyPoints,
      labels: task.labels,
      url: '',
      createdTime: '',
      lastEditedTime: '',
      properties: {},
    });
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
  private mapNotionStatus(notionStatus: string): any {
    const statusMap: Record<string, string> = {
      'To Do': 'TODO',
      'Specification': 'SPECIFICATION',
      'In Progress': 'IN_PROGRESS',
      'In Review': 'IN_REVIEW',
      'Testing': 'TESTING',
      'Done': 'DONE',
      'Blocked': 'BLOCKED',
    };
    return statusMap[notionStatus] || 'TODO';
  }

  private mapStatusToNotion(status: string): string {
    const statusMap: Record<string, string> = {
      TODO: 'To Do',
      SPECIFICATION: 'Specification',
      IN_PROGRESS: 'In Progress',
      IN_REVIEW: 'In Review',
      TESTING: 'Testing',
      DONE: 'Done',
      BLOCKED: 'Blocked',
    };
    return statusMap[status] || 'To Do';
  }

  private mapNotionPriority(notionPriority: string): any {
    const priorityMap: Record<string, string> = {
      Low: 'LOW',
      Medium: 'MEDIUM',
      High: 'HIGH',
      Critical: 'CRITICAL',
    };
    return priorityMap[notionPriority] || 'MEDIUM';
  }

  private mapPriorityToNotion(priority: string): string {
    const priorityMap: Record<string, string> = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
      CRITICAL: 'Critical',
    };
    return priorityMap[priority] || 'Medium';
  }
}
