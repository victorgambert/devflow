import { ITokenResolver } from '../auth/token-resolver.interface';
import { createLinearClient, type LinearComment } from './linear.client';
import { type LinearTask, type LinearQueryOptions } from './linear.types';

/**
 * Linear Integration Service
 *
 * Unified service that combines token resolution and Linear API calls.
 * This service is testable by injecting a mock ITokenResolver.
 *
 * Pattern: tokenResolver.getAccessToken() → createLinearClient() → client.method()
 */
export class LinearIntegrationService {
  constructor(private readonly tokenResolver: ITokenResolver) {}

  /**
   * Get task by ID
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Linear issue ID
   */
  async getTask(projectId: string, issueId: string): Promise<LinearTask> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.getTask(issueId);
  }

  /**
   * Query issues with filters
   *
   * @param projectId - Project ID for token resolution
   * @param options - Query options (filters, pagination)
   */
  async queryIssues(
    projectId: string,
    options?: LinearQueryOptions,
  ): Promise<LinearTask[]> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.queryIssues(options);
  }

  /**
   * Query issues by status name
   *
   * @param projectId - Project ID for token resolution
   * @param statusName - Status name to filter by
   */
  async queryIssuesByStatus(
    projectId: string,
    statusName: string,
  ): Promise<LinearTask[]> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.queryIssuesByStatus(statusName);
  }

  /**
   * Update issue status
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Linear issue ID
   * @param statusName - New status name
   */
  async updateStatus(
    projectId: string,
    issueId: string,
    statusName: string,
  ): Promise<void> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.updateStatus(issueId, statusName);
  }

  /**
   * Add comment to an issue
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Linear issue ID
   * @param body - Comment body
   */
  async addComment(
    projectId: string,
    issueId: string,
    body: string,
  ): Promise<string> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.addComment(issueId, body);
  }

  /**
   * Get comments for an issue
   *
   * @param projectId - Project ID for token resolution
   * @param issueId - Linear issue ID
   */
  async getComments(
    projectId: string,
    issueId: string,
  ): Promise<LinearComment[]> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    return await client.getComments(issueId);
  }

  /**
   * Get user info (for testing OAuth connection)
   *
   * @param projectId - Project ID for token resolution
   */
  async getUserInfo(projectId: string): Promise<any> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'LINEAR');
    const client = createLinearClient(token);
    // LinearClient doesn't have getUserInfo yet, but we can add it or call directly
    throw new Error('getUserInfo not yet implemented in LinearClient');
  }
}

/**
 * Factory function to create a LinearIntegrationService
 *
 * @param tokenResolver - Token resolver instance
 */
export function createLinearIntegrationService(
  tokenResolver: ITokenResolver,
): LinearIntegrationService {
  return new LinearIntegrationService(tokenResolver);
}
