/**
 * Incremental Indexer
 * Updates repository index with only changed files
 */

import { GitHubProvider } from '../../vcs/github.provider';
import { CodeChunker } from '../chunking/code-chunker';
import { OpenAIEmbeddingsProvider } from '../embeddings/openai.embeddings';
import { QdrantVectorStore } from '../vector-store/qdrant.provider';
import { EmbeddingsCache } from '../cache/embeddings-cache';
import { createLogger } from '@devflow/common';
import { PrismaClient } from '@prisma/client';

const logger = createLogger('IncrementalIndexer');

export interface IncrementalIndexerConfig {
  githubToken: string;
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

export interface ChangedFiles {
  added: string[];
  modified: string[];
  removed: string[];
}

export interface IncrementalUpdateResult {
  indexId: string;
  chunksAdded: number;
  chunksModified: number;
  chunksRemoved: number;
  duration: number;
  cost: number;
}

export class IncrementalIndexer {
  private github: GitHubProvider;
  private chunker: CodeChunker;
  private embeddings: OpenAIEmbeddingsProvider;
  private vectorStore: QdrantVectorStore;
  private cache: EmbeddingsCache;
  private prisma: PrismaClient;

  constructor(config: IncrementalIndexerConfig) {
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

    logger.info('Incremental Indexer initialized', {
      embeddingsModel: this.embeddings.getModel(),
      dimensions: this.embeddings.getDimensions(),
      collection: config.collectionName,
    });
  }

  /**
   * Update index with changed files only
   */
  async updateIndex(
    owner: string,
    repo: string,
    indexId: string,
    changedFiles: ChangedFiles,
    commitSha: string
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    let totalTokens = 0;
    let chunksAdded = 0;
    let chunksModified = 0;
    let chunksRemoved = 0;

    logger.info('Starting incremental update', {
      indexId,
      added: changedFiles.added.length,
      modified: changedFiles.modified.length,
      removed: changedFiles.removed.length,
      commitSha,
    });

    // Mark index as updating
    await this.prisma.codebaseIndex.update({
      where: { id: indexId },
      data: { status: 'UPDATING' },
    });

    try {
      // 1. Remove deleted files
      if (changedFiles.removed.length > 0) {
        logger.info('Removing deleted files', { count: changedFiles.removed.length });

        for (const filePath of changedFiles.removed) {
          // Delete from Qdrant
          await this.vectorStore.deleteByFilter({
            must: [
              { key: 'codebaseIndexId', match: { value: indexId } },
              { key: 'filePath', match: { value: filePath } }
            ]
          });

          // Delete from PostgreSQL
          const deleted = await this.prisma.documentChunk.deleteMany({
            where: { codebaseIndexId: indexId, filePath },
          });

          chunksRemoved += deleted.count;
        }

        logger.info('Deleted files removed', { chunksRemoved });
      }

      // 2. Update modified files
      if (changedFiles.modified.length > 0) {
        logger.info('Updating modified files', { count: changedFiles.modified.length });

        for (const filePath of changedFiles.modified) {
          // Skip non-code files
          if (!this.isCodeFile(filePath)) {
            logger.debug('Skipping non-code file', { filePath });
            continue;
          }

          // Delete old chunks
          await this.vectorStore.deleteByFilter({
            must: [
              { key: 'codebaseIndexId', match: { value: indexId } },
              { key: 'filePath', match: { value: filePath } }
            ]
          });

          const oldChunks = await this.prisma.documentChunk.deleteMany({
            where: { codebaseIndexId: indexId, filePath },
          });

          chunksRemoved += oldChunks.count;

          // Index new version
          const { chunks, tokens } = await this.indexSingleFile(
            owner,
            repo,
            indexId,
            filePath,
            commitSha
          );

          chunksModified += chunks;
          totalTokens += tokens;
        }

        logger.info('Modified files updated', { chunksModified });
      }

      // 3. Add new files
      if (changedFiles.added.length > 0) {
        logger.info('Adding new files', { count: changedFiles.added.length });

        for (const filePath of changedFiles.added) {
          // Skip non-code files
          if (!this.isCodeFile(filePath)) {
            logger.debug('Skipping non-code file', { filePath });
            continue;
          }

          const { chunks, tokens } = await this.indexSingleFile(
            owner,
            repo,
            indexId,
            filePath,
            commitSha
          );

          chunksAdded += chunks;
          totalTokens += tokens;
        }

        logger.info('New files added', { chunksAdded });
      }

      const duration = Date.now() - startTime;
      const cost = this.embeddings.estimateCost(totalTokens);

      // Update index metadata
      const currentIndex = await this.prisma.codebaseIndex.findUnique({
        where: { id: indexId },
      });

      if (!currentIndex) {
        throw new Error(`Index ${indexId} not found`);
      }

      await this.prisma.codebaseIndex.update({
        where: { id: indexId },
        data: {
          status: 'COMPLETED',
          commitSha,
          totalChunks: currentIndex.totalChunks + chunksAdded + chunksModified - chunksRemoved,
          totalTokens: { increment: totalTokens },
          cost: { increment: cost },
          completedAt: new Date(),
        },
      });

      logger.info('Incremental update completed', {
        indexId,
        chunksAdded,
        chunksModified,
        chunksRemoved,
        duration: `${(duration / 1000).toFixed(2)}s`,
        cost: `$${cost.toFixed(6)}`,
      });

      return {
        indexId,
        chunksAdded,
        chunksModified,
        chunksRemoved,
        duration,
        cost,
      };
    } catch (error) {
      logger.error('Incremental update failed', error as Error, { indexId });

      await this.prisma.codebaseIndex.update({
        where: { id: indexId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  /**
   * Index a single file
   */
  private async indexSingleFile(
    owner: string,
    repo: string,
    indexId: string,
    filePath: string,
    commitSha?: string
  ): Promise<{ chunks: number; tokens: number }> {
    try {
      // Fetch file content
      const content = await this.github.getFileContent(owner, repo, filePath, commitSha);

      // Chunk code
      const chunks = this.chunker.chunkCode(
        content,
        filePath,
        parseInt(process.env.RAG_CHUNK_SIZE || '1500'),
        parseInt(process.env.RAG_CHUNK_OVERLAP || '200')
      );

      logger.debug('Chunked file', {
        filePath,
        chunks: chunks.length,
      });

      let totalTokens = 0;

      // Process each chunk
      for (const [idx, chunk] of chunks.entries()) {
        // Check cache
        let embedding = await this.cache.get(chunk.content);

        if (!embedding) {
          embedding = await this.embeddings.generateEmbedding(chunk.content);
          await this.cache.set(chunk.content, embedding);
        }

        const chunkId = `${indexId}_${filePath}_${idx}`;

        // Store in Qdrant
        await this.vectorStore.upsertVectors([
          {
            id: chunkId,
            vector: embedding,
            payload: {
              codebaseIndexId: indexId,
              filePath,
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
            codebaseIndexId: indexId,
            filePath,
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

        totalTokens += this.estimateTokens(chunk.content);
      }

      return { chunks: chunks.length, tokens: totalTokens };
    } catch (error) {
      logger.warn(`Failed to index file: ${filePath}`, error as Error);
      return { chunks: 0, tokens: 0 };
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
   * Estimate token count
   */
  private estimateTokens(text: string): number {
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
