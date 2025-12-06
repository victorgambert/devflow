/**
 * Webhooks Controller - Handle webhooks from VCS, CI, Linear
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

  @Post('linear')
  @ApiOperation({ summary: 'Linear webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleLinear(
    @Headers('linear-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.webhooksService.handleLinear(signature, payload);
  }
}

