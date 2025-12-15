import { Controller, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { IntegrationsTestService } from './integrations-test.service';

/**
 * Integrations Controller
 *
 * Provides endpoints to test integration connections and context extraction
 */
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsTestService: IntegrationsTestService,
  ) {}

  /**
   * Test a specific provider integration
   *
   * POST /integrations/test/:provider
   * Body: { projectId: string }
   */
  @Post('test/:provider')
  async testProvider(
    @Param('provider') provider: string,
    @Body('projectId') projectId: string,
  ) {
    if (!projectId) {
      throw new HttpException('projectId is required', HttpStatus.BAD_REQUEST);
    }

    const providerUpper = provider.toUpperCase() as 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY';

    switch (providerUpper) {
      case 'GITHUB':
        return await this.integrationsTestService.testGitHub(projectId);
      case 'LINEAR':
        return await this.integrationsTestService.testLinear(projectId);
      case 'FIGMA':
        return await this.integrationsTestService.testFigma(projectId);
      case 'SENTRY':
        return await this.integrationsTestService.testSentry(projectId);
      default:
        throw new HttpException(
          `Unknown provider: ${provider}. Supported: github, linear, figma, sentry`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }
}
