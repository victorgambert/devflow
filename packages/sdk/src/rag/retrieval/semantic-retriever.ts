/**
 * Semantic Retriever
 * Vector-based semantic search using embeddings and Qdrant
 */

import { OpenAIEmbeddingsProvider } from '../embeddings/openai.embeddings';
import { QdrantVectorStore, VectorSearchResult } from '../vector-store/qdrant.provider';
import { EmbeddingsCache } from '../cache/embeddings-cache';
import { createLogger } from '@devflow/common';
import { PrismaClient } from '@prisma/client';
import { metricsCollector } from '../metrics/metrics-collector';
import { randomUUID } from 'crypto';

const logger = createLogger('SemanticRetriever');

export interface RetrievalResult {
  chunkId: string;
  filePath: string;
  content: string;
  score: number;
  startLine?: number;
  endLine?: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
}

export interface SemanticRetrieverConfig {
  embeddingsApiKey: string;
  embeddingsBaseURL?: string; // Defaults to OpenRouter
  qdrantHost: string;
  qdrantPort: number;
  collectionName: string;
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
}

export interface RetrievalFilter {
  language?: string;
  chunkType?: string;
  filePaths?: string[];
}

export class SemanticRetriever {
  private embeddings: OpenAIEmbeddingsProvider;
  private vectorStore: QdrantVectorStore;
  private cache: EmbeddingsCache;
  private prisma: PrismaClient;

  constructor(config: SemanticRetrieverConfig) {
    this.embeddings = new OpenAIEmbeddingsProvider({
      apiKey: config.embeddingsApiKey,
      baseURL: config.embeddingsBaseURL, // Defaults to OpenRouter
      model: 'text-embedding-3-large',
      dimensions: 3072,
    });

    this.vectorStore = new QdrantVectorStore({
      host: config.qdrantHost,
      port: config.qdrantPort,
      collectionName: config.collectionName,
    });

    this.cache = new EmbeddingsCache({
      redisUrl: config.redisUrl,
      redisHost: config.redisHost,
      redisPort: config.redisPort,
      redisPassword: config.redisPassword,
    });

    this.prisma = new PrismaClient();

    logger.info('Semantic Retriever initialized', {
      model: this.embeddings.getModel(),
      dimensions: this.embeddings.getDimensions(),
      collection: config.collectionName,
    });
  }

  /**
   * Retrieve relevant code chunks using semantic search
   */
  async retrieve(
    query: string,
    projectId: string,
    topK = 10,
    filter?: RetrievalFilter,
    scoreThreshold?: number
  ): Promise<RetrievalResult[]> {
    const startTime = Date.now();

    logger.info('Starting semantic retrieval', {
      query: query.substring(0, 100),
      projectId,
      topK,
      filter,
    });

    // Get or create query embedding
    let queryEmbedding = await this.cache.get(query);
    if (!queryEmbedding) {
      logger.debug('Cache miss, generating query embedding');
      queryEmbedding = await this.embeddings.generateEmbedding(query);
      await this.cache.set(query, queryEmbedding);
    } else {
      logger.debug('Cache hit for query embedding');
    }

    // Get active index for project
    const index = await this.prisma.codebaseIndex.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    if (!index) {
      throw new Error(`No completed index found for project ${projectId}`);
    }

    logger.debug('Using index', {
      indexId: index.id,
      totalChunks: index.totalChunks,
      commitSha: index.commitSha,
    });

    // Build Qdrant filter
    const qdrantFilter = this.buildQdrantFilter(index.id, filter);

    // Search in Qdrant
    const results = await this.vectorStore.search(
      queryEmbedding,
      topK,
      qdrantFilter,
      scoreThreshold !== undefined ? scoreThreshold : parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.3')
    );

    const retrievalTimeMs = Date.now() - startTime;

    logger.info('Semantic retrieval completed', {
      query: query.substring(0, 50),
      results: results.length,
      timeMs: retrievalTimeMs,
      avgScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
    });

    // Log retrieval for metrics
    await this.logRetrieval(
      projectId,
      query,
      results.map(r => r.id),
      results.map(r => r.score),
      retrievalTimeMs,
      results.length
    );

    // Update index last used timestamp
    await this.prisma.codebaseIndex.update({
      where: { id: index.id },
      data: { lastUsedAt: new Date() },
    });

    return results.map(r => ({
      chunkId: r.id,
      filePath: r.payload.filePath as string,
      content: r.payload.content as string,
      score: r.score,
      startLine: r.payload.startLine as number | undefined,
      endLine: r.payload.endLine as number | undefined,
      language: r.payload.language as string,
      chunkType: r.payload.chunkType as string,
      metadata: r.payload.metadata as Record<string, any>,
    }));
  }

