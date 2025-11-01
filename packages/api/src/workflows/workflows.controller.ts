/**
 * Workflows Controller
 */

import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { StartWorkflowDto } from './dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow started' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async start(@Body() dto: StartWorkflowDto) {
    return this.workflowsService.start(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow status' })
  @ApiResponse({ status: 200, description: 'Workflow status' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getStatus(@Param('id') id: string) {
    return this.workflowsService.getStatus(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow cancelled' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async cancel(@Param('id') id: string) {
    return this.workflowsService.cancel(id);
  }
}

