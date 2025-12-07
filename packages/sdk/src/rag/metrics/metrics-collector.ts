/**
 * RAG Metrics Collector
 *
 * Centralized metrics collection for RAG operations
 */

import { createLogger } from '@devflow/common';
import type {
  RagMetrics,
  IndexingMetrics,
  RetrievalMetrics,
  CacheMetrics,
  VectorStoreMetrics,
} from '@devflow/common';

const logger = createLogger('RagMetricsCollector');

export interface MetricsEvent {
  type: 'indexing' | 'retrieval' | 'cache' | 'vector_store' | 'embedding';
  operation: string;
  duration?: number;
  cost?: number;
  success: boolean;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class RagMetricsCollector {
  private static instance: RagMetricsCollector;

  // In-memory metrics storage
  private indexingMetrics: IndexingMetrics[] = [];
  private retrievalMetrics: RetrievalMetrics[] = [];
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalLatency: 0,
    hitLatency: 0,
    missLatency: 0,
  };
  private vectorStoreStats = new Map<string, {
    totalVectors: number;
    indexedVectors: number;
    queries: number;
    totalQueryLatency: number;
    lastUpdate: Date;
  }>();

  // Performance percentiles storage
  private retrievalTimes: number[] = [];
  private indexingTimes: number[] = [];

  private constructor() {
    logger.info('RAG Metrics Collector initialized');
  }

  static getInstance(): RagMetricsCollector {
    if (!RagMetricsCollector.instance) {
      RagMetricsCollector.instance = new RagMetricsCollector();
    }
    return RagMetricsCollector.instance;
  }

  /**
   * Record indexing metrics
   */
  recordIndexing(metrics: IndexingMetrics): void {
    this.indexingMetrics.push(metrics);
    this.indexingTimes.push(metrics.duration);

    // Keep only last 1000 entries
    if (this.indexingMetrics.length > 1000) {
      this.indexingMetrics.shift();
    }
    if (this.indexingTimes.length > 1000) {
      this.indexingTimes.shift();
    }

    logger.debug('Indexing metrics recorded', {
      indexId: metrics.indexId,
      duration: metrics.duration,
      chunks: metrics.totalChunks,
      cost: metrics.cost,
    });
  }

