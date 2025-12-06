/**
 * Tasks Controller
 */

import { Controller, Get, Post, Param, Body, Query, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List all tasks' })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    if (projectId) {
      return this.tasksService.findByProject(projectId);
    }
    if (status) {
      return this.tasksService.findByStatus(status);
    }
    return this.tasksService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Task statistics' })
  @ApiQuery({ name: 'projectId', required: false })
  async getStatistics(@Query('projectId') projectId?: string) {
    return this.tasksService.getStatistics(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update task' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(@Param('id') id: string, @Body() updateTaskDto: Partial<CreateTaskDto>) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Post('sync/linear')
  @ApiOperation({ summary: 'Sync tasks from Linear' })
  @ApiResponse({ status: 200, description: 'Tasks synced' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by Linear status' })
  async syncFromLinear(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.tasksService.syncFromLinear(projectId, status);
  }
}
