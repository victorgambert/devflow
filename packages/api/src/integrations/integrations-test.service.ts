import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import {
  GitHubIntegrationService,
  LinearIntegrationService,
  FigmaIntegrationService,
  SentryIntegrationService,
} from '@devflow/sdk';

/**
 * Integrations Test Service
 *
 * Provides methods to test integration connections and basic functionality
 */
@Injectable()
export class IntegrationsTestService {
  private githubService: GitHubIntegrationService;
  private linearService: LinearIntegrationService;
  private figmaService: FigmaIntegrationService;
  private sentryService: SentryIntegrationService;

  constructor(private readonly tokenRefresh: TokenRefreshService) {
    // Initialize integration services with TokenRefreshService as resolver
    this.githubService = new GitHubIntegrationService(tokenRefresh);
    this.linearService = new LinearIntegrationService(tokenRefresh);
    this.figmaService = new FigmaIntegrationService(tokenRefresh);
    this.sentryService = new SentryIntegrationService(tokenRefresh);
  }

  /**
   * Test GitHub integration
   * Attempts to fetch authenticated user's repositories
   */
  async testGitHub(projectId: string) {
    try {
      // Check connection status first
      const status = await this.tokenRefresh.getConnectionStatus(projectId, 'GITHUB');

      if (!status.exists) {
        throw new HttpException(
          'No OAuth connection found for GitHub',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!status.isActive || status.refreshFailed) {
        throw new HttpException(
          `GitHub connection is inactive: ${status.failureReason || 'Unknown reason'}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Test basic API call - get a known public repository
      const testRepo = await this.githubService.getRepository(
        projectId,
        'facebook',
        'react',
      );

      return {
        provider: 'GITHUB',
        status: 'connected',
        testResult: 'Successfully fetched repository information',
        details: {
          testRepo: testRepo.fullName,
          defaultBranch: testRepo.defaultBranch,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'GitHub integration test failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Linear integration
   * Attempts to query issues
   */
  async testLinear(projectId: string) {
    try {
      // Check connection status first
      const status = await this.tokenRefresh.getConnectionStatus(projectId, 'LINEAR');

      if (!status.exists) {
        throw new HttpException(
          'No OAuth connection found for Linear',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!status.isActive || status.refreshFailed) {
        throw new HttpException(
          `Linear connection is inactive: ${status.failureReason || 'Unknown reason'}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Test basic API call - query recent issues
      const issues = await this.linearService.queryIssues(projectId, {
        first: 5,
      });

      return {
        provider: 'LINEAR',
        status: 'connected',
        testResult: 'Successfully queried Linear issues',
        details: {
          issuesFound: issues.length,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Linear integration test failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Figma integration
   * Checks connection status (Figma requires file key to test fully)
   */
  async testFigma(projectId: string) {
    try {
      // Check connection status
      const status = await this.tokenRefresh.getConnectionStatus(projectId, 'FIGMA');

      if (!status.exists) {
        throw new HttpException(
          'No OAuth connection found for Figma',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!status.isActive || status.refreshFailed) {
        throw new HttpException(
          `Figma connection is inactive: ${status.failureReason || 'Unknown reason'}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // For Figma, we can only verify token is valid without a file key
      // Try to get access token (this will fail if token refresh fails)
      await this.tokenRefresh.getAccessToken(projectId, 'FIGMA');

      return {
        provider: 'FIGMA',
        status: 'connected',
        testResult: 'OAuth token is valid',
        details: {
          note: 'Full test requires Figma file key. Configure with: devflow integrations:configure',
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Figma integration test failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Sentry integration
   * Checks connection status (Sentry requires issue ID to test fully)
   */
  async testSentry(projectId: string) {
    try {
      // Check connection status
      const status = await this.tokenRefresh.getConnectionStatus(projectId, 'SENTRY');

      if (!status.exists) {
        throw new HttpException(
          'No OAuth connection found for Sentry',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!status.isActive || status.refreshFailed) {
        throw new HttpException(
          `Sentry connection is inactive: ${status.failureReason || 'Unknown reason'}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // For Sentry, we can only verify token is valid without an issue ID
      // Try to get access token (this will fail if token refresh fails)
      await this.tokenRefresh.getAccessToken(projectId, 'SENTRY');

      return {
        provider: 'SENTRY',
        status: 'connected',
        testResult: 'OAuth token is valid',
        details: {
          note: 'Full test requires Sentry issue ID',
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Sentry integration test failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
