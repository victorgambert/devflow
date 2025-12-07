/**
 * OpenRouter Embeddings Provider
 * Uses OpenRouter API for unified AI integration
 */

import OpenAI from 'openai';
import { createLogger } from '@devflow/common';
import type { EmbeddingsProvider, EmbeddingResult, BatchEmbeddingResult } from './embeddings.interface';

const logger = createLogger('OpenRouterEmbeddings');

export interface OpenAIEmbeddingsConfig {
  apiKey: string;
  baseURL?: string; // Defaults to OpenRouter
  model?: string;
  dimensions?: number;
  maxRetries?: number;
  timeout?: number;
}

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  private client: OpenAI;
  private model: string;
  private dimensions: number;
  private maxRetries: number;

  constructor(config: OpenAIEmbeddingsConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
    });
    this.model = config.model || 'text-embedding-3-large';
    this.dimensions = config.dimensions || 3072;
    this.maxRetries = config.maxRetries || 3;

    logger.info('OpenRouter Embeddings Provider initialized', {
      model: this.model,
      dimensions: this.dimensions,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', error as Error, { textLength: text.length });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * Automatically handles batching to respect OpenAI's 100 input limit
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const batchSize = 100; // OpenAI limit
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        logger.debug('Processing batch', {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalBatches: Math.ceil(texts.length / batchSize),
        });

        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: this.dimensions,
        });

        results.push(...response.data.map((d) => d.embedding));
      }

      logger.info('Batch embeddings generated', {
        totalTexts: texts.length,
        batches: Math.ceil(texts.length / batchSize),
      });

      return results;
    } catch (error) {
      logger.error('Failed to generate batch embeddings', error as Error, {
        textsCount: texts.length,
      });
      throw error;
    }
  }

  /**
   * Generate embedding with full result metadata
   */
  async generateEmbeddingWithMetadata(text: string): Promise<EmbeddingResult> {
    const embedding = await this.generateEmbedding(text);
    const tokens = this.estimateTokens(text);
    const cost = this.estimateCost(tokens);

    return {
      embedding,
      tokens,
      cost,
    };
  }

  /**
   * Generate batch embeddings with full result metadata
   */
  async generateBatchEmbeddingsWithMetadata(texts: string[]): Promise<BatchEmbeddingResult> {
    const embeddings = await this.generateEmbeddings(texts);
    const totalTokens = texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
    const totalCost = this.estimateCost(totalTokens);

    return {
      embeddings,
      totalTokens,
      totalCost,
    };
  }

  /**
   * Get the dimensions of the embeddings
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Estimate cost based on token count
   * text-embedding-3-large: $0.13 per 1M tokens
   * text-embedding-3-small: $0.02 per 1M tokens
   */
  estimateCost(tokenCount: number): number {
    const costPerMillionTokens = this.model.includes('small') ? 0.02 : 0.13;
    return (tokenCount / 1_000_000) * costPerMillionTokens;
  }

  /**
   * Estimate token count for a text
   * Approximation: 1 token ≈ 4 characters for English text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
