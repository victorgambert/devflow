/**
 * Webhooks Controller - Handle webhooks from VCS, CI, Notion
 */

import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @ApiOperation({ summary: 'GitHub webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleGitHub(@Headers('x-github-event') event: string, @Body() payload: any) {
    return this.webhooksService.handleGitHub(event, payload);
  }

  @Post('gitlab')
  @ApiOperation({ summary: 'GitLab webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleGitLab(@Headers('x-gitlab-event') event: string, @Body() payload: any) {
    return this.webhooksService.handleGitLab(event, payload);
  }

  @Post('notion')
  @ApiOperation({ summary: 'Notion webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleNotion(@Body() payload: any) {
    return this.webhooksService.handleNotion(payload);
  }
}

