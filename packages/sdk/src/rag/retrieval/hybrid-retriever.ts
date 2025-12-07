/**
 * Hybrid Retriever
 * Combines semantic search with keyword search for better results
 */

import { SemanticRetriever, RetrievalResult, RetrievalFilter } from './semantic-retriever';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@devflow/common';

const logger = createLogger('HybridRetriever');

export interface HybridRetrievalConfig {
  semanticWeight?: number; // Default: 0.7
  keywordWeight?: number; // Default: 0.3
  minKeywordLength?: number; // Default: 3
}

export class HybridRetriever {
  private semanticRetriever: SemanticRetriever;
  private prisma: PrismaClient;
  private semanticWeight: number;
  private keywordWeight: number;
  private minKeywordLength: number;

  constructor(
    semanticRetriever: SemanticRetriever,
    config: HybridRetrievalConfig = {}
  ) {
    this.semanticRetriever = semanticRetriever;
    this.prisma = new PrismaClient();
    this.semanticWeight = config.semanticWeight || 0.7;
    this.keywordWeight = config.keywordWeight || 0.3;
    this.minKeywordLength = config.minKeywordLength || 3;

    logger.info('Hybrid Retriever initialized', {
      semanticWeight: this.semanticWeight,
      keywordWeight: this.keywordWeight,
    });
  }

  /**
   * Retrieve using hybrid search (semantic + keyword)
   */
  async retrieve(
    query: string,
    projectId: string,
    topK = 10,
    filter?: RetrievalFilter
  ): Promise<RetrievalResult[]> {
    const startTime = Date.now();

    logger.info('Starting hybrid retrieval', {
      query: query.substring(0, 100),
      projectId,
      topK,
    });

    // 1. Semantic search
    const semanticResults = await this.semanticRetriever.retrieve(
      query,
      projectId,
      topK * 2, // Fetch more for merging
      filter
    );

    logger.debug('Semantic search completed', {
      results: semanticResults.length,
    });

    // 2. Keyword search
    const keywordResults = await this.keywordSearch(query, projectId, topK, filter);

    logger.debug('Keyword search completed', {
      results: keywordResults.length,
    });

    // 3. Merge and rerank
    const merged = this.mergeResults(semanticResults, keywordResults, topK);

    const retrievalTimeMs = Date.now() - startTime;

    logger.info('Hybrid retrieval completed', {
      semanticResults: semanticResults.length,
      keywordResults: keywordResults.length,
      mergedResults: merged.length,
      timeMs: retrievalTimeMs,
    });

    // Log retrieval
    await this.logRetrieval(
      projectId,
      query,
      merged.map(r => r.chunkId),
      merged.map(r => r.score),
      retrievalTimeMs,
      semanticResults.length + keywordResults.length
    );

    return merged;
  }

  /**
   * Keyword-based search in PostgreSQL
   */
  private async keywordSearch(
    query: string,
    projectId: string,
    limit: number,
    filter?: RetrievalFilter
  ): Promise<RetrievalResult[]> {
    // Get active index
    const index = await this.prisma.codebaseIndex.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    if (!index) {
      logger.warn('No completed index found for keyword search');
      return [];
    }

    // Extract keywords (filter out short words and common terms)
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      logger.debug('No valid keywords extracted from query');
      return [];
    }

    logger.debug('Extracted keywords', { keywords });

    // Build where clause
    const whereClause: any = {
      codebaseIndexId: index.id,
      OR: keywords.map(keyword => ({
        content: { contains: keyword, mode: 'insensitive' as const },
      })),
    };

    // Apply filters
    if (filter?.language) {
      whereClause.language = filter.language;
    }

    if (filter?.chunkType) {
      whereClause.chunkType = filter.chunkType;
    }

    if (filter?.filePaths && filter.filePaths.length > 0) {
      whereClause.filePath = { in: filter.filePaths };
    }

    // Search chunks
    const chunks = await this.prisma.documentChunk.findMany({
      where: whereClause,
      take: limit * 2, // Fetch more for scoring
      orderBy: { createdAt: 'desc' },
    });

