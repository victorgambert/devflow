import { Injectable, Inject } from '@nestjs/common';
import type { RedisClientType } from 'redis';

/**
 * Token Storage Service
 * Manages access token caching in Redis
 *
 * Redis keys:
 * - oauth:access:{projectId}:{provider} → "gho_token_value"
 * - oauth:expires:{projectId}:{provider} → "1702123456789"
 */
@Injectable()
export class TokenStorageService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClientType) {}

  /**
   * Cache an access token in Redis with TTL
   * @param projectId Project identifier
   * @param provider OAuth provider (GITHUB or LINEAR)
   * @param token Access token to cache
   * @param expiresIn Expiration time in seconds
   */
  async cacheAccessToken(
    projectId: string,
    provider: string,
    token: string,
    expiresIn: number,
  ): Promise<void> {
    const key = `oauth:access:${projectId}:${provider}`;
    const expiresKey = `oauth:expires:${projectId}:${provider}`;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Store token with TTL (5 minutes buffer before actual expiration)
    const ttl = Math.max(expiresIn - 300, 60); // At least 60s TTL

    await Promise.all([
      this.redis.set(key, token, { EX: ttl }),
      this.redis.set(expiresKey, expiresAt.toString(), { EX: ttl }),
    ]);
  }

  /**
   * Get cached access token from Redis
   * @param projectId Project identifier
   * @param provider OAuth provider
   * @returns Access token or null if not cached
   */
  async getAccessToken(
    projectId: string,
    provider: string,
  ): Promise<string | null> {
    const key = `oauth:access:${projectId}:${provider}`;
    return await this.redis.get(key);
  }

  /**
   * Get token expiration timestamp
   * @param projectId Project identifier
   * @param provider OAuth provider
   * @returns Expiration timestamp or null
   */
  async getTokenExpiration(
    projectId: string,
    provider: string,
  ): Promise<number | null> {
    const key = `oauth:expires:${projectId}:${provider}`;
    const expiresAt = await this.redis.get(key);
    return expiresAt ? parseInt(expiresAt, 10) : null;
  }

  /**
   * Clear cached access token
   * @param projectId Project identifier
   * @param provider OAuth provider
   */
  async clearAccessToken(
    projectId: string,
    provider: string,
  ): Promise<void> {
    const key = `oauth:access:${projectId}:${provider}`;
    const expiresKey = `oauth:expires:${projectId}:${provider}`;

    await Promise.all([this.redis.del(key), this.redis.del(expiresKey)]);
  }

  /**
   * Check if token is expired or close to expiring (within 5 minutes)
   * @param projectId Project identifier
   * @param provider OAuth provider
   * @returns true if token needs refresh
   */
  async needsRefresh(projectId: string, provider: string): Promise<boolean> {
    const expiresAt = await this.getTokenExpiration(projectId, provider);
    if (!expiresAt) return true;

    // Refresh if expires within 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() + fiveMinutes >= expiresAt;
  }

  /**
   * Cache OAuth state parameter for CSRF protection (Authorization Code Flow)
   * @param projectId Project identifier
   * @param provider OAuth provider
   * @param state Random state string
   * @param ttl Time to live in seconds (default 600s = 10 minutes)
   */
  async cacheState(
    projectId: string,
    provider: string,
    state: string,
    ttl: number = 600,
  ): Promise<void> {
    const key = `oauth:state:${projectId}:${provider}`;
    await this.redis.set(key, state, { EX: ttl });
  }

  /**
   * Get cached OAuth state parameter
   * @param projectId Project identifier
   * @param provider OAuth provider
   * @returns State string or null if not found
   */
  async getState(projectId: string, provider: string): Promise<string | null> {
    const key = `oauth:state:${projectId}:${provider}`;
    return await this.redis.get(key);
  }

  /**
   * Clear cached OAuth state parameter
   * @param projectId Project identifier
   * @param provider OAuth provider
   */
  async clearState(projectId: string, provider: string): Promise<void> {
    const key = `oauth:state:${projectId}:${provider}`;
    await this.redis.del(key);
  }

  /**
   * Cache state-to-projectId mapping for OAuth callback routing
   * @param state Random state string
   * @param provider OAuth provider
   * @param projectId Project identifier
   * @param ttl Time to live in seconds (default 600s = 10 minutes)
   */
  async cacheStateMapping(
    state: string,
    provider: string,
    projectId: string,
    ttl: number = 600,
  ): Promise<void> {
    const key = `oauth:state-map:${state}:${provider}`;
    await this.redis.set(key, projectId, { EX: ttl });
  }

  /**
   * Get projectId from state parameter (for OAuth callback routing)
   * @param state State string from OAuth callback
   * @param provider OAuth provider
   * @returns Project ID or null if not found
   */
  async getProjectIdFromState(
    state: string,
    provider: string,
  ): Promise<string | null> {
    const key = `oauth:state-map:${state}:${provider}`;
    return await this.redis.get(key);
  }

  /**
   * Clear state-to-projectId mapping
   * @param state State string
   * @param provider OAuth provider
   */
  async clearStateMapping(state: string, provider: string): Promise<void> {
    const key = `oauth:state-map:${state}:${provider}`;
    await this.redis.del(key);
  }
}
