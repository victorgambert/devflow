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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { OAuthProvider } from '@prisma/client';
import { OAuthService } from '@/auth/services/oauth.service';

// Supported OAuth providers
const SUPPORTED_PROVIDERS = ['GITHUB', 'LINEAR', 'SENTRY', 'FIGMA', 'GITHUB_ISSUES'] as const;
const DEVICE_FLOW_PROVIDERS = ['GITHUB_ISSUES'] as const;
const AUTH_CODE_PROVIDERS = ['LINEAR', 'SENTRY', 'FIGMA', 'GITHUB'] as const;

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
   * GET /auth/linear/callback?code=xxx&state=xxx
   *
   * This endpoint receives the authorization code from Linear after user authorization
   * The projectId is retrieved from the state parameter via Redis
   */
  @Get('linear/callback')
  async linearCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.status(400).send(this.renderErrorPage('Missing code or state parameter'));
    }

    // Retrieve projectId from state (stored in Redis during authorization)
    const projectId = await this.oauthService.getProjectIdFromState(state, 'LINEAR');
    if (!projectId) {
      return res.status(400).send(this.renderErrorPage('Invalid or expired state parameter'));
    }

    this.logger.log(`Linear OAuth callback received for project ${projectId}`);

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'LINEAR',
        code,
        state,
      );

      return res.send(this.renderSuccessPage('Linear', connection.providerEmail));
    } catch (error) {
      this.logger.error(`Failed to complete Linear OAuth callback`, error);
      return res.status(400).send(this.renderErrorPage(error.message));
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
   * GET /auth/sentry/callback?code=xxx&state=xxx
   *
   * This endpoint receives the authorization code from Sentry after user authorization
   * The projectId is retrieved from the state parameter via Redis
   */
  @Get('sentry/callback')
  async sentryCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.status(400).send(this.renderErrorPage('Missing code or state parameter'));
    }

    // Retrieve projectId from state (stored in Redis during authorization)
    const projectId = await this.oauthService.getProjectIdFromState(state, 'SENTRY');
    if (!projectId) {
      return res.status(400).send(this.renderErrorPage('Invalid or expired state parameter'));
    }

    this.logger.log(`Sentry OAuth callback received for project ${projectId}`);

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'SENTRY',
        code,
        state,
      );

      return res.send(this.renderSuccessPage('Sentry', connection.providerEmail));
    } catch (error) {
      this.logger.error(`Failed to complete Sentry OAuth callback`, error);
      return res.status(400).send(this.renderErrorPage(error.message));
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
   * GET /auth/figma/callback?code=xxx&state=xxx
   *
   * This endpoint receives the authorization code from Figma after user authorization
   * The projectId is retrieved from the state parameter via Redis
   */
  @Get('figma/callback')
  async figmaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.status(400).send(this.renderErrorPage('Missing code or state parameter'));
    }

    // Retrieve projectId from state (stored in Redis during authorization)
    const projectId = await this.oauthService.getProjectIdFromState(state, 'FIGMA');
    if (!projectId) {
      return res.status(400).send(this.renderErrorPage('Invalid or expired state parameter'));
    }

    this.logger.log(`Figma OAuth callback received for project ${projectId}`);

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'FIGMA',
        code,
        state,
      );

      return res.send(this.renderSuccessPage('Figma', connection.providerEmail));
    } catch (error) {
      this.logger.error(`Failed to complete Figma OAuth callback`, error);
      return res.status(400).send(this.renderErrorPage(error.message));
    }
  }

  /**
   * Initiate GitHub OAuth Authorization Code Flow
   * POST /auth/github/authorize
   *
   * Body: { projectId: string }
   * Returns: { authorizationUrl: string }
   */
  @Post('github/authorize')
  @HttpCode(HttpStatus.OK)
  async initiateGitHubAuth(@Body('projectId') projectId: string) {
    this.logger.log(`Initiating GitHub OAuth for project ${projectId}`);

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    try {
      const result = await this.oauthService.initiateAuthorizationCodeFlow(
        projectId,
        'GITHUB',
      );

      return {
        authorizationUrl: result.authorizationUrl,
        message: 'Please visit the authorization URL in your browser',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate GitHub OAuth`, error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * GitHub OAuth callback
   * GET /auth/github/callback?code=xxx&state=xxx
   *
   * This endpoint receives the authorization code from GitHub after user authorization
   * The projectId is retrieved from the state parameter via Redis
   */
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.status(400).send(this.renderErrorPage('Missing code or state parameter'));
    }

    // Retrieve projectId from state (stored in Redis during authorization)
    const projectId = await this.oauthService.getProjectIdFromState(state, 'GITHUB');
    if (!projectId) {
      return res.status(400).send(this.renderErrorPage('Invalid or expired state parameter'));
    }

    this.logger.log(`GitHub OAuth callback received for project ${projectId}`);

    try {
      const connection = await this.oauthService.exchangeAuthorizationCode(
        projectId,
        'GITHUB',
        code,
        state,
      );

      return res.send(this.renderSuccessPage('GitHub', connection.providerEmail));
    } catch (error) {
      this.logger.error(`Failed to complete GitHub OAuth callback`, error);
      return res.status(400).send(this.renderErrorPage(error.message));
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

  /**
   * Render OAuth success page
   */
  private renderSuccessPage(provider: string, email: string | null): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OAuth Success - DevFlow</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #2d3748;
              margin: 0 0 0.5rem 0;
              font-size: 2rem;
            }
            p {
              color: #718096;
              margin: 0 0 2rem 0;
              font-size: 1.1rem;
            }
            .email {
              background: #f7fafc;
              padding: 0.75rem 1rem;
              border-radius: 0.5rem;
              color: #4a5568;
              font-family: 'Monaco', 'Courier New', monospace;
              margin: 1rem 0;
            }
            .footer {
              margin-top: 2rem;
              color: #a0aec0;
              font-size: 0.9rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>${provider} Connected!</h1>
            <p>Your OAuth connection has been established successfully.</p>
            ${email ? `<div class="email">${email}</div>` : ''}
            <div class="footer">
              You can close this window and return to your terminal.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Render OAuth error page
   */
  private renderErrorPage(error: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OAuth Error - DevFlow</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
              max-width: 500px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #2d3748;
              margin: 0 0 0.5rem 0;
              font-size: 2rem;
            }
            p {
              color: #718096;
              margin: 0 0 2rem 0;
              font-size: 1.1rem;
            }
            .error {
              background: #fff5f5;
              border: 1px solid #fc8181;
              padding: 1rem;
              border-radius: 0.5rem;
              color: #c53030;
              margin: 1rem 0;
            }
            .footer {
              margin-top: 2rem;
              color: #a0aec0;
              font-size: 0.9rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Connection Failed</h1>
            <p>We encountered an error while connecting your OAuth account.</p>
            <div class="error">${error}</div>
            <div class="footer">
              Please try again or contact support if the issue persists.
            </div>
          </div>
        </body>
      </html>
    `;
  }

}