  /**
   * Record retrieval metrics
   */
  recordRetrieval(metrics: RetrievalMetrics): void {
    this.retrievalMetrics.push(metrics);
    this.retrievalTimes.push(metrics.retrievalTime);

    // Keep only last 1000 entries
    if (this.retrievalMetrics.length > 1000) {
      this.retrievalMetrics.shift();
    }
    if (this.retrievalTimes.length > 1000) {
      this.retrievalTimes.shift();
    }

    logger.debug('Retrieval metrics recorded', {
      retrievalId: metrics.retrievalId,
      method: metrics.method,
      duration: metrics.retrievalTime,
      results: metrics.resultsCount,
      score: metrics.averageScore,
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(latency: number): void {
    this.cacheStats.hits++;
    this.cacheStats.totalLatency += latency;
    this.cacheStats.hitLatency += latency;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(latency: number): void {
    this.cacheStats.misses++;
    this.cacheStats.totalLatency += latency;
    this.cacheStats.missLatency += latency;
  }

  /**
   * Record vector store operation
   */
  recordVectorStoreOperation(
    collectionName: string,
    operation: 'upsert' | 'search' | 'delete',
    latency: number,
    metadata?: { vectorCount?: number; resultsCount?: number }
  ): void {
    let stats = this.vectorStoreStats.get(collectionName);

    if (!stats) {
      stats = {
        totalVectors: 0,
        indexedVectors: 0,
        queries: 0,
        totalQueryLatency: 0,
        lastUpdate: new Date(),
      };
      this.vectorStoreStats.set(collectionName, stats);
    }

    if (operation === 'upsert' && metadata?.vectorCount) {
      stats.totalVectors += metadata.vectorCount;
      stats.indexedVectors += metadata.vectorCount;
    } else if (operation === 'search') {
      stats.queries++;
      stats.totalQueryLatency += latency;
    }

    stats.lastUpdate = new Date();

    logger.debug('Vector store operation recorded', {
      collection: collectionName,
      operation,
      latency,
      metadata,
    });
  }

  /**
   * Get aggregated RAG metrics
   */
  getMetrics(): RagMetrics {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Filter recent metrics (last 24h)
    const recentIndexing = this.indexingMetrics.filter(
      m => m.startedAt >= oneDayAgo
    );
    const recentRetrieval = this.retrievalMetrics.filter(
      m => m.timestamp >= oneDayAgo
    );

    // Calculate indexing metrics
    const completedIndexing = recentIndexing.filter(
      m => m.status === 'COMPLETED'
    );
    const totalIndexingCost = completedIndexing.reduce(
      (sum, m) => sum + m.cost,
      0
    );
    const totalChunksIndexed = completedIndexing.reduce(
      (sum, m) => sum + m.totalChunks,
      0
    );
    const avgIndexingTime =
      completedIndexing.length > 0
        ? completedIndexing.reduce((sum, m) => sum + m.duration, 0) /
          completedIndexing.length
        : 0;

    // Calculate retrieval metrics
    const totalRetrievals = recentRetrieval.length;
    const avgRetrievalTime =
      totalRetrievals > 0
        ? recentRetrieval.reduce((sum, m) => sum + m.retrievalTime, 0) /
          totalRetrievals
        : 0;
    const avgRelevanceScore =
      totalRetrievals > 0
        ? recentRetrieval.reduce((sum, m) => sum + m.averageScore, 0) /
          totalRetrievals
        : 0;

    // Calculate cache metrics
    const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRate =
      totalCacheRequests > 0
        ? this.cacheStats.hits / totalCacheRequests
        : 0;
    const avgHitLatency =
      this.cacheStats.hits > 0
        ? this.cacheStats.hitLatency / this.cacheStats.hits
        : 0;
    const avgMissLatency =
      this.cacheStats.misses > 0
        ? this.cacheStats.missLatency / this.cacheStats.misses
        : 0;

    // Calculate reranking metrics
    const rerankedRetrievals = recentRetrieval.filter(
      m => m.rerankTime !== null
    );
    const rerankingRate =
      totalRetrievals > 0 ? rerankedRetrievals.length / totalRetrievals : 0;

    // Calculate cost metrics
    const totalRerankingCost = rerankedRetrievals.reduce(
      (sum, m) => sum + m.cost,
      0
    );
    const totalEmbeddingCost = recentRetrieval.reduce(
      (sum, m) => sum + m.cost,
      0
    );
    const costPerRetrieval =
      totalRetrievals > 0
        ? (totalEmbeddingCost + totalRerankingCost) / totalRetrievals
        : 0;

    return {
      indexing: {
        totalRepositoriesIndexed: new Set(completedIndexing.map(m => m.projectId))
          .size,
        totalChunksIndexed,
        averageIndexingTime: avgIndexingTime,
        indexingCost: totalIndexingCost,
        indexingSuccessRate:
          recentIndexing.length > 0
            ? completedIndexing.length / recentIndexing.length
            : 1,
        lastIndexingTime:
          completedIndexing.length > 0
            ? completedIndexing[completedIndexing.length - 1].completedAt
            : null,
        failedIndexings: recentIndexing.filter(m => m.status === 'FAILED')
          .length,
      },
      retrieval: {
        totalRetrievals,
        averageRetrievalTime: avgRetrievalTime,
        averageRelevanceScore: avgRelevanceScore,
        cacheHitRate,
        rerankingRate,
        averageResultsPerQuery:
          totalRetrievals > 0
            ? recentRetrieval.reduce((sum, m) => sum + m.resultsCount, 0) /
              totalRetrievals
            : 0,
      },
      performance: {
        p50RetrievalTime: this.calculatePercentile(this.retrievalTimes, 0.5),
        p95RetrievalTime: this.calculatePercentile(this.retrievalTimes, 0.95),
        p99RetrievalTime: this.calculatePercentile(this.retrievalTimes, 0.99),
        p50IndexingTime: this.calculatePercentile(this.indexingTimes, 0.5),
        p95IndexingTime: this.calculatePercentile(this.indexingTimes, 0.95),
      },
      cost: {
        totalEmbeddingCost,
        totalRerankingCost,
        costPerRetrieval,
        costPerIndex:
          completedIndexing.length > 0
            ? totalIndexingCost / completedIndexing.length
            : 0,
        monthlyCost: (totalEmbeddingCost + totalRerankingCost + totalIndexingCost) * 30, // Extrapolate to 30 days
      },
      quality: {
        averageChunkSize:
          totalChunksIndexed > 0
            ? completedIndexing.reduce(
                (sum, m) => sum + m.totalChunks * 1500,
                0
              ) / totalChunksIndexed
            : 0,
        averageChunksPerFile:
          completedIndexing.length > 0
            ? totalChunksIndexed /
              completedIndexing.reduce((sum, m) => sum + m.totalFiles, 0)
            : 0,
        indexFreshness: this.calculateIndexFreshness(completedIndexing),
        averageVectorScore: avgRelevanceScore,
      },
      health: {
        qdrantStatus: this.getQdrantStatus(),
        redisStatus: this.getRedisStatus(),
        databaseStatus: 'healthy',
        lastHealthCheck: new Date(),
      },
    };
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;

    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate:
        totalRequests > 0 ? this.cacheStats.hits / totalRequests : 0,
      averageHitLatency:
        this.cacheStats.hits > 0
          ? this.cacheStats.hitLatency / this.cacheStats.hits
          : 0,
      averageMissLatency:
        this.cacheStats.misses > 0
          ? this.cacheStats.missLatency / this.cacheStats.misses
          : 0,
      totalKeys: totalRequests,
      memoryUsage: 0, // TODO: Get from Redis INFO
    };
  }

  /**
   * Get vector store metrics
   */
  getVectorStoreMetrics(): VectorStoreMetrics[] {
    const metrics: VectorStoreMetrics[] = [];

    for (const [collectionName, stats] of this.vectorStoreStats.entries()) {
      metrics.push({
        collectionName,
        totalVectors: stats.totalVectors,
        indexedVectors: stats.indexedVectors,
        dimensions: 3072, // text-embedding-3-large
        memoryUsage: stats.totalVectors * 3072 * 4, // Approximate: 4 bytes per float32
        queryLatency:
          stats.queries > 0 ? stats.totalQueryLatency / stats.queries : 0,
        lastUpdate: stats.lastUpdate,
      });
    }

    return metrics;
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.indexingMetrics = [];
    this.retrievalMetrics = [];
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalLatency: 0,
      hitLatency: 0,
      missLatency: 0,
    };
    this.vectorStoreStats.clear();
    this.retrievalTimes = [];
    this.indexingTimes = [];

    logger.info('Metrics reset');
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate average index freshness in days
   */
  private calculateIndexFreshness(indexing: IndexingMetrics[]): number {
    if (indexing.length === 0) return 0;

    const now = Date.now();
    const totalDays = indexing.reduce((sum, m) => {
      const completedAt = m.completedAt ? m.completedAt.getTime() : now;
      return sum + (now - completedAt) / (1000 * 60 * 60 * 24);
    }, 0);

    return totalDays / indexing.length;
  }

  /**
   * Get Qdrant health status
   */
  private getQdrantStatus(): 'healthy' | 'degraded' | 'down' {
    // TODO: Implement actual health check
    // For now, check if we have recent vector store operations
    const recentOperations = Array.from(this.vectorStoreStats.values()).some(
      stats => {
        const timeSinceUpdate = Date.now() - stats.lastUpdate.getTime();
        return timeSinceUpdate < 5 * 60 * 1000; // 5 minutes
      }
    );

    return recentOperations ? 'healthy' : 'degraded';
  }

  /**
   * Get Redis health status
   */
  private getRedisStatus(): 'healthy' | 'degraded' | 'down' {
    // TODO: Implement actual health check
    // For now, check if we have recent cache operations
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    return totalRequests > 0 ? 'healthy' : 'degraded';
  }
}

// Export singleton instance
export const metricsCollector = RagMetricsCollector.getInstance();
