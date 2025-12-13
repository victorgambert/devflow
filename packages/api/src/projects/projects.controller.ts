/**
 * Projects Controller
 */

import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectsService } from '@/projects/projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  LinkRepositoryDto,
  UpdateIntegrationDto,
} from '@/projects/dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  @ApiResponse({ status: 200, description: 'List of projects' })
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get project statistics' })
  @ApiResponse({ status: 200, description: 'Project statistics' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getStatistics(@Param('id') id: string) {
    return this.projectsService.getStatistics(id);
  }

  @Post(':id/link-repository')
  @ApiOperation({ summary: 'Link a repository to a project' })
  @ApiResponse({ status: 200, description: 'Repository linked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid repository URL or cannot access repository' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async linkRepository(@Param('id') id: string, @Body() dto: LinkRepositoryDto) {
    return this.projectsService.linkRepository(id, dto.repositoryUrl);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete project' })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  // ============================================
  // Integration Configuration (Figma, Sentry, GitHub Issues)
  // ============================================

  @Get(':id/integrations')
  @ApiOperation({ summary: 'Get project integrations configuration' })
  @ApiResponse({ status: 200, description: 'Integration configuration' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getIntegrations(@Param('id') id: string) {
    return this.projectsService.getIntegrations(id);
  }

  @Put(':id/integrations')
  @ApiOperation({ summary: 'Update project integrations configuration' })
  @ApiResponse({ status: 200, description: 'Integration configuration updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateIntegrations(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.projectsService.updateIntegrations(id, dto);
  }

  // ============================================
  // Linear Custom Fields Setup
  // ============================================

  @Post(':id/linear/setup-custom-fields')
  @ApiOperation({ summary: 'Setup DevFlow custom fields in Linear workspace' })
  @ApiResponse({
    status: 200,
    description: 'Custom fields created/verified',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'array', items: { type: 'string' } },
        existing: { type: 'array', items: { type: 'string' } },
        fieldIds: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async setupLinearCustomFields(
    @Param('id') id: string,
    @Body() dto: { teamId: string },
  ) {
    return this.projectsService.setupLinearCustomFields(id, dto.teamId);
  }

  @Get(':id/linear/teams')
  @ApiOperation({ summary: 'Get Linear teams for the project' })
  @ApiResponse({ status: 200, description: 'List of Linear teams' })
  @ApiResponse({ status: 400, description: 'Linear OAuth not configured' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getLinearTeams(@Param('id') id: string) {
    return this.projectsService.getLinearTeams(id);
  }
}
