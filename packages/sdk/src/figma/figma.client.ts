/**
 * Figma API Client
 *
 * Provides methods to fetch file metadata, comments, and screenshots from Figma.
 * Used to extract design context for the refinement workflow.
 */

import axios, { AxiosInstance } from 'axios';
import {
  FigmaFile,
  FigmaComment,
  FigmaScreenshot,
  FigmaDesignContext,
  FigmaImagesResponse,
  FigmaUser,
} from './figma.types';

export class FigmaClient {
  private readonly client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Validate Figma file key format
   * Expected: 20-30 alphanumeric characters with dashes/underscores
   * Example: TfJw2zsGB11mbievCt5c3n
   */
  private validateFileKey(fileKey: string): void {
    if (!fileKey || typeof fileKey !== 'string') {
      throw new Error('Figma file key is required');
    }

    if (!/^[a-zA-Z0-9_-]{20,30}$/.test(fileKey)) {
      throw new Error(
        `Invalid Figma file key format: "${fileKey}". ` +
        `Expected 20-30 alphanumeric characters (with - or _). ` +
        `Example: TfJw2zsGB11mbievCt5c3n. ` +
        `Find your file key in the URL: figma.com/file/<FILE_KEY>/...`
      );
    }
  }

  /**
   * Handle Axios errors with user-friendly messages
   */
  private handleApiError(error: unknown, method: string, context?: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;

      if (status === 404) {
        throw new Error(
          `Figma ${context || 'resource'} not found. ` +
          `Check that the ${context || 'resource'} is correct and you have access.`
        );
      } else if (status === 401 || status === 403) {
        throw new Error(
          `Figma authentication failed (${status}). ` +
          `OAuth token may be expired or invalid. ` +
          `Reconnect via: devflow oauth:connect <project-id> figma`
        );
      } else if (status === 429) {
        throw new Error(
          `Figma API rate limit exceeded. Try again in a few minutes.`
        );
      }

      throw new Error(
        `Figma API error ${status}: ${statusText} (method: ${method})`
      );
    }
    throw error;
  }

  /**
   * Get current user information
   * Uses /v1/me endpoint for testing OAuth connection
   */
  async getUserInfo(): Promise<FigmaUser> {
    try {
      const response = await this.client.get<FigmaUser>('/me');
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getUserInfo', 'user');
    }
  }

  /**
   * Get file metadata
   * @param fileKey - Figma file key from URL
   */
  async getFileMetadata(fileKey: string): Promise<FigmaFile> {
    this.validateFileKey(fileKey);

    try {
      const response = await this.client.get<FigmaFile>(`/files/${fileKey}`, {
        params: {
          depth: 1, // Only get top-level nodes
        },
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getFileMetadata', `file ${fileKey}`);
    }
  }

  /**
   * Get comments on a file
   * @param fileKey - Figma file key
   */
  async getFileComments(fileKey: string): Promise<FigmaComment[]> {
    this.validateFileKey(fileKey);

    try {
      const response = await this.client.get<{ comments: FigmaComment[] }>(
        `/files/${fileKey}/comments`,
      );
      return response.data.comments;
    } catch (error) {
      this.handleApiError(error, 'getFileComments', `file ${fileKey} comments`);
    }
  }

  /**
   * Get rendered images for specific nodes
   * @param fileKey - Figma file key
   * @param nodeIds - Array of node IDs to render
   * @param scale - Image scale (1-4, default 2)
   * @param format - Image format (png, jpg, svg, pdf)
   */
  async getNodeImages(
    fileKey: string,
    nodeIds: string[],
    scale: number = 2,
    format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
  ): Promise<FigmaImagesResponse> {
    this.validateFileKey(fileKey);

    try {
      const response = await this.client.get<FigmaImagesResponse>(
        `/images/${fileKey}`,
        {
          params: {
            ids: nodeIds.join(','),
            scale,
            format,
          },
        },
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getNodeImages', `images for nodes ${nodeIds.join(', ')}`);
    }
  }

  /**
   * Download image from URL and convert to base64
   * @param imageUrl - Figma image URL (temporary, expires in ~14 days)
   */
  async downloadImageAsBase64(imageUrl: string): Promise<string> {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return base64;
  }

  /**
   * Get screenshot for a specific node
   * Only fetches screenshot if nodeId is provided
   * @param fileKey - Figma file key
   * @param nodeId - Optional node ID to screenshot
   * @param nodeName - Optional node name for context
   */
  async getScreenshot(
    fileKey: string,
    nodeId?: string,
    nodeName?: string,
  ): Promise<FigmaScreenshot | null> {
    this.validateFileKey(fileKey);

    // Only fetch screenshot if nodeId is provided
    if (!nodeId) {
      return null;
    }

    try {
      // Get image URL from Figma
      const imagesResponse = await this.getNodeImages(fileKey, [nodeId]);

      if (imagesResponse.err || !imagesResponse.images[nodeId]) {
        throw new Error(`Failed to get image for node ${nodeId}: ${imagesResponse.err || 'Node not found'}`);
      }

      const imageUrl = imagesResponse.images[nodeId];

      // Download and convert to base64
      const imageBase64 = await this.downloadImageAsBase64(imageUrl);

      return {
        nodeId,
        nodeName: nodeName || nodeId,
        imageUrl,
        imageBase64,
      };
    } catch (error) {
      // Log warning but don't throw - screenshot is optional
      if (error instanceof Error) {
        console.warn(`Failed to get screenshot for node ${nodeId}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get full design context for refinement
   * Combines file metadata, comments, and optional screenshot
   * @param fileKey - Figma file key
   * @param nodeId - Optional specific node ID to screenshot
   */
  async getDesignContext(
    fileKey: string,
    nodeId?: string,
  ): Promise<FigmaDesignContext> {
    this.validateFileKey(fileKey);

    // Fetch file metadata and comments in parallel
    const [file, comments] = await Promise.all([
      this.getFileMetadata(fileKey),
      this.getFileComments(fileKey),
    ]);

    const context: FigmaDesignContext = {
      fileKey,
      fileName: file.name,
      lastModified: file.lastModified,
      thumbnailUrl: file.thumbnailUrl,
      comments: comments
        .filter((c) => !c.resolved_at) // Only unresolved comments
        .slice(0, 10), // Limit to 10 most recent
      screenshots: [],
    };

    // Only get screenshot if nodeId is provided
    if (nodeId) {
      // Find node name from file document if available
      let nodeName: string | undefined;
      if (file.document?.children) {
        const findNode = (nodes: typeof file.document.children, id: string): string | undefined => {
          for (const node of nodes) {
            if (node.id === id) return node.name;
            if (node.children) {
              const found = findNode(node.children, id);
              if (found) return found;
            }
          }
          return undefined;
        };
        nodeName = findNode(file.document.children, nodeId);
      }

      const screenshot = await this.getScreenshot(fileKey, nodeId, nodeName);
      if (screenshot) {
        context.screenshots.push(screenshot);
      }
    }

    return context;
  }
}

/**
 * Create a Figma client instance
 */
export function createFigmaClient(accessToken: string): FigmaClient {
  return new FigmaClient(accessToken);
}