  /**
   * Retrieve with multiple queries (OR logic)
   */
  async retrieveMultiple(
    queries: string[],
    projectId: string,
    topKPerQuery = 5,
    filter?: RetrievalFilter
  ): Promise<RetrievalResult[]> {
    logger.info('Starting multi-query retrieval', {
      queries: queries.length,
      projectId,
      topKPerQuery,
    });

    const allResults: RetrievalResult[] = [];
    const seenChunkIds = new Set<string>();

    for (const query of queries) {
      const results = await this.retrieve(query, projectId, topKPerQuery, filter);

      // Add unique results
      for (const result of results) {
        if (!seenChunkIds.has(result.chunkId)) {
          allResults.push(result);
          seenChunkIds.add(result.chunkId);
        }
      }
    }

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);

    logger.info('Multi-query retrieval completed', {
      queries: queries.length,
      uniqueResults: allResults.length,
    });

    return allResults;
  }

  /**
   * Build Qdrant filter from retrieval filter
   */
  private buildQdrantFilter(indexId: string, filter?: RetrievalFilter): any {
    const must: any[] = [
      { key: 'codebaseIndexId', match: { value: indexId } }
    ];

    if (filter?.language) {
      must.push({ key: 'language', match: { value: filter.language } });
    }

    if (filter?.chunkType) {
      must.push({ key: 'chunkType', match: { value: filter.chunkType } });
    }

    if (filter?.filePaths && filter.filePaths.length > 0) {
      // For multiple file paths, use should (OR logic)
      const should = filter.filePaths.map(path => ({
        key: 'filePath',
        match: { value: path }
      }));

      return { must, should };
    }

    return { must };
  }

  /**
   * Log retrieval for metrics tracking
   */
  private async logRetrieval(
    projectId: string,
    query: string,
    chunkIds: string[],
    scores: number[],
    retrievalTimeMs: number,
    totalChunksScanned: number
  ): Promise<void> {
    try {
      const tokensUsed = this.estimateTokens(query);
      const cost = this.embeddings.estimateCost(tokensUsed);
      const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

      // Store in database
      await this.prisma.ragRetrieval.create({
        data: {
          projectId,
          query,
          retrievalMethod: 'semantic',
          retrievedChunkIds: chunkIds,
          scores,
          retrievalTimeMs,
          totalChunksScanned,
          tokensUsed,
          cost,
        },
      });

      // Record in metrics collector
      metricsCollector.recordRetrieval({
        retrievalId: randomUUID(),
        projectId,
        query,
        method: 'semantic',
        resultsCount: chunkIds.length,
        averageScore: avgScore,
        retrievalTime: retrievalTimeMs,
        rerankTime: null,
        cacheHit: false, // Not tracked here
        cost,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.warn('Failed to log retrieval', error as Error);
    }
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get retrieval statistics
   */
  async getStats(projectId: string, hours = 24): Promise<{
    totalRetrievals: number;
    averageResults: number;
    averageScore: number;
    averageTimeMs: number;
    totalCost: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const retrievals = await this.prisma.ragRetrieval.findMany({
      where: {
        projectId,
        retrievalMethod: 'semantic',
        createdAt: { gte: since },
      },
    });

    if (retrievals.length === 0) {
      return {
        totalRetrievals: 0,
        averageResults: 0,
        averageScore: 0,
        averageTimeMs: 0,
        totalCost: 0,
      };
    }

    const totalResults = retrievals.reduce((sum, r) => sum + r.retrievedChunkIds.length, 0);
    const totalScore = retrievals.reduce(
      (sum, r) => sum + r.scores.reduce((s, score) => s + score, 0),
      0
    );
    const totalScoreCount = retrievals.reduce((sum, r) => sum + r.scores.length, 0);

    return {
      totalRetrievals: retrievals.length,
      averageResults: totalResults / retrievals.length,
      averageScore: totalScoreCount > 0 ? totalScore / totalScoreCount : 0,
      averageTimeMs: retrievals.reduce((sum, r) => sum + r.retrievalTimeMs, 0) / retrievals.length,
      totalCost: retrievals.reduce((sum, r) => sum + r.cost, 0),
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.cache.close();
    await this.prisma.$disconnect();
  }
}
