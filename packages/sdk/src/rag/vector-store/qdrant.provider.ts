/**
 * Qdrant Vector Store Provider
 * Manages vector storage and retrieval using Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createLogger } from '@devflow/common';
import { metricsCollector } from '../metrics/metrics-collector';

const logger = createLogger('QdrantProvider');

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

export interface QdrantConfig {
  host: string;
  port: number;
  collectionName: string;
  apiKey?: string;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchFilter {
  must?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
  should?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
  must_not?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
}

export class QdrantVectorStore {
  private client: QdrantClient;
  private collectionName: string;

  constructor(config: QdrantConfig) {
    this.client = new QdrantClient({
      url: `http://${config.host}:${config.port}`,
      apiKey: config.apiKey,
      // @ts-ignore - checkCompatibility is not in types but supported by runtime
      checkCompatibility: false, // Allow minor version differences
    });
    this.collectionName = config.collectionName;

    logger.info('Qdrant Vector Store initialized', {
      host: config.host,
      port: config.port,
      collection: this.collectionName,
    });
  }

  /**
   * Ensure collection exists, create if not
   */
  async ensureCollection(dimensions: number): Promise<void> {
    try {
      await this.client.getCollection(this.collectionName);
      logger.info('Collection exists', { collection: this.collectionName });
    } catch {
      logger.info('Creating collection', {
        collection: this.collectionName,
        dimensions,
      });

      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: dimensions,
          distance: 'Cosine',
        },
        optimizers_config: {
          indexing_threshold: 10000,
        },
      });

      logger.info('Collection created successfully', {
        collection: this.collectionName,
      });
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      await this.client.getCollection(this.collectionName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      logger.error('Failed to get collection info', error as Error, {
        collection: this.collectionName,
      });
      throw error;
    }
  }

  /**
   * Upsert vectors (insert or update)
   */
  async upsertVectors(points: VectorPoint[]): Promise<void> {
    const startTime = Date.now();

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      const latency = Date.now() - startTime;

      // Record metrics
      metricsCollector.recordVectorStoreOperation(
        this.collectionName,
        'upsert',
        latency,
        { vectorCount: points.length }
      );

      logger.debug('Vectors upserted', {
        collection: this.collectionName,
        count: points.length,
        latency,
      });
    } catch (error) {
      logger.error('Failed to upsert vectors', error as Error, {
        collection: this.collectionName,
        pointsCount: points.length,
      });
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    vector: number[],
    limit: number,
    filter?: SearchFilter,
    scoreThreshold?: number,
  ): Promise<VectorSearchResult[]> {
    const startTime = Date.now();

    try {
      const results = await this.client.search(this.collectionName, {
        vector,
        limit,
        filter,
        with_payload: true,
        score_threshold: scoreThreshold,
      });

      const latency = Date.now() - startTime;

      // Record metrics
      metricsCollector.recordVectorStoreOperation(
        this.collectionName,
        'search',
        latency,
        { resultsCount: results.length }
      );

      logger.debug('Vector search completed', {
        collection: this.collectionName,
        resultsCount: results.length,
        limit,
        latency,
      });

      return results.map((r) => ({
        id: r.id as string,
        score: r.score,
        payload: r.payload as Record<string, any>,
      }));
    } catch (error) {
      logger.error('Failed to search vectors', error as Error, {
        collection: this.collectionName,
        limit,
      });
      throw error;
    }
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(filter: SearchFilter): Promise<void> {
    const startTime = Date.now();

    try {
      await this.client.delete(this.collectionName, {
        filter,
        wait: true,
      });

      const latency = Date.now() - startTime;

      // Record metrics
      metricsCollector.recordVectorStoreOperation(
        this.collectionName,
        'delete',
        latency
      );

      logger.debug('Vectors deleted by filter', {
        collection: this.collectionName,
        latency,
      });
    } catch (error) {
      logger.error('Failed to delete vectors', error as Error, {
        collection: this.collectionName,
      });
      throw error;
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: ids,
        wait: true,
      });

      logger.debug('Vectors deleted by IDs', {
        collection: this.collectionName,
        count: ids.length,
      });
    } catch (error) {
      logger.error('Failed to delete vectors by IDs', error as Error, {
        collection: this.collectionName,
        idsCount: ids.length,
      });
      throw error;
    }
  }

  /**
   * Get vector by ID
   */
  async getVector(id: string): Promise<VectorSearchResult | null> {
    try {
      const results = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: false,
      });

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      return {
        id: result.id as string,
        score: 0, // Not applicable for direct retrieval
        payload: result.payload as Record<string, any>,
      };
    } catch (error) {
      logger.error('Failed to get vector', error as Error, {
        collection: this.collectionName,
        id,
      });
      throw error;
    }
  }

  /**
   * Count vectors in collection
   */
  async count(filter?: SearchFilter): Promise<number> {
    try {
      const result = await this.client.count(this.collectionName, {
        filter,
        exact: true,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to count vectors', error as Error, {
        collection: this.collectionName,
      });
      throw error;
    }
  }

  /**
   * Delete entire collection
   */
  async deleteCollection(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName);
      logger.info('Collection deleted', { collection: this.collectionName });
    } catch (error) {
      logger.error('Failed to delete collection', error as Error, {
        collection: this.collectionName,
      });
      throw error;
    }
  }

  /**
   * Scroll through all vectors (pagination)
   */
  async scroll(
    limit: number = 100,
    offset?: string,
    filter?: SearchFilter,
  ): Promise<{ points: VectorSearchResult[]; nextOffset?: string }> {
    try {
      const result = await this.client.scroll(this.collectionName, {
        limit,
        offset,
        filter,
        with_payload: true,
        with_vector: false,
      });

      return {
        points: result.points.map((p) => ({
          id: p.id as string,
          score: 0,
          payload: p.payload as Record<string, any>,
        })),
        nextOffset: result.next_page_offset as string | undefined,
      };
    } catch (error) {
      logger.error('Failed to scroll vectors', error as Error, {
        collection: this.collectionName,
      });
      throw error;
    }
  }
}
