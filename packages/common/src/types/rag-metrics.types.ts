/**
 * RAG Metrics Types
 * Metrics for monitoring RAG system performance and health
 */

export interface RagMetrics {
  // Indexing metrics
  indexing: {
    totalRepositoriesIndexed: number;
    totalChunksIndexed: number;
    averageIndexingTime: number; // milliseconds
    indexingCost: number; // USD
    indexingSuccessRate: number; // 0-1
    lastIndexingTime: Date | null;
    failedIndexings: number;
  };

  // Retrieval metrics
  retrieval: {
    totalRetrievals: number;
    averageRetrievalTime: number; // milliseconds
    averageRelevanceScore: number; // 0-1
    cacheHitRate: number; // 0-1
    rerankingRate: number; // 0-1
    averageResultsPerQuery: number;
  };

  // Performance metrics
  performance: {
    p50RetrievalTime: number; // milliseconds
    p95RetrievalTime: number; // milliseconds
    p99RetrievalTime: number; // milliseconds
    p50IndexingTime: number; // milliseconds
    p95IndexingTime: number; // milliseconds
  };

  // Cost metrics
  cost: {
    totalEmbeddingCost: number; // USD
    totalRerankingCost: number; // USD
    costPerRetrieval: number; // USD
    costPerIndex: number; // USD
    monthlyCost: number; // USD
  };

  // Quality metrics
  quality: {
    averageChunkSize: number; // characters
    averageChunksPerFile: number;
    indexFreshness: number; // days since last update
    averageVectorScore: number; // 0-1
  };

  // System health
  health: {
    qdrantStatus: 'healthy' | 'degraded' | 'down';
    redisStatus: 'healthy' | 'degraded' | 'down';
    databaseStatus: 'healthy' | 'degraded' | 'down';
    lastHealthCheck: Date;
  };
}

export interface IndexingMetrics {
  indexId: string;
  projectId: string;
  status: 'PENDING' | 'INDEXING' | 'COMPLETED' | 'FAILED' | 'UPDATING';
  totalFiles: number;
  totalChunks: number;
  duration: number; // milliseconds
  cost: number; // USD
  tokensUsed: number;
  startedAt: Date;
  completedAt: Date | null;
}

export interface RetrievalMetrics {
  retrievalId: string;
  projectId: string;
  query: string;
  method: 'semantic' | 'hybrid';
  resultsCount: number;
  averageScore: number;
  retrievalTime: number; // milliseconds
  rerankTime: number | null; // milliseconds
  cacheHit: boolean;
  cost: number; // USD
  timestamp: Date;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number; // 0-1
  averageHitLatency: number; // milliseconds
  averageMissLatency: number; // milliseconds
  totalKeys: number;
  memoryUsage: number; // bytes
}

export interface VectorStoreMetrics {
  collectionName: string;
  totalVectors: number;
  indexedVectors: number;
  dimensions: number;
  memoryUsage: number; // bytes
  queryLatency: number; // milliseconds
  lastUpdate: Date;
}

export interface MetricsSnapshot {
  timestamp: Date;
  rag: RagMetrics;
  indexing: IndexingMetrics[];
  retrieval: RetrievalMetrics[];
  cache: CacheMetrics;
  vectorStore: VectorStoreMetrics[];
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  lastTriggered: Date | null;
}

export interface RagAlert {
  id: string;
  rule: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}
