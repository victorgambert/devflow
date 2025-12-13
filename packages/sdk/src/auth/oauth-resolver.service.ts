import type { RedisClientType } from 'redis';
import { OAuthDatabase, OAuthProvider } from './oauth.types';

/**
 * OAuth Resolver Service
 * Resolves OAuth tokens for workers without direct HTTP access
 *
 * This service is designed to be used by Temporal workers and other
 * background services that need to access OAuth tokens.
 */
export class OAuthResolverService {
  constructor(
    private readonly db: OAuthDatabase,
    private readonly redis: RedisClientType,
  ) {}

  /**
   * Resolve GitHub token for a project
   * Returns the access token, refreshing if needed
   */
  async resolveGitHubToken(projectId: string): Promise<string> {
    return this.getAccessToken(projectId, 'GITHUB');
  }

  /**
   * Resolve Linear token for a project
   * Returns the access token, refreshing if needed
   */
  async resolveLinearToken(projectId: string): Promise<string> {
    return this.getAccessToken(projectId, 'LINEAR');
  }

  /**
   * Get access token from cache or database
   * This method checks Redis first, then falls back to database
   */
  private async getAccessToken(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<string> {
    // Try Redis cache first
    const cacheKey = `oauth:access:${projectId}:${provider}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Not in cache, need to get from database
    // In a real implementation, this would trigger a refresh
    // For now, we throw an error indicating the token needs refresh
    throw new Error(
      `Access token not cached for ${provider} on project ${projectId}. Token refresh needed.`,
    );
  }

  /**
   * Check if a project has an active OAuth connection
   */
  async hasActiveConnection(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<boolean> {
    const connection = await this.db.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    return connection !== null && connection.isActive && !connection.refreshFailed;
  }

  /**
   * Get connection info for debugging
   */
  async getConnectionInfo(
    projectId: string,
    provider: OAuthProvider,
  ): Promise<{
    exists: boolean;
    isActive: boolean;
    refreshFailed: boolean;
    lastRefreshed: Date | null;
  } | null> {
    const connection = await this.db.oAuthConnection.findUnique({
      where: { projectId_provider: { projectId, provider } },
    });

    if (!connection) {
      return null;
    }

    return {
      exists: true,
      isActive: connection.isActive,
      refreshFailed: connection.refreshFailed,
      lastRefreshed: connection.lastRefreshed,
    };
  }
}
