/**
 * Repository Indexer
 * Indexes entire repositories for RAG retrieval
 */

import { GitHubProvider } from '../../vcs/github.provider';
import { CodeChunker } from '../chunking/code-chunker';
import { OpenAIEmbeddingsProvider } from '../embeddings/openai.embeddings';
import { QdrantVectorStore } from '../vector-store/qdrant.provider';
import { EmbeddingsCache } from '../cache/embeddings-cache';
import crypto from 'crypto';
import { createLogger } from '@devflow/common';
import { PrismaClient } from '@prisma/client';
import { metricsCollector } from '../metrics/metrics-collector';

const logger = createLogger('RepositoryIndexer');

export interface RepositoryIndexerConfig {
  githubToken: string;
  embeddingsApiKey: string;
  embeddingsBaseURL?: string; // OpenRouter: https://openrouter.ai/api/v1
  qdrantHost: string;
  qdrantPort: number;
  collectionName: string;
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
}

export interface IndexingProgress {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export class RepositoryIndexer {
  private github: GitHubProvider;
  private chunker: CodeChunker;
  private embeddings: OpenAIEmbeddingsProvider;
  private vectorStore: QdrantVectorStore;
  private cache: EmbeddingsCache;
  private prisma: PrismaClient;

  constructor(config: RepositoryIndexerConfig) {
    this.github = new GitHubProvider(config.githubToken);
    this.chunker = new CodeChunker();
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

    logger.info('Repository Indexer initialized', {
      embeddingsModel: this.embeddings.getModel(),
      dimensions: this.embeddings.getDimensions(),
      collection: config.collectionName,
    });
  }

