/**
 * RAG Temporal Activities
 * Activities for repository indexing and context retrieval
 */

import { createLogger } from '@devflow/common';
import { RepositoryIndexer } from '@devflow/sdk/src/rag/indexing/repository-indexer';
import { IncrementalIndexer } from '@devflow/sdk/src/rag/indexing/incremental-indexer';
import { SemanticRetriever } from '@devflow/sdk/src/rag/retrieval/semantic-retriever';
import { HybridRetriever } from '@devflow/sdk/src/rag/retrieval/hybrid-retriever';
import { LLMReranker } from '@devflow/sdk/src/rag/retrieval/reranker';
import { PrismaClient } from '@prisma/client';
import { getProjectRepositoryConfig } from './codebase.activities';

const logger = createLogger('RagActivities');
const prisma = new PrismaClient();

export interface IndexRepositoryInput {
  projectId: string;
  owner: string;
  repo: string;
  commitSha?: string;
}

export interface IndexRepositoryOutput {
  indexId: string;
  totalChunks: number;
  totalFiles: number;
  duration: number;
  cost: number;
}

export interface RetrieveContextInput {
  projectId: string;
  query: string;
  topK?: number;
  useReranking?: boolean;
  filter?: {
    language?: string;
    chunkType?: string;
    filePaths?: string[];
  };
}

export interface RetrieveContextOutput {
  chunks: Array<{
    filePath: string;
    content: string;
    score: number;
    language: string;
    chunkType: string;
    startLine?: number;
    endLine?: number;
  }>;
  retrievalTimeMs: number;
  totalChunks: number;
}

export interface CheckIndexStatusInput {
  projectId: string;
}

export interface CheckIndexStatusOutput {
  needsIndexing: boolean;
  reason?: string;
  indexId?: string;
  lastIndexedAt?: Date;
  totalChunks?: number;
}

/**
 * Index repository for RAG
 */
export async function indexRepository(
  input: IndexRepositoryInput
): Promise<IndexRepositoryOutput> {
  logger.info('Starting repository indexing', input);

  const indexer = new RepositoryIndexer({
    githubToken: process.env.GITHUB_TOKEN!,
    embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });

  try {
    const indexId = await indexer.indexRepository(
      input.owner,
      input.repo,
      input.projectId,
      input.commitSha
    );

    const index = await prisma.codebaseIndex.findUnique({
      where: { id: indexId },
    });

    if (!index) {
      throw new Error(`Index ${indexId} not found after indexing`);
    }

    logger.info('Repository indexing completed', {
      indexId,
      totalChunks: index.totalChunks,
      totalFiles: index.totalFiles,
      duration: index.indexingDuration,
      cost: index.cost,
    });

    return {
      indexId,
      totalChunks: index.totalChunks,
      totalFiles: index.totalFiles,
      duration: index.indexingDuration || 0,
      cost: index.cost,
    };
  } finally {
    await indexer.close();
  }
}

/**
 * Retrieve context for task using RAG
 */
export async function retrieveContext(
  input: RetrieveContextInput
): Promise<RetrieveContextOutput> {
  logger.info('Retrieving context', {
    projectId: input.projectId,
    query: input.query.substring(0, 100),
    topK: input.topK,
    useReranking: input.useReranking,
  });

  const startTime = Date.now();

  // Initialize retrievers
  const semanticRetriever = new SemanticRetriever({
    embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });

  const hybridRetriever = new HybridRetriever(semanticRetriever);

  try {
    // Use hybrid retrieval by default
    let results = await hybridRetriever.retrieve(
      input.query,
      input.projectId,
      input.topK || parseInt(process.env.RAG_TOP_K || '10'),
      input.filter
    );

    // Optional reranking
    if (input.useReranking && results.length > 5) {
      logger.info('Reranking results with LLM');

      const reranker = new LLMReranker({
        apiKey: process.env.OPENROUTER_API_KEY!,
        model: 'anthropic/claude-3-haiku',
      });

      results = await reranker.rerank(
        input.query,
        results,
        parseInt(process.env.RAG_RERANK_TOP_K || '5')
      );
    }

    const retrievalTimeMs = Date.now() - startTime;

    logger.info('Context retrieved', {
      chunks: results.length,
      timeMs: retrievalTimeMs,
      avgScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
    });

    return {
      chunks: results.map(r => ({
        filePath: r.filePath,
        content: r.content,
        score: r.score,
        language: r.language,
        chunkType: r.chunkType,
        startLine: r.startLine,
        endLine: r.endLine,
      })),
      retrievalTimeMs,
      totalChunks: results.length,
    };
  } finally {
    await semanticRetriever.close();
    await hybridRetriever.close();
  }
}

/**
 * Check if project needs indexing
 */
export async function checkIndexStatus(
  input: CheckIndexStatusInput
): Promise<CheckIndexStatusOutput> {
  logger.info('Checking index status', { projectId: input.projectId });

  const index = await prisma.codebaseIndex.findFirst({
    where: { projectId: input.projectId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });

  if (!index) {
    logger.info('No index found', { projectId: input.projectId });
    return {
      needsIndexing: true,
      reason: 'No index found',
    };
  }

  // Check if index is older than 7 days
  const daysSinceIndexing = (Date.now() - index.completedAt!.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceIndexing > 7) {
    logger.info('Index is stale', {
      projectId: input.projectId,
      daysSinceIndexing: daysSinceIndexing.toFixed(1),
    });
    return {
      needsIndexing: true,
      reason: `Index is stale (${daysSinceIndexing.toFixed(1)} days old)`,
      indexId: index.id,
      lastIndexedAt: index.completedAt!,
    };
  }

  logger.info('Index is fresh', {
    projectId: input.projectId,
    indexId: index.id,
    daysSinceIndexing: daysSinceIndexing.toFixed(1),
  });

  return {
    needsIndexing: false,
    indexId: index.id,
    lastIndexedAt: index.completedAt!,
    totalChunks: index.totalChunks,
  };
}

export interface UpdateRepositoryIndexInput {
  projectId: string;
  owner: string;
  repo: string;
  indexId: string;
  changedFiles: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  commitSha: string;
}

export interface UpdateRepositoryIndexOutput {
  indexId: string;
  chunksAdded: number;
  chunksModified: number;
  chunksRemoved: number;
  duration: number;
  cost: number;
}

/**
 * Update repository index incrementally (only changed files)
 */
export async function updateRepositoryIndex(
  input: UpdateRepositoryIndexInput
): Promise<UpdateRepositoryIndexOutput> {
  logger.info('Starting incremental index update', {
    projectId: input.projectId,
    indexId: input.indexId,
    added: input.changedFiles.added.length,
    modified: input.changedFiles.modified.length,
    removed: input.changedFiles.removed.length,
  });

  const indexer = new IncrementalIndexer({
    githubToken: process.env.GITHUB_TOKEN!,
    embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });

  try {
    const result = await indexer.updateIndex(
      input.owner,
      input.repo,
      input.indexId,
      input.changedFiles,
      input.commitSha
    );

    logger.info('Incremental update completed', {
      indexId: result.indexId,
      chunksAdded: result.chunksAdded,
      chunksModified: result.chunksModified,
      chunksRemoved: result.chunksRemoved,
      duration: result.duration,
      cost: result.cost,
    });

    return result;
  } finally {
    await indexer.close();
  }
}
