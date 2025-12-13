import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, OAuthConnection, OAuthProvider } from '@prisma/client';
import axios from 'axios';
import { OAUTH_CONSTANTS } from '@devflow/sdk';
import { TokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService } from '@/auth/services/token-storage.service';

interface DeviceFlowResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type?: string;
}

interface UserInfo {
  id: string;
  email: string | null;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly tokenStorage: TokenStorageService,
  ) {}

  /**
   * Initiate Device Flow OAuth
   * Step 1: Request device code from provider
   */
  async initiateDeviceFlow(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<DeviceFlowResponse> {
    this.logger.log(
      `Initiating Device Flow for ${provider} on project ${projectId}`,
    );

    // Device Flow is only supported for GitHub and GITHUB_ISSUES
    if (provider !== 'GITHUB' && provider !== 'GITHUB_ISSUES') {
      throw new Error(`Device Flow not supported for ${provider}`);
    }

    // Use the appropriate config (GITHUB_ISSUES uses same endpoints as GITHUB)
    const githubConfig = provider === 'GITHUB_ISSUES'
      ? OAUTH_CONSTANTS.GITHUB_ISSUES
      : OAUTH_CONSTANTS.GITHUB;

    try {
      const response = await axios.post(
        githubConfig.DEVICE_CODE_URL,
        new URLSearchParams({
          client_id: githubConfig.CLIENT_ID,
          scope: githubConfig.SCOPES.join(' '),
        }),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return {
        deviceCode: response.data.device_code,
        userCode: response.data.user_code,
        verificationUri: response.data.verification_uri,
        expiresIn: response.data.expires_in,
        interval: response.data.interval || 5,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate Device Flow for ${provider}`,
        error,
      );
      throw new Error(
        `Failed to initiate OAuth: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Poll for OAuth tokens
   * Step 2: Poll until user authorizes the device
   */
  async pollForTokens(
    deviceCode: string,
    provider: OAuthProvider,
    projectId: string,
  ): Promise<OAuthConnection> {
    this.logger.log(`Polling for tokens: ${provider} on project ${projectId}`);

    // Device Flow is only supported for GitHub and GITHUB_ISSUES
    if (provider !== 'GITHUB' && provider !== 'GITHUB_ISSUES') {
      throw new Error(`Device Flow polling not supported for ${provider}`);
    }

    // Use the appropriate config (GITHUB_ISSUES uses same endpoints as GITHUB)
    const githubConfig = provider === 'GITHUB_ISSUES'
      ? OAUTH_CONSTANTS.GITHUB_ISSUES
      : OAUTH_CONSTANTS.GITHUB;
    const maxAttempts = 60; // 5 minutes max (60 * 5s)
    const interval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      try {
        const response = await axios.post(
          githubConfig.TOKEN_URL,
          new URLSearchParams({
            client_id: githubConfig.CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );

        // Success! We got tokens
        this.logger.log(`Authorization successful for ${provider}`);
        return await this.storeOAuthConnection(
          projectId,
          provider,
          response.data,
        );
      } catch (error) {
        const errorCode = error.response?.data?.error;

        if (errorCode === 'authorization_pending') {
          // User hasn't authorized yet, continue polling
          this.logger.debug(`Still waiting for authorization (attempt ${i + 1}/${maxAttempts})`);
          continue;
        } else if (errorCode === 'slow_down') {
          // Provider asks us to slow down, wait extra 5 seconds
          this.logger.debug('Provider requested slow down');
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        } else if (errorCode === 'expired_token') {
          throw new Error('Device code expired. Please try again.');
        } else if (errorCode === 'access_denied') {
          throw new Error('User denied authorization.');
        } else {
          this.logger.error('Unexpected error during polling', error);
          throw new Error(
            `Authorization failed: ${error.response?.data?.error_description || error.message}`,
          );
        }
      }
    }

    throw new Error('Authorization timeout after 5 minutes.');
  }

  /**
   * Get OAuth application credentials from database
   */
  private async getOAuthApp(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    flowType: string;
  }> {
    const oauthApp = await this.prisma.oAuthApplication.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!oauthApp || !oauthApp.isActive) {
      throw new Error(
        `No active OAuth application configured for ${provider} on project ${projectId}. Please register your OAuth app first.`,
      );
    }

    // Decrypt client secret
    const clientSecret = this.tokenEncryption.decrypt(
      oauthApp.clientSecret,
      oauthApp.encryptionIv,
    );

    return {
      clientId: oauthApp.clientId,
      clientSecret,
      redirectUri: oauthApp.redirectUri,
      scopes: oauthApp.scopes,
      flowType: oauthApp.flowType,
    };
  }

  /**
   * Initiate Authorization Code Flow (for Linear, Sentry, Figma)
   * Returns authorization URL for user to visit
   */
  async initiateAuthorizationCodeFlow(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<{ authorizationUrl: string; state: string }> {
    this.logger.log(
      `Initiating Authorization Code Flow for ${provider} on project ${projectId}`,
    );

    const authCodeProviders = ['LINEAR', 'SENTRY', 'FIGMA'];
    if (!authCodeProviders.includes(provider)) {
      throw new Error(`Authorization Code Flow not supported for ${provider}`);
    }

    // Get OAuth app credentials from database
    const oauthApp = await this.getOAuthApp(projectId, provider);

    if (oauthApp.flowType !== 'authorization_code') {
      throw new Error(
        `OAuth app for ${provider} is configured for ${oauthApp.flowType}, not authorization_code`,
      );
    }

    // Get provider-specific config (only auth code providers have AUTHORIZE_URL)
    const config = OAUTH_CONSTANTS[provider] as {
      AUTHORIZE_URL: string;
      TOKEN_URL: string;
      USER_API_URL: string;
      SCOPES: readonly string[];
      FLOW_TYPE: 'authorization_code';
    };

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);

    // Build authorization URL with provider-specific parameters
    const params = new URLSearchParams({
      client_id: oauthApp.clientId,
      redirect_uri: oauthApp.redirectUri,
      state,
      response_type: 'code',
    });

    // Provider-specific scope separator and parameters
    if (provider === 'LINEAR') {
      params.set('scope', oauthApp.scopes.join(','));
      params.set('prompt', 'consent');
    } else if (provider === 'SENTRY') {
      params.set('scope', oauthApp.scopes.join(' '));
    } else if (provider === 'FIGMA') {
      params.set('scope', oauthApp.scopes.join(','));
    }

    const authorizationUrl = `${config.AUTHORIZE_URL}?${params.toString()}`;

    // Store state in Redis for validation (expires in 10 minutes)
    await this.tokenStorage.cacheState(projectId, provider, state, 600);

    this.logger.log(`Authorization URL generated for ${provider}`);

    return { authorizationUrl, state };
  }

  /**
   * Exchange authorization code for tokens (for Linear, Sentry, Figma)
   */
  async exchangeAuthorizationCode(
    projectId: string,
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<OAuthConnection> {
    this.logger.log(
      `Exchanging authorization code for ${provider} on project ${projectId}`,
    );

    const authCodeProviders = ['LINEAR', 'SENTRY', 'FIGMA'];
    if (!authCodeProviders.includes(provider)) {
      throw new Error(`Authorization Code Flow not supported for ${provider}`);
    }

    // Validate state to prevent CSRF attacks
    const cachedState = await this.tokenStorage.getState(projectId, provider);
    if (!cachedState || cachedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Clear state from cache
    await this.tokenStorage.clearState(projectId, provider);

    // Get OAuth app credentials from database
    const oauthApp = await this.getOAuthApp(projectId, provider);

    const config = OAUTH_CONSTANTS[provider];

    try {
      const response = await axios.post(
        config.TOKEN_URL,
        new URLSearchParams({
          client_id: oauthApp.clientId,
          client_secret: oauthApp.clientSecret,
          code,
          redirect_uri: oauthApp.redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokens: OAuthTokens = response.data;

      this.logger.log(`Authorization code exchanged successfully for ${provider}`);

      return await this.storeOAuthConnection(projectId, provider, tokens);
    } catch (error) {
      this.logger.error(
        `Failed to exchange authorization code for ${provider}`,
        error,
      );
      throw new Error(
        `Failed to exchange authorization code: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Store OAuth connection in database and cache
   */
  private async storeOAuthConnection(
    projectId: string,
    provider: OAuthProvider,
    tokens: OAuthTokens,
  ): Promise<OAuthConnection> {
    // Encrypt refresh token (if provided)
    let encryptedRefreshToken: string | undefined;
    let encryptionIv: string | undefined;

    if (tokens.refresh_token) {
      const encrypted = this.tokenEncryption.encrypt(tokens.refresh_token);
      encryptedRefreshToken = encrypted.ciphertext;
      encryptionIv = encrypted.iv;
    }

    // Get user info from provider
    const userInfo = await this.getUserInfo(provider, tokens.access_token);

    // Calculate expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Store in database
    const connection = await this.prisma.oAuthConnection.upsert({
      where: {
        projectId_provider: { projectId, provider },
      },
      create: {
        projectId,
        provider,
        refreshToken: encryptedRefreshToken || '',
        encryptionIv: encryptionIv || '',
        scopes: tokens.scope.split(' '),
        expiresAt,
        providerUserId: userInfo.id,
        providerEmail: userInfo.email,
        isActive: true,
        lastRefreshed: new Date(),
      },
      update: {
        refreshToken: encryptedRefreshToken || '',
        encryptionIv: encryptionIv || '',
        scopes: tokens.scope.split(' '),
        expiresAt,
        providerUserId: userInfo.id,
        providerEmail: userInfo.email,
        isActive: true,
        lastRefreshed: new Date(),
        refreshFailed: false,
        failureReason: null,
      },
    });

    // Cache access token in Redis
    if (tokens.expires_in) {
      await this.tokenStorage.cacheAccessToken(
        projectId,
        provider,
        tokens.access_token,
        tokens.expires_in,
      );
    }

    this.logger.log(
      `OAuth connection stored for ${provider} on project ${projectId}`,
    );

    return connection;
  }

  /**
   * Get user information from OAuth provider
   */
  private async getUserInfo(
    provider: OAuthProvider,
    accessToken: string,
  ): Promise<UserInfo> {
    try {
      if (provider === 'GITHUB' || provider === 'GITHUB_ISSUES') {
        const response = await axios.get('https://api.github.com/user', {
          headers: { Authorization: `token ${accessToken}` },
        });
        return {
          id: response.data.login,
          email: response.data.email || null,
        };
      } else if (provider === 'LINEAR') {
        const response = await axios.post(
          'https://api.linear.app/graphql',
          {
            query: '{ viewer { id email } }',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        return {
          id: response.data.data.viewer.id,
          email: response.data.data.viewer.email || null,
        };
      } else if (provider === 'SENTRY') {
        const response = await axios.get('https://sentry.io/api/0/users/me/', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return {
          id: response.data.id,
          email: response.data.email || null,
        };
      } else if (provider === 'FIGMA') {
        const response = await axios.get('https://api.figma.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return {
          id: response.data.id,
          email: response.data.email || null,
        };
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      this.logger.error(`Failed to get user info from ${provider}`, error);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(connection: OAuthConnection): Promise<string> {
    this.logger.log(
      `Refreshing token for ${connection.provider} on project ${connection.projectId}`,
    );

    if (!connection.refreshToken || !connection.encryptionIv) {
      throw new Error('No refresh token available for this connection');
    }

    // Decrypt refresh token
    const refreshToken = this.tokenEncryption.decrypt(
      connection.refreshToken,
      connection.encryptionIv,
    );

    // Get OAuth app credentials from database
    const oauthApp = await this.getOAuthApp(
      connection.projectId,
      connection.provider,
    );

    const config = OAUTH_CONSTANTS[connection.provider];

    try {
      // Build token refresh params
      const params: Record<string, string> = {
        client_id: oauthApp.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      };

      // Authorization Code Flow providers require client_secret for token refresh
      const authCodeProviders = ['LINEAR', 'SENTRY', 'FIGMA'];
      if (authCodeProviders.includes(connection.provider) && oauthApp.clientSecret) {
        params.client_secret = oauthApp.clientSecret;
      }

      const response = await axios.post(
        config.TOKEN_URL,
        new URLSearchParams(params),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokens: OAuthTokens = response.data;

      // Update database if refresh token rotated
      if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
        const encrypted = this.tokenEncryption.encrypt(tokens.refresh_token);
        await this.prisma.oAuthConnection.update({
          where: { id: connection.id },
          data: {
            refreshToken: encrypted.ciphertext,
            encryptionIv: encrypted.iv,
            lastRefreshed: new Date(),
            refreshFailed: false,
            failureReason: null,
          },
        });
      } else {
        await this.prisma.oAuthConnection.update({
          where: { id: connection.id },
          data: {
            lastRefreshed: new Date(),
            refreshFailed: false,
            failureReason: null,
          },
        });
      }

      // Cache new access token
      if (tokens.expires_in) {
        await this.tokenStorage.cacheAccessToken(
          connection.projectId,
          connection.provider,
          tokens.access_token,
          tokens.expires_in,
        );
      }

      this.logger.log(`Token refreshed successfully for ${connection.provider}`);

      return tokens.access_token;
    } catch (error) {
      this.logger.error(`Failed to refresh token for ${connection.provider}`, error);

      // Mark refresh as failed
      await this.prisma.oAuthConnection.update({
        where: { id: connection.id },
        data: {
          refreshFailed: true,
          failureReason: error.response?.data?.error_description || error.message,
        },
      });

      throw new Error(
        `Failed to refresh token: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Revoke OAuth connection
   */
  async revokeConnection(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<void> {
    this.logger.log(`Revoking ${provider} connection for project ${projectId}`);

    // Delete from database
    await this.prisma.oAuthConnection.delete({
      where: { projectId_provider: { projectId, provider } },
    });

    // Clear from Redis cache
    await this.tokenStorage.clearAccessToken(projectId, provider);

    this.logger.log(`OAuth connection revoked for ${provider}`);
  }

  /**
   * Get all connections for a project
   */
  async getConnections(projectId: string): Promise<OAuthConnection[]> {
    return await this.prisma.oAuthConnection.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get specific connection
   */
  async getConnection(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<OAuthConnection | null> {
    return await this.prisma.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });
  }

  /**
   * Register OAuth application for a project
   */
  async registerOAuthApp(
    projectId: string,
    provider: OAuthProvider,
    data: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scopes: string[];
      flowType: string;
      name?: string;
      description?: string;
    },
  ) {
    this.logger.log(
      `Registering OAuth app for ${provider} on project ${projectId}`,
    );

    // Encrypt client secret
    const encrypted = this.tokenEncryption.encrypt(data.clientSecret);

    // Upsert OAuth application
    const oauthApp = await this.prisma.oAuthApplication.upsert({
      where: { projectId_provider: { projectId, provider } },
      create: {
        projectId,
        provider,
        clientId: data.clientId,
        clientSecret: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        redirectUri: data.redirectUri,
        scopes: data.scopes,
        flowType: data.flowType,
        name: data.name,
        description: data.description,
        isActive: true,
      },
      update: {
        clientId: data.clientId,
        clientSecret: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        redirectUri: data.redirectUri,
        scopes: data.scopes,
        flowType: data.flowType,
        name: data.name,
        description: data.description,
        isActive: true,
      },
    });

    this.logger.log(
      `OAuth app registered successfully for ${provider} on project ${projectId}`,
    );

    return {
      id: oauthApp.id,
      projectId: oauthApp.projectId,
      provider: oauthApp.provider,
      clientId: oauthApp.clientId,
      redirectUri: oauthApp.redirectUri,
      scopes: oauthApp.scopes,
      flowType: oauthApp.flowType,
      name: oauthApp.name,
      description: oauthApp.description,
      isActive: oauthApp.isActive,
      createdAt: oauthApp.createdAt,
      updatedAt: oauthApp.updatedAt,
    };
  }

  /**
   * Get OAuth applications for a project
   */
  async getOAuthApps(projectId: string) {
    const apps = await this.prisma.oAuthApplication.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Return without sensitive data
    return apps.map((app) => ({
      id: app.id,
      projectId: app.projectId,
      provider: app.provider,
      clientId: app.clientId,
      redirectUri: app.redirectUri,
      scopes: app.scopes,
      flowType: app.flowType,
      name: app.name,
      description: app.description,
      isActive: app.isActive,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));
  }

  /**
   * Delete OAuth application
   */
  async deleteOAuthApp(projectId: string, provider: OAuthProvider) {
    this.logger.log(
      `Deleting OAuth app for ${provider} on project ${projectId}`,
    );

    // Delete the OAuth app
    await this.prisma.oAuthApplication.delete({
      where: { projectId_provider: { projectId, provider } },
    });

    // Also delete any OAuth connections for this provider
    try {
      await this.revokeConnection(projectId, provider);
    } catch (error) {
      // Connection might not exist, that's okay
      this.logger.debug(
        `No OAuth connection to revoke for ${provider} on project ${projectId}`,
      );
    }

    this.logger.log(
      `OAuth app deleted successfully for ${provider} on project ${projectId}`,
    );
  }
}
