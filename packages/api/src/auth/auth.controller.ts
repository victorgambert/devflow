import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { OAuthService } from '@/auth/services/oauth.service';

// Supported OAuth providers
const SUPPORTED_PROVIDERS = ['GITHUB', 'LINEAR', 'SENTRY', 'FIGMA', 'GITHUB_ISSUES'] as const;
const DEVICE_FLOW_PROVIDERS = ['GITHUB', 'GITHUB_ISSUES'] as const;
const AUTH_CODE_PROVIDERS = ['LINEAR', 'SENTRY', 'FIGMA'] as const;

/**
 * Auth Controller
 * Handles OAuth Device Flow and Authorization Code Flow endpoints
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Initiate Device Flow OAuth
   * POST /auth/:provider/device/initiate
   *
   * Body: { projectId: string }
   * Returns: { deviceCode, userCode, verificationUri, expiresIn, interval }
   */
  @Post(':provider/device/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateDeviceFlow(
    @Param('provider') provider: string,
    @Body('projectId') projectId: string,
  ) {
    this.logger.log(`Initiating Device Flow for ${provider} on project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!DEVICE_FLOW_PROVIDERS.includes(upperProvider as typeof DEVICE_FLOW_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider for Device Flow. Supported: ${DEVICE_FLOW_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    try {
      const result = await this.oauthService.initiateDeviceFlow(
        projectId,
        upperProvider,
      );

      return {
        deviceCode: result.deviceCode,
        userCode: result.userCode,
        verificationUri: result.verificationUri,
        expiresIn: result.expiresIn,
        interval: result.interval,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate Device Flow`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Poll for OAuth tokens
   * POST /auth/:provider/device/poll
   *
   * Body: { deviceCode: string, projectId: string }
   * Returns: OAuthConnection (sanitized)
   */
  @Post(':provider/device/poll')
  @HttpCode(HttpStatus.OK)
  async pollForTokens(
    @Param('provider') provider: string,
    @Body('deviceCode') deviceCode: string,
    @Body('projectId') projectId: string,
  ) {
    this.logger.log(`Polling for tokens: ${provider} on project ${projectId}`);

    if (!deviceCode || !projectId) {
      throw new BadRequestException('deviceCode and projectId are required');
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!DEVICE_FLOW_PROVIDERS.includes(upperProvider as typeof DEVICE_FLOW_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider for Device Flow. Supported: ${DEVICE_FLOW_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    try {
      const connection = await this.oauthService.pollForTokens(
        deviceCode,
        upperProvider,
        projectId,
      );

      // Return sanitized connection (no sensitive data)
      return {
        id: connection.id,
        projectId: connection.projectId,
        provider: connection.provider,
        scopes: connection.scopes,
        providerUserId: connection.providerUserId,
        providerEmail: connection.providerEmail,
        isActive: connection.isActive,
        lastRefreshed: connection.lastRefreshed,
        createdAt: connection.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to poll for tokens`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Initiate Linear OAuth Authorization Code Flow
   * POST /auth/linear/authorize
   *
   * Body: { projectId: string }
   * Returns: { authorizationUrl: string }
   */
  @Post('linear/authorize')
  @HttpCode(HttpStatus.OK)
  async initiateLinearAuth(@Body('projectId') projectId: string) {
    this.logger.log(`Initiating Linear OAuth for project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    try {
      const result = await this.oauthService.initiateAuthorizationCodeFlow(
        projectId,
        'LINEAR',
      );

      return {
        authorizationUrl: result.authorizationUrl,
        message: 'Please visit the authorization URL in your browser',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate Linear OAuth`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Linear OAuth callback
   * GET /auth/linear/callback?code=xxx&state=xxx&project=projectId
   *
   * This endpoint receives the authorization code from Linear after user authorization
   */
  @Get('linear/callback')
  async linearCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('project') projectId: string,
  ) {
    this.logger.log(`Linear OAuth callback received for project ${projectId}`);

    if (!code || !state || !projectId) {
      throw new BadRequestException('code, state, and project are required');
    }

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'LINEAR',
        code,
        state,
      );

      // Return success HTML page or redirect
      return {
        success: true,
        message: 'Linear OAuth connection established successfully!',
        connection: {
          id: connection.id,
          projectId: connection.projectId,
          provider: connection.provider,
          scopes: connection.scopes,
          providerUserId: connection.providerUserId,
          providerEmail: connection.providerEmail,
          isActive: connection.isActive,
          createdAt: connection.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to complete Linear OAuth callback`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Initiate Sentry OAuth Authorization Code Flow
   * POST /auth/sentry/authorize
   *
   * Body: { projectId: string }
   * Returns: { authorizationUrl: string }
   */
  @Post('sentry/authorize')
  @HttpCode(HttpStatus.OK)
  async initiateSentryAuth(@Body('projectId') projectId: string) {
    this.logger.log(`Initiating Sentry OAuth for project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    try {
      const result = await this.oauthService.initiateAuthorizationCodeFlow(
        projectId,
        'SENTRY',
      );

      return {
        authorizationUrl: result.authorizationUrl,
        message: 'Please visit the authorization URL in your browser',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate Sentry OAuth`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Sentry OAuth callback
   * GET /auth/sentry/callback?code=xxx&state=xxx&project=projectId
   *
   * This endpoint receives the authorization code from Sentry after user authorization
   */
  @Get('sentry/callback')
  async sentryCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('project') projectId: string,
  ) {
    this.logger.log(`Sentry OAuth callback received for project ${projectId}`);

    if (!code || !state || !projectId) {
      throw new BadRequestException('code, state, and project are required');
    }

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'SENTRY',
        code,
        state,
      );

      return {
        success: true,
        message: 'Sentry OAuth connection established successfully!',
        connection: {
          id: connection.id,
          projectId: connection.projectId,
          provider: connection.provider,
          scopes: connection.scopes,
          providerUserId: connection.providerUserId,
          providerEmail: connection.providerEmail,
          isActive: connection.isActive,
          createdAt: connection.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to complete Sentry OAuth callback`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Initiate Figma OAuth Authorization Code Flow
   * POST /auth/figma/authorize
   *
   * Body: { projectId: string }
   * Returns: { authorizationUrl: string }
   */
  @Post('figma/authorize')
  @HttpCode(HttpStatus.OK)
  async initiateFigmaAuth(@Body('projectId') projectId: string) {
    this.logger.log(`Initiating Figma OAuth for project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    try {
      const result = await this.oauthService.initiateAuthorizationCodeFlow(
        projectId,
        'FIGMA',
      );

      return {
        authorizationUrl: result.authorizationUrl,
        message: 'Please visit the authorization URL in your browser',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate Figma OAuth`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Figma OAuth callback
   * GET /auth/figma/callback?code=xxx&state=xxx&project=projectId
   *
   * This endpoint receives the authorization code from Figma after user authorization
   */
  @Get('figma/callback')
  async figmaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('project') projectId: string,
  ) {
    this.logger.log(`Figma OAuth callback received for project ${projectId}`);

    if (!code || !state || !projectId) {
      throw new BadRequestException('code, state, and project are required');
    }

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'FIGMA',
        code,
        state,
      );

      return {
        success: true,
        message: 'Figma OAuth connection established successfully!',
        connection: {
          id: connection.id,
          projectId: connection.projectId,
          provider: connection.provider,
          scopes: connection.scopes,
          providerUserId: connection.providerUserId,
          providerEmail: connection.providerEmail,
          isActive: connection.isActive,
          createdAt: connection.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to complete Figma OAuth callback`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get OAuth connections for a project
   * GET /auth/connections?project={projectId}
   *
   * Returns: OAuthConnection[] (sanitized)
   */
  @Get('connections')
  async getConnections(@Query('project') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('project query parameter is required');
    }

    const connections = await this.oauthService.getConnections(projectId);

    // Return sanitized connections (no sensitive data)
    return {
      connections: connections.map((conn) => ({
        id: conn.id,
        projectId: conn.projectId,
        provider: conn.provider,
        scopes: conn.scopes,
        providerUserId: conn.providerUserId,
        providerEmail: conn.providerEmail,
        isActive: conn.isActive,
        refreshFailed: conn.refreshFailed,
        failureReason: conn.failureReason,
        lastRefreshed: conn.lastRefreshed,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      })),
    };
  }

  /**
   * Disconnect OAuth provider
   * POST /auth/:provider/disconnect
   *
   * Body: { projectId: string }
   */
  @Post(':provider/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Param('provider') provider: string,
    @Body('projectId') projectId: string,
  ) {
    this.logger.log(`Disconnecting ${provider} for project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!SUPPORTED_PROVIDERS.includes(upperProvider as typeof SUPPORTED_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    try {
      await this.oauthService.revokeConnection(projectId, upperProvider);
      return { message: 'OAuth connection revoked successfully' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('OAuth connection not found');
      }
      this.logger.error(`Failed to disconnect`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Force refresh OAuth token
   * POST /auth/:provider/refresh
   *
   * Body: { projectId: string }
   */
  @Post(':provider/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Param('provider') provider: string,
    @Body('projectId') projectId: string,
  ) {
    this.logger.log(`Forcing token refresh for ${provider} on project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!SUPPORTED_PROVIDERS.includes(upperProvider as typeof SUPPORTED_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    try {
      const connection = await this.oauthService.getConnection(
        projectId,
        upperProvider,
      );

      if (!connection) {
        throw new NotFoundException('OAuth connection not found');
      }

      await this.oauthService.refreshToken(connection);

      return { message: 'Token refreshed successfully' };
    } catch (error) {
      this.logger.error(`Failed to refresh token`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Register OAuth application for a project
   * POST /auth/apps/register
   *
   * Body: { projectId, provider, clientId, clientSecret, redirectUri, scopes, flowType, name?, description? }
   */
  @Post('apps/register')
  @HttpCode(HttpStatus.OK)
  async registerOAuthApp(
    @Body('projectId') projectId: string,
    @Body('provider') provider: string,
    @Body('clientId') clientId: string,
    @Body('clientSecret') clientSecret: string,
    @Body('redirectUri') redirectUri: string,
    @Body('scopes') scopes: string[],
    @Body('flowType') flowType: string,
    @Body('name') name?: string,
    @Body('description') description?: string,
  ) {
    this.logger.log(
      `Registering OAuth app for ${provider} on project ${projectId}`,
    );

    if (
      !projectId ||
      !provider ||
      !clientId ||
      !clientSecret ||
      !redirectUri ||
      !scopes ||
      !flowType
    ) {
      throw new BadRequestException(
        'projectId, provider, clientId, clientSecret, redirectUri, scopes, and flowType are required',
      );
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!SUPPORTED_PROVIDERS.includes(upperProvider as typeof SUPPORTED_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    if (!['device', 'authorization_code'].includes(flowType)) {
      throw new BadRequestException(
        'Invalid flowType. Supported: device, authorization_code',
      );
    }

    try {
      const app = await this.oauthService.registerOAuthApp(
        projectId,
        upperProvider,
        {
          clientId,
          clientSecret,
          redirectUri,
          scopes,
          flowType,
          name,
          description,
        },
      );

      return {
        message: 'OAuth application registered successfully',
        app,
      };
    } catch (error) {
      this.logger.error(`Failed to register OAuth app`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get OAuth applications for a project
   * GET /auth/apps?project={projectId}
   */
  @Get('apps')
  async getOAuthApps(@Query('project') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('project query parameter is required');
    }

    try {
      const apps = await this.oauthService.getOAuthApps(projectId);
      return { apps };
    } catch (error) {
      this.logger.error(`Failed to get OAuth apps`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Delete OAuth application
   * DELETE /auth/apps/:provider?project={projectId}
   */
  @Post('apps/:provider/delete')
  @HttpCode(HttpStatus.OK)
  async deleteOAuthApp(
    @Param('provider') provider: string,
    @Body('projectId') projectId: string,
  ) {
    this.logger.log(
      `Deleting OAuth app for ${provider} on project ${projectId}`,
    );

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    const upperProvider = provider.toUpperCase() as OAuthProvider;
    if (!SUPPORTED_PROVIDERS.includes(upperProvider as typeof SUPPORTED_PROVIDERS[number])) {
      throw new BadRequestException(
        `Invalid provider. Supported: ${SUPPORTED_PROVIDERS.join(', ').toLowerCase()}`,
      );
    }

    try {
      await this.oauthService.deleteOAuthApp(projectId, upperProvider);
      return { message: 'OAuth application deleted successfully' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('OAuth application not found');
      }
      this.logger.error(`Failed to delete OAuth app`, error);
      throw new BadRequestException(error.message);
    }
  }
}
