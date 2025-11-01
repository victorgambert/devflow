/**
 * Projects Service - Refactored with Prisma
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
  private logger = createLogger('ProjectsService');

  constructor(private prisma: PrismaService) {}

  async findAll() {
    this.logger.info('Finding all projects');
    
    return this.prisma.project.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { tasks: true, workflows: true },
        },
      },
    });
  }

  async findOne(id: string) {
    this.logger.info('Finding project', { id });
    
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
        },
        workflows: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { tasks: true, workflows: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async create(dto: CreateProjectDto) {
    this.logger.info('Creating project', { name: dto.name });
    
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        repository: dto.repository,
        workspacePath: dto.workspacePath,
        config: dto.config,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    this.logger.info('Updating project', { id });
    
    // Check if project exists
    await this.findOne(id);

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        repository: dto.repository,
        workspacePath: dto.workspacePath,
        config: dto.config,
      },
    });
  }

  async remove(id: string) {
    this.logger.info('Removing project', { id });
    
    // Check if project exists
    await this.findOne(id);

    // Soft delete by setting isActive to false
    await this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get project statistics
   */
  async getStatistics(id: string) {
    this.logger.info('Getting project statistics', { id });

    const project = await this.findOne(id);

    const [taskStats, workflowStats] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: true,
      }),
      this.prisma.workflow.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: true,
      }),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
      },
      tasks: {
        total: project._count.tasks,
        byStatus: taskStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
      workflows: {
        total: project._count.workflows,
        byStatus: workflowStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
    };
  }
}
