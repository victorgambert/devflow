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
   * Get file metadata
   * @param fileKey - Figma file key from URL
   */
  async getFileMetadata(fileKey: string): Promise<FigmaFile> {
    const response = await this.client.get<FigmaFile>(`/files/${fileKey}`, {
      params: {
        depth: 1, // Only get top-level nodes
      },
    });
    return response.data;
  }

  /**
   * Get comments on a file
   * @param fileKey - Figma file key
   */
  async getFileComments(fileKey: string): Promise<FigmaComment[]> {
    const response = await this.client.get<{ comments: FigmaComment[] }>(
      `/files/${fileKey}/comments`,
    );
    return response.data.comments;
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
    // Only fetch screenshot if nodeId is provided
    if (!nodeId) {
      return null;
    }

    try {
      // Get image URL from Figma
      const imagesResponse = await this.getNodeImages(fileKey, [nodeId]);

      if (imagesResponse.err || !imagesResponse.images[nodeId]) {
        console.warn(`Failed to get image for node ${nodeId}: ${imagesResponse.err}`);
        return null;
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
      console.warn(`Failed to get screenshot for node ${nodeId}:`, error);
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
