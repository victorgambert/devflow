/**
 * Projects Service - Refactored with Prisma
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createLogger } from '@soma-squad-ai/common';
import { parseRepositoryUrl, GitHubProvider, createVCSDriver } from '@soma-squad-ai/sdk';
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

  /**
   * Link a GitHub repository to a project
   */
  async linkRepository(id: string, repositoryUrl: string) {
    this.logger.info('Linking repository to project', { id, repositoryUrl });

    // Check if project exists
    const project = await this.findOne(id);

    try {
      // Parse repository URL to extract owner, repo, and provider
      const repoInfo = parseRepositoryUrl(repositoryUrl);
      this.logger.info('Repository info extracted', repoInfo);

      // Get GitHub token
      const token = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
      if (!token) {
        throw new BadRequestException('GitHub token not configured (GITHUB_TOKEN or GITHUB_APP_TOKEN)');
      }

      // Test repository access
      if (repoInfo.provider === 'github') {
        const github = new GitHubProvider(token);
        try {
          await github.getRepository(repoInfo.owner, repoInfo.repo);
          this.logger.info('Repository access verified', { owner: repoInfo.owner, repo: repoInfo.repo });
        } catch (error) {
          this.logger.error('Cannot access repository', error as Error);
          throw new BadRequestException(
            `Cannot access repository ${repoInfo.owner}/${repoInfo.repo}. Check token permissions.`
          );
        }
      }

      // Update project with repository information
      const config = (project.config as any) || {};

      return this.prisma.project.update({
        where: { id },
        data: {
          repository: repositoryUrl,
          config: {
            ...config,
            vcs: {
              ...config.vcs,
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              provider: repoInfo.provider,
            },
            project: {
              ...config.project,
              owner: repoInfo.owner,
              repo: repoInfo.repo,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to link repository', error as Error);
      throw new BadRequestException(`Invalid repository URL or cannot access repository: ${(error as Error).message}`);
    }
  }
}
