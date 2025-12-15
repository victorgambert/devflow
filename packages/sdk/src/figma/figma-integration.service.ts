import { ITokenResolver } from '../auth/token-resolver.interface';
import { createFigmaClient } from './figma.client';
import {
  FigmaDesignContext,
  FigmaFile,
  FigmaComment,
  FigmaImagesResponse,
  FigmaScreenshot,
} from './figma.types';

/**
 * Figma Integration Service
 *
 * Unified service that combines token resolution and Figma API calls.
 * This service is testable by injecting a mock ITokenResolver.
 *
 * Pattern: tokenResolver.getAccessToken() → createFigmaClient() → client.method()
 */
export class FigmaIntegrationService {
  constructor(private readonly tokenResolver: ITokenResolver) {}

  /**
   * Get full design context (file metadata, comments, optional screenshot)
   * This is the primary method used for context extraction in workflows.
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key from URL
   * @param nodeId - Optional specific node ID to screenshot
   */
  async getDesignContext(
    projectId: string,
    fileKey: string,
    nodeId?: string,
  ): Promise<FigmaDesignContext> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getDesignContext(fileKey, nodeId);
  }

  /**
   * Get file metadata only
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key from URL
   */
  async getFileMetadata(projectId: string, fileKey: string): Promise<FigmaFile> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getFileMetadata(fileKey);
  }

  /**
   * Get comments on a file
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   */
  async getFileComments(projectId: string, fileKey: string): Promise<FigmaComment[]> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getFileComments(fileKey);
  }

  /**
   * Get rendered images for specific nodes
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   * @param nodeIds - Array of node IDs to render
   * @param scale - Image scale (1-4, default 2)
   * @param format - Image format (png, jpg, svg, pdf)
   */
  async getNodeImages(
    projectId: string,
    fileKey: string,
    nodeIds: string[],
    scale: number = 2,
    format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
  ): Promise<FigmaImagesResponse> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getNodeImages(fileKey, nodeIds, scale, format);
  }

  /**
   * Get screenshot for a specific node
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   * @param nodeId - Node ID to screenshot
   * @param nodeName - Optional node name for context
   */
  async getScreenshot(
    projectId: string,
    fileKey: string,
    nodeId: string,
    nodeName?: string,
  ): Promise<FigmaScreenshot | null> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getScreenshot(fileKey, nodeId, nodeName);
  }

  /**
   * Get user info (for testing OAuth connection)
   * Uses /v1/me endpoint
   *
   * @param projectId - Project ID for token resolution
   */
  async getUserInfo(projectId: string): Promise<any> {
    const token = await this.tokenResolver.getAccessToken(projectId, 'FIGMA');
    const client = createFigmaClient(token);
    return await client.getUserInfo();
  }
}

/**
 * Factory function to create a FigmaIntegrationService
 * This allows for easy instantiation without 'new' keyword
 *
 * @param tokenResolver - Token resolver instance
 */
export function createFigmaIntegrationService(
  tokenResolver: ITokenResolver,
): FigmaIntegrationService {
  return new FigmaIntegrationService(tokenResolver);
}
