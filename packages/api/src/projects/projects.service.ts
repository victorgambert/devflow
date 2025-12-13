/**
 * Projects Service - Refactored with Prisma
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createLogger, DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';
import {
  parseRepositoryUrl,
  GitHubProvider,
  createLinearClient,
  createLinearSetupService,
} from '@devflow/sdk';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { CreateProjectDto, UpdateProjectDto, UpdateIntegrationDto } from '@/projects/dto';

@Injectable()
export class ProjectsService {
  private logger = createLogger('ProjectsService');

  constructor(
    private prisma: PrismaService,
    private tokenRefresh: TokenRefreshService,
  ) {}

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

    // Initialize with DEFAULT_WORKFLOW_CONFIG if no config provided
    const config = dto.config || DEFAULT_WORKFLOW_CONFIG;

    this.logger.debug('Project config', {
      hasCustomConfig: !!dto.config,
      config
    });

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        repository: dto.repository,
        workspacePath: dto.workspacePath,
        config: config as any, // Cast to any for Prisma JSON type compatibility
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

      // Get GitHub token via OAuth
      let token: string;
      try {
        token = await this.tokenRefresh.getAccessToken(id, 'GITHUB');
      } catch (error) {
        this.logger.error('OAuth token not available', error as Error);
        throw new BadRequestException(
          'GitHub OAuth not configured for this project. Please connect GitHub via: POST /api/v1/auth/github/device/initiate'
        );
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
            `Cannot access repository ${repoInfo.owner}/${repoInfo.repo}. Check OAuth permissions.`
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

  // ============================================
  // Integration Configuration (Figma, Sentry, GitHub Issues)
  // ============================================

  /**
   * Get project integrations configuration
   */
  async getIntegrations(id: string) {
    this.logger.info('Getting project integrations', { id });

    // Check if project exists
    await this.findOne(id);

    const integration = await this.prisma.projectIntegration.findUnique({
      where: { projectId: id },
    });

    return integration || {
      projectId: id,
      figmaFileKey: null,
      figmaNodeId: null,
      sentryProjectSlug: null,
      sentryOrgSlug: null,
      githubIssuesRepo: null,
    };
  }

  /**
   * Update project integrations configuration
   */
  async updateIntegrations(id: string, dto: UpdateIntegrationDto) {
    this.logger.info('Updating project integrations', { id, dto });

    // Check if project exists
    await this.findOne(id);

    // Upsert the integration record
    const integration = await this.prisma.projectIntegration.upsert({
      where: { projectId: id },
      create: {
        projectId: id,
        figmaFileKey: dto.figmaFileKey,
        figmaNodeId: dto.figmaNodeId,
        sentryProjectSlug: dto.sentryProjectSlug,
        sentryOrgSlug: dto.sentryOrgSlug,
        githubIssuesRepo: dto.githubIssuesRepo,
      },
      update: {
        figmaFileKey: dto.figmaFileKey,
        figmaNodeId: dto.figmaNodeId,
        sentryProjectSlug: dto.sentryProjectSlug,
        sentryOrgSlug: dto.sentryOrgSlug,
        githubIssuesRepo: dto.githubIssuesRepo,
      },
    });

    this.logger.info('Project integrations updated', { id, integration });

    return integration;
  }

  // ============================================
  // Linear Custom Fields Setup
  // ============================================

  /**
   * Setup DevFlow custom fields in Linear workspace
   */
  async setupLinearCustomFields(projectId: string, teamId: string) {
    this.logger.info('Setting up Linear custom fields', { projectId, teamId });

    // Check if project exists
    await this.findOne(projectId);

    // Get Linear OAuth token
    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      this.logger.error('Linear OAuth token not available', error as Error);
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    // Create Linear client and setup service
    const linearClient = createLinearClient(token);
    const setupService = createLinearSetupService(linearClient);

    try {
      // Ensure custom fields exist (create if missing)
      const result = await setupService.ensureCustomFields(teamId);

      this.logger.info('Linear custom fields setup complete', {
        projectId,
        teamId,
        created: result.created,
        existing: result.existing,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to setup Linear custom fields', error as Error);
      throw new BadRequestException(
        `Failed to setup Linear custom fields: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get Linear teams for a project
   */
  async getLinearTeams(projectId: string) {
    this.logger.info('Getting Linear teams', { projectId });

    // Check if project exists
    await this.findOne(projectId);

    // Get Linear OAuth token
    let token: string;
    try {
      token = await this.tokenRefresh.getAccessToken(projectId, 'LINEAR');
    } catch (error) {
      this.logger.error('Linear OAuth token not available', error as Error);
      throw new BadRequestException(
        'Linear OAuth not configured for this project. Please connect Linear first.'
      );
    }

    // Create Linear client and get teams
    const linearClient = createLinearClient(token);

    try {
      const teams = await linearClient.getTeams();
      this.logger.info('Linear teams retrieved', { projectId, count: teams.length });
      return teams;
    } catch (error) {
      this.logger.error('Failed to get Linear teams', error as Error);
      throw new BadRequestException(
        `Failed to get Linear teams: ${(error as Error).message}`
      );
    }
  }
}
