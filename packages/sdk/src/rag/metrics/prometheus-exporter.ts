/**
 * Prometheus Metrics Exporter for RAG
 *
 * Exposes RAG metrics in Prometheus format
 */

import { createLogger } from '@devflow/common';
import { metricsCollector } from './metrics-collector';
import type { RagMetrics } from '@devflow/common';

const logger = createLogger('PrometheusExporter');

export class PrometheusExporter {
  /**
   * Export metrics in Prometheus format
   */
  static export(): string {
    const metrics = metricsCollector.getMetrics();
    const cacheMetrics = metricsCollector.getCacheMetrics();
    const vectorStoreMetrics = metricsCollector.getVectorStoreMetrics();

    const lines: string[] = [];

    // Indexing metrics
    lines.push('# HELP rag_repositories_indexed_total Total number of repositories indexed');
    lines.push('# TYPE rag_repositories_indexed_total counter');
    lines.push(`rag_repositories_indexed_total ${metrics.indexing.totalRepositoriesIndexed}`);
    lines.push('');

    lines.push('# HELP rag_chunks_indexed_total Total number of code chunks indexed');
    lines.push('# TYPE rag_chunks_indexed_total counter');
    lines.push(`rag_chunks_indexed_total ${metrics.indexing.totalChunksIndexed}`);
    lines.push('');

    lines.push('# HELP rag_indexing_duration_ms Average indexing duration in milliseconds');
    lines.push('# TYPE rag_indexing_duration_ms gauge');
    lines.push(`rag_indexing_duration_ms ${metrics.indexing.averageIndexingTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_indexing_cost_usd Total indexing cost in USD');
    lines.push('# TYPE rag_indexing_cost_usd counter');
    lines.push(`rag_indexing_cost_usd ${metrics.indexing.indexingCost.toFixed(6)}`);
    lines.push('');

    lines.push('# HELP rag_indexing_success_rate Success rate of indexing operations (0-1)');
    lines.push('# TYPE rag_indexing_success_rate gauge');
    lines.push(`rag_indexing_success_rate ${metrics.indexing.indexingSuccessRate.toFixed(4)}`);
    lines.push('');

    lines.push('# HELP rag_indexing_failures_total Total number of failed indexing operations');
    lines.push('# TYPE rag_indexing_failures_total counter');
    lines.push(`rag_indexing_failures_total ${metrics.indexing.failedIndexings}`);
    lines.push('');

    // Retrieval metrics
    lines.push('# HELP rag_retrievals_total Total number of retrieval operations');
    lines.push('# TYPE rag_retrievals_total counter');
    lines.push(`rag_retrievals_total ${metrics.retrieval.totalRetrievals}`);
    lines.push('');

    lines.push('# HELP rag_retrieval_duration_ms Average retrieval duration in milliseconds');
    lines.push('# TYPE rag_retrieval_duration_ms gauge');
    lines.push(`rag_retrieval_duration_ms ${metrics.retrieval.averageRetrievalTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_retrieval_relevance_score Average relevance score of retrieved results (0-1)');
    lines.push('# TYPE rag_retrieval_relevance_score gauge');
    lines.push(`rag_retrieval_relevance_score ${metrics.retrieval.averageRelevanceScore.toFixed(4)}`);
    lines.push('');

    lines.push('# HELP rag_retrieval_results_per_query Average number of results per query');
    lines.push('# TYPE rag_retrieval_results_per_query gauge');
    lines.push(`rag_retrieval_results_per_query ${metrics.retrieval.averageResultsPerQuery.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_reranking_rate Rate of queries that use reranking (0-1)');
    lines.push('# TYPE rag_reranking_rate gauge');
    lines.push(`rag_reranking_rate ${metrics.retrieval.rerankingRate.toFixed(4)}`);
    lines.push('');

    // Performance metrics
    lines.push('# HELP rag_retrieval_duration_p50_ms P50 retrieval duration in milliseconds');
    lines.push('# TYPE rag_retrieval_duration_p50_ms gauge');
    lines.push(`rag_retrieval_duration_p50_ms ${metrics.performance.p50RetrievalTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_retrieval_duration_p95_ms P95 retrieval duration in milliseconds');
    lines.push('# TYPE rag_retrieval_duration_p95_ms gauge');
    lines.push(`rag_retrieval_duration_p95_ms ${metrics.performance.p95RetrievalTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_retrieval_duration_p99_ms P99 retrieval duration in milliseconds');
    lines.push('# TYPE rag_retrieval_duration_p99_ms gauge');
    lines.push(`rag_retrieval_duration_p99_ms ${metrics.performance.p99RetrievalTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_indexing_duration_p50_ms P50 indexing duration in milliseconds');
    lines.push('# TYPE rag_indexing_duration_p50_ms gauge');
    lines.push(`rag_indexing_duration_p50_ms ${metrics.performance.p50IndexingTime.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_indexing_duration_p95_ms P95 indexing duration in milliseconds');
    lines.push('# TYPE rag_indexing_duration_p95_ms gauge');
    lines.push(`rag_indexing_duration_p95_ms ${metrics.performance.p95IndexingTime.toFixed(2)}`);
    lines.push('');

    // Cost metrics
    lines.push('# HELP rag_embedding_cost_usd Total embedding cost in USD');
    lines.push('# TYPE rag_embedding_cost_usd counter');
    lines.push(`rag_embedding_cost_usd ${metrics.cost.totalEmbeddingCost.toFixed(6)}`);
    lines.push('');

    lines.push('# HELP rag_reranking_cost_usd Total reranking cost in USD');
    lines.push('# TYPE rag_reranking_cost_usd counter');
    lines.push(`rag_reranking_cost_usd ${metrics.cost.totalRerankingCost.toFixed(6)}`);
    lines.push('');

    lines.push('# HELP rag_cost_per_retrieval_usd Average cost per retrieval in USD');
    lines.push('# TYPE rag_cost_per_retrieval_usd gauge');
    lines.push(`rag_cost_per_retrieval_usd ${metrics.cost.costPerRetrieval.toFixed(6)}`);
    lines.push('');

    lines.push('# HELP rag_cost_per_index_usd Average cost per index in USD');
    lines.push('# TYPE rag_cost_per_index_usd gauge');
    lines.push(`rag_cost_per_index_usd ${metrics.cost.costPerIndex.toFixed(6)}`);
    lines.push('');

    lines.push('# HELP rag_monthly_cost_usd Estimated monthly cost in USD');
    lines.push('# TYPE rag_monthly_cost_usd gauge');
    lines.push(`rag_monthly_cost_usd ${metrics.cost.monthlyCost.toFixed(2)}`);
    lines.push('');

    // Quality metrics
    lines.push('# HELP rag_average_chunk_size_bytes Average chunk size in bytes');
    lines.push('# TYPE rag_average_chunk_size_bytes gauge');
    lines.push(`rag_average_chunk_size_bytes ${metrics.quality.averageChunkSize.toFixed(0)}`);
    lines.push('');

    lines.push('# HELP rag_average_chunks_per_file Average number of chunks per file');
    lines.push('# TYPE rag_average_chunks_per_file gauge');
    lines.push(`rag_average_chunks_per_file ${metrics.quality.averageChunksPerFile.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_index_freshness_days Average index age in days');
    lines.push('# TYPE rag_index_freshness_days gauge');
    lines.push(`rag_index_freshness_days ${metrics.quality.indexFreshness.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_vector_score Average vector similarity score (0-1)');
    lines.push('# TYPE rag_vector_score gauge');
    lines.push(`rag_vector_score ${metrics.quality.averageVectorScore.toFixed(4)}`);
    lines.push('');

    // Cache metrics
    lines.push('# HELP rag_cache_hits_total Total number of cache hits');
    lines.push('# TYPE rag_cache_hits_total counter');
    lines.push(`rag_cache_hits_total ${cacheMetrics.hits}`);
    lines.push('');

    lines.push('# HELP rag_cache_misses_total Total number of cache misses');
    lines.push('# TYPE rag_cache_misses_total counter');
    lines.push(`rag_cache_misses_total ${cacheMetrics.misses}`);
    lines.push('');

    lines.push('# HELP rag_cache_hit_rate Cache hit rate (0-1)');
    lines.push('# TYPE rag_cache_hit_rate gauge');
    lines.push(`rag_cache_hit_rate ${cacheMetrics.hitRate.toFixed(4)}`);
    lines.push('');

    lines.push('# HELP rag_cache_hit_latency_ms Average cache hit latency in milliseconds');
    lines.push('# TYPE rag_cache_hit_latency_ms gauge');
    lines.push(`rag_cache_hit_latency_ms ${cacheMetrics.averageHitLatency.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP rag_cache_miss_latency_ms Average cache miss latency in milliseconds');
    lines.push('# TYPE rag_cache_miss_latency_ms gauge');
    lines.push(`rag_cache_miss_latency_ms ${cacheMetrics.averageMissLatency.toFixed(2)}`);
    lines.push('');

    // Vector store metrics (per collection)
    for (const vsMetrics of vectorStoreMetrics) {
      const collectionLabel = `collection="${vsMetrics.collectionName}"`;

      lines.push('# HELP rag_vectorstore_vectors_total Total number of vectors in collection');
      lines.push('# TYPE rag_vectorstore_vectors_total gauge');
      lines.push(`rag_vectorstore_vectors_total{${collectionLabel}} ${vsMetrics.totalVectors}`);
      lines.push('');

      lines.push('# HELP rag_vectorstore_indexed_vectors Total number of indexed vectors');
      lines.push('# TYPE rag_vectorstore_indexed_vectors gauge');
      lines.push(`rag_vectorstore_indexed_vectors{${collectionLabel}} ${vsMetrics.indexedVectors}`);
      lines.push('');

      lines.push('# HELP rag_vectorstore_query_latency_ms Average query latency in milliseconds');
      lines.push('# TYPE rag_vectorstore_query_latency_ms gauge');
      lines.push(`rag_vectorstore_query_latency_ms{${collectionLabel}} ${vsMetrics.queryLatency.toFixed(2)}`);
      lines.push('');

      lines.push('# HELP rag_vectorstore_memory_bytes Estimated memory usage in bytes');
      lines.push('# TYPE rag_vectorstore_memory_bytes gauge');
      lines.push(`rag_vectorstore_memory_bytes{${collectionLabel}} ${vsMetrics.memoryUsage}`);
      lines.push('');
    }

    // Health metrics
    lines.push('# HELP rag_qdrant_status Qdrant health status (1=healthy, 0.5=degraded, 0=down)');
    lines.push('# TYPE rag_qdrant_status gauge');
    const qdrantStatus = metrics.health.qdrantStatus === 'healthy' ? 1 : metrics.health.qdrantStatus === 'degraded' ? 0.5 : 0;
    lines.push(`rag_qdrant_status ${qdrantStatus}`);
    lines.push('');

    lines.push('# HELP rag_redis_status Redis health status (1=healthy, 0.5=degraded, 0=down)');
    lines.push('# TYPE rag_redis_status gauge');
    const redisStatus = metrics.health.redisStatus === 'healthy' ? 1 : metrics.health.redisStatus === 'degraded' ? 0.5 : 0;
    lines.push(`rag_redis_status ${redisStatus}`);
    lines.push('');

    lines.push('# HELP rag_database_status Database health status (1=healthy, 0.5=degraded, 0=down)');
    lines.push('# TYPE rag_database_status gauge');
    const dbStatus = metrics.health.databaseStatus === 'healthy' ? 1 : metrics.health.databaseStatus === 'degraded' ? 0.5 : 0;
    lines.push(`rag_database_status ${dbStatus}`);
    lines.push('');

    const output = lines.join('\n');

    logger.debug('Prometheus metrics exported', {
      linesCount: lines.length,
      metricsCount: output.split('\n').filter(l => !l.startsWith('#') && l.trim().length > 0).length,
    });

    return output;
  }

  /**
   * Export metrics as JSON for debugging
   */
  static exportJSON(): string {
    const metrics = metricsCollector.getMetrics();
    const cacheMetrics = metricsCollector.getCacheMetrics();
    const vectorStoreMetrics = metricsCollector.getVectorStoreMetrics();

    return JSON.stringify(
      {
        rag: metrics,
        cache: cacheMetrics,
        vectorStore: vectorStoreMetrics,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Get metrics summary for quick overview
   */
  static getSummary(): {
    indexing: { total: number; failed: number; avgDuration: string; cost: string };
    retrieval: { total: number; avgLatency: string; avgScore: string };
    cache: { hitRate: string; avgHitLatency: string };
    health: { qdrant: string; redis: string; database: string };
  } {
    const metrics = metricsCollector.getMetrics();
    const cacheMetrics = metricsCollector.getCacheMetrics();

    return {
      indexing: {
        total: metrics.indexing.totalRepositoriesIndexed,
        failed: metrics.indexing.failedIndexings,
        avgDuration: `${(metrics.indexing.averageIndexingTime / 1000).toFixed(1)}s`,
        cost: `$${metrics.indexing.indexingCost.toFixed(4)}`,
      },
      retrieval: {
        total: metrics.retrieval.totalRetrievals,
        avgLatency: `${metrics.retrieval.averageRetrievalTime.toFixed(0)}ms`,
        avgScore: `${(metrics.retrieval.averageRelevanceScore * 100).toFixed(1)}%`,
      },
      cache: {
        hitRate: `${(cacheMetrics.hitRate * 100).toFixed(1)}%`,
        avgHitLatency: `${cacheMetrics.averageHitLatency.toFixed(1)}ms`,
      },
      health: {
        qdrant: metrics.health.qdrantStatus,
        redis: metrics.health.redisStatus,
        database: metrics.health.databaseStatus,
      },
    };
  }
}