  /**
   * Index entire repository
   */
  async indexRepository(
    owner: string,
    repo: string,
    projectId: string,
    commitSha?: string
  ): Promise<string> {
    const startTime = Date.now();

    logger.info('Starting repository indexing', {
      owner,
      repo,
      projectId,
      commitSha: commitSha || 'HEAD',
    });

    // Create index record in database
    const index = await this.prisma.codebaseIndex.create({
      data: {
        projectId,
        status: 'INDEXING',
        commitSha: commitSha || 'HEAD',
        branch: 'main',
        embeddingModel: this.embeddings.getModel(),
        embeddingDimensions: this.embeddings.getDimensions(),
      },
    });

    try {
      // Ensure Qdrant collection exists
      await this.vectorStore.ensureCollection(this.embeddings.getDimensions());

      // Get repository tree
      const tree = await this.github.getRepositoryTree(owner, repo, commitSha);
      const codeFiles = tree.filter(
        item =>
          item.type === 'blob' &&
          this.isCodeFile(item.path) &&
          !this.isExcluded(item.path)
      );

      logger.info('Files to index', {
        total: tree.length,
        codeFiles: codeFiles.length,
      });

      const allChunks: any[] = [];
      let totalTokens = 0;

      // Process files in batches of 10
      for (let i = 0; i < codeFiles.length; i += 10) {
        const batch = codeFiles.slice(i, i + 10);

        logger.debug('Processing batch', {
          batchIndex: Math.floor(i / 10) + 1,
          batchSize: batch.length,
          totalBatches: Math.ceil(codeFiles.length / 10),
        });

        // Fetch multiple files in parallel
        const fileContents = await Promise.all(
          batch.map(async (file) => {
            try {
              const content = await this.github.getFileContent(owner, repo, file.path, commitSha);
              return { path: file.path, content };
            } catch (error) {
              logger.warn(`Failed to fetch file: ${file.path}`, error as Error);
              return null;
            }
          })
        );

        // Filter out failed fetches
        const validFiles = fileContents.filter(f => f !== null) as Array<{ path: string; content: string }>;

        // Process each file
        for (const file of validFiles) {
          try {
            // Chunk code
            const chunks = this.chunker.chunkCode(
              file.content,
              file.path,
              parseInt(process.env.RAG_CHUNK_SIZE || '1500'),
              parseInt(process.env.RAG_CHUNK_OVERLAP || '200')
            );

            logger.debug('Chunked file', {
              path: file.path,
              chunks: chunks.length,
            });

            // Generate embeddings for all chunks (with caching)
            for (const [idx, chunk] of chunks.entries()) {
              // Check cache first
              let embedding = await this.cache.get(chunk.content);

              if (!embedding) {
                embedding = await this.embeddings.generateEmbedding(chunk.content);
                await this.cache.set(chunk.content, embedding);
              }

              // Generate a proper UUID for Qdrant (Qdrant only accepts UUIDs or integers)
              const chunkId = crypto.randomUUID();

              // Store in Qdrant
              await this.vectorStore.upsertVectors([
                {
                  id: chunkId,
                  vector: embedding,
                  payload: {
                    codebaseIndexId: index.id,
                    filePath: file.path,
                    startLine: chunk.startLine,
                    endLine: chunk.endLine,
                    chunkType: chunk.chunkType,
                    language: chunk.language,
                    content: chunk.content,
                    metadata: chunk.metadata,
                  },
                },
              ]);

              // Store in PostgreSQL
              await this.prisma.documentChunk.create({
                data: {
                  codebaseIndexId: index.id,
                  filePath: file.path,
                  startLine: chunk.startLine,
                  endLine: chunk.endLine,
                  chunkIndex: idx,
                  content: chunk.content,
                  language: chunk.language,
                  chunkType: chunk.chunkType,
                  qdrantPointId: chunkId,
                  metadata: chunk.metadata as any,
                },
              });

              allChunks.push(chunk);
              totalTokens += this.estimateTokens(chunk.content);
            }
          } catch (error) {
            logger.error(`Failed to process file: ${file.path}`, error as Error, {
              filePath: file.path,
            });
            console.error(`❌ ERROR processing ${file.path}:`, error);
          }
        }

        // Update progress after each batch
        await this.prisma.codebaseIndex.update({
          where: { id: index.id },
          data: {
            totalChunks: allChunks.length,
            totalFiles: i + batch.length,
          },
        });
      }

      const duration = Date.now() - startTime;
      const cost = this.embeddings.estimateCost(totalTokens);

      // Mark as completed
      await this.prisma.codebaseIndex.update({
        where: { id: index.id },
        data: {
          status: 'COMPLETED',
          totalChunks: allChunks.length,
          totalFiles: codeFiles.length,
          indexedFiles: codeFiles.map(f => f.path),
          indexingDuration: duration,
          totalTokens,
          cost,
          completedAt: new Date(),
        },
      });

      // Record metrics
      metricsCollector.recordIndexing({
        indexId: index.id,
        projectId,
        status: 'COMPLETED',
        totalFiles: codeFiles.length,
        totalChunks: allChunks.length,
        duration,
        cost,
        tokensUsed: totalTokens,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });

      logger.info('Indexing completed', {
        indexId: index.id,
        totalChunks: allChunks.length,
        totalFiles: codeFiles.length,
        duration: `${(duration / 1000).toFixed(2)}s`,
        cost: `$${cost.toFixed(6)}`,
      });

      return index.id;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Indexing failed', error as Error, {
        indexId: index.id,
        owner,
        repo,
      });

      await this.prisma.codebaseIndex.update({
        where: { id: index.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      // Record failed indexing metrics
      metricsCollector.recordIndexing({
        indexId: index.id,
        projectId,
        status: 'FAILED',
        totalFiles: 0,
        totalChunks: 0,
        duration,
        cost: 0,
        tokensUsed: 0,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(path: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.php', '.rb', '.c', '.cpp',
      '.cs', '.swift', '.kt',
    ];
    return codeExtensions.some(ext => path.endsWith(ext));
  }

  /**
   * Check if path should be excluded
   */
  private isExcluded(path: string): boolean {
    const excludedPaths = [
      'node_modules',
      'dist',
      'build',
      '.git',
      'vendor',
      '__pycache__',
      '.next',
      'coverage',
      '.cache',
    ];
    return excludedPaths.some(excluded => path.includes(excluded));
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Approximation: 1 token ≈ 4 chars
    return Math.ceil(text.length / 4);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.cache.close();
    await this.prisma.$disconnect();
  }
}
