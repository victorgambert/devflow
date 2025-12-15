import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, OAuthProvider } from '@prisma/client';
import { TokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService } from '@/auth/services/token-storage.service';
import { OAuthService } from '@/auth/services/oauth.service';

/**
 * Token Refresh Service
 * Handles automatic token refresh and caching
 */
@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly tokenStorage: TokenStorageService,
    private readonly oauthService: OAuthService,
  ) {}

  /**
   * Get access token, refreshing if needed
   * This is the main method workers should use
   *
   * Flow:
   * 1. Check Redis cache
   * 2. If cached and not expired, return cached token
   * 3. If not cached or expired, get from DB and refresh
   * 4. Cache refreshed token
   * 5. Return access token
   */
  async getAccessToken(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<string> {
    // Step 1: Try to get from cache
    const cached = await this.tokenStorage.getAccessToken(projectId, provider);
    if (cached) {
      this.logger.debug(
        `Using cached access token for ${provider} on project ${projectId}`,
      );
      return cached;
    }

    // Step 2: Not cached, need to refresh
    this.logger.log(
      `Access token not cached, refreshing for ${provider} on project ${projectId}`,
    );

    return await this.refreshIfNeeded(projectId, provider);
  }

  /**
   * Refresh token if needed
   * Checks if token needs refresh and refreshes it
   */
  async refreshIfNeeded(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<string> {
    // Get connection from database
    const connection = await this.prisma.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!connection) {
      throw new Error(
        `No OAuth connection found for project ${projectId} and provider ${provider}`,
      );
    }

    if (!connection.isActive) {
      throw new Error(
        `OAuth connection is inactive for project ${projectId} and provider ${provider}`,
      );
    }

    if (connection.refreshFailed) {
      throw new Error(
        `OAuth connection has failed refresh: ${connection.failureReason}`,
      );
    }

    // Check if we need to refresh
    const needsRefresh = await this.tokenStorage.needsRefresh(
      projectId,
      provider,
    );

    if (!needsRefresh) {
      // Token is still valid, try to get from cache
      const cached = await this.tokenStorage.getAccessToken(
        projectId,
        provider,
      );
      if (cached) {
        return cached;
      }
    }

    // Check if connection has refresh token
    // Some providers (like GitHub OAuth Apps) don't provide refresh tokens
    // In that case, tokens don't expire but we need to ask the user to reconnect
    if (!connection.refreshToken || !connection.encryptionIv) {
      this.logger.warn(
        `No refresh token for ${provider} on project ${projectId}. User needs to reconnect.`,
      );

      throw new Error(
        `No refresh token available. Please reconnect your ${provider} account.`,
      );
    }

    // Refresh the token
    this.logger.log(
      `Refreshing access token for ${provider} on project ${projectId}`,
    );

    try {
      const accessToken = await this.oauthService.refreshToken(connection);
      return accessToken;
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for ${provider} on project ${projectId}`,
        error,
      );
      throw new Error(
        `Failed to refresh OAuth token: ${error.message}`,
      );
    }
  }

  /**
   * Force refresh a token (ignoring cache)
   */
  async forceRefresh(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<string> {
    this.logger.log(
      `Force refreshing token for ${provider} on project ${projectId}`,
    );

    const connection = await this.prisma.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!connection) {
      throw new Error(
        `No OAuth connection found for project ${projectId} and provider ${provider}`,
      );
    }

    // Clear cache
    await this.tokenStorage.clearAccessToken(projectId, provider);

    // Refresh
    return await this.oauthService.refreshToken(connection);
  }

  /**
   * Check if a connection exists and is active
   */
  async hasActiveConnection(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<boolean> {
    const connection = await this.prisma.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    return connection !== null && connection.isActive && !connection.refreshFailed;
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<{
    exists: boolean;
    isActive: boolean;
    refreshFailed: boolean;
    failureReason: string | null;
    lastRefreshed: Date | null;
  }> {
    const connection = await this.prisma.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!connection) {
      return {
        exists: false,
        isActive: false,
        refreshFailed: false,
        failureReason: null,
        lastRefreshed: null,
      };
    }

    return {
      exists: true,
      isActive: connection.isActive,
      refreshFailed: connection.refreshFailed,
      failureReason: connection.failureReason,
      lastRefreshed: connection.lastRefreshed,
    };
  }
}