    // Score results based on keyword matches
    const scoredChunks = chunks.map(chunk => {
      const score = this.scoreKeywordMatch(chunk.content, keywords);
      return {
        chunk,
        score,
      };
    });

    // Sort by score and take top results
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, limit);

    return topChunks.map(({ chunk, score }) => ({
      chunkId: chunk.id,
      filePath: chunk.filePath,
      content: chunk.content,
      score: score * this.keywordWeight, // Apply keyword weight
      startLine: chunk.startLine ?? undefined,
      endLine: chunk.endLine ?? undefined,
      language: chunk.language,
      chunkType: chunk.chunkType,
      metadata: (chunk.metadata as Record<string, any>) || {},
    }));
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    ]);

    return query
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^a-z0-9]/g, '')) // Remove punctuation
      .filter(word =>
        word.length >= this.minKeywordLength &&
        !stopWords.has(word)
      );
  }

  /**
   * Score keyword match
   */
  private scoreKeywordMatch(content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      // Count occurrences
      const regex = new RegExp(keyword, 'gi');
      const matches = contentLower.match(regex);
      const count = matches ? matches.length : 0;

      // More matches = higher score
      score += count * 0.1;

      // Exact word match gets bonus
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordRegex.test(contentLower)) {
        score += 0.2;
      }
    }

    // Normalize to 0-1 range
    return Math.min(score, 1.0);
  }

  /**
   * Merge semantic and keyword results
   */
  private mergeResults(
    semantic: RetrievalResult[],
    keyword: RetrievalResult[],
    topK: number
  ): RetrievalResult[] {
    const resultMap = new Map<string, RetrievalResult>();

    // Add semantic results with weight
    for (const result of semantic) {
      resultMap.set(result.chunkId, {
        ...result,
        score: result.score * this.semanticWeight,
      });
    }

    // Merge or add keyword results with weight
    for (const result of keyword) {
      const existing = resultMap.get(result.chunkId);

      if (existing) {
        // Combine scores
        existing.score += result.score * this.keywordWeight;
      } else {
        resultMap.set(result.chunkId, {
          ...result,
          score: result.score * this.keywordWeight,
        });
      }
    }

    // Convert to array and sort by combined score
    const merged = Array.from(resultMap.values());
    merged.sort((a, b) => b.score - a.score);

    // Deduplicate by file path to ensure diversity
    // Keep only the best chunk per file
    const deduplicatedByFile = this.deduplicateByFilePath(merged);

    logger.debug('Results merged', {
      semantic: semantic.length,
      keyword: keyword.length,
      unique: merged.length,
      uniqueFiles: deduplicatedByFile.length,
      topK,
    });

    return deduplicatedByFile.slice(0, topK);
  }

  /**
   * Deduplicate results by file path
   * Keep only the best scoring chunk per file to ensure diverse context
   */
  private deduplicateByFilePath(results: RetrievalResult[]): RetrievalResult[] {
    const fileMap = new Map<string, RetrievalResult>();

    for (const result of results) {
      const existing = fileMap.get(result.filePath);

      // Keep the chunk with the highest score for each file
      if (!existing || result.score > existing.score) {
        fileMap.set(result.filePath, result);
      }
    }

    // Convert back to array and sort by score
    const deduplicated = Array.from(fileMap.values());
    deduplicated.sort((a, b) => b.score - a.score);

    return deduplicated;
  }

  /**
   * Log retrieval for metrics
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
      await this.prisma.ragRetrieval.create({
        data: {
          projectId,
          query,
          retrievalMethod: 'hybrid',
          retrievedChunkIds: chunkIds,
          scores,
          retrievalTimeMs,
          totalChunksScanned,
          tokensUsed: Math.ceil(query.length / 4),
          cost: 0, // No additional cost for keyword search
        },
      });
    } catch (error) {
      logger.warn('Failed to log retrieval', error as Error);
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
