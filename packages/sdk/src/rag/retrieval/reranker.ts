/**
 * LLM Reranker
 * Uses Claude via OpenRouter to rerank retrieval results
 */

import OpenAI from 'openai';
import { createLogger } from '@devflow/common';
import type { RetrievalResult } from './semantic-retriever';

const logger = createLogger('LLMReranker');

export interface RerankerConfig {
  apiKey: string;
  baseURL?: string; // Defaults to OpenRouter
  model?: string; // Default: Claude 3 Haiku (fast and cheap)
  maxTokens?: number;
}

export class LLMReranker {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: RerankerConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
    });
    this.model = config.model || 'anthropic/claude-3-haiku';
    this.maxTokens = config.maxTokens || 1000;

    logger.info('LLM Reranker initialized', {
      model: this.model,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
    });
  }

  /**
   * Rerank results using LLM
   */
  async rerank(
    query: string,
    results: RetrievalResult[],
    topK = 5
  ): Promise<RetrievalResult[]> {
    if (results.length === 0) {
      return [];
    }

    if (results.length <= topK) {
      logger.debug('Results already under topK, skipping reranking');
      return results;
    }

    const startTime = Date.now();

    logger.info('Starting LLM reranking', {
      query: query.substring(0, 100),
      inputResults: results.length,
      topK,
    });

    try {
      // Build reranking prompt
      const prompt = this.buildRerankPrompt(query, results);

      // Call LLM
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('Empty response from reranker, returning original order');
        return results.slice(0, topK);
      }

      // Parse rankings
      const rankings = this.parseRankings(content, results.length);

      // Reorder results
      const reranked = rankings
        .filter(idx => idx >= 0 && idx < results.length) // Validate indices
        .map(idx => results[idx])
        .slice(0, topK);

      // If reranking failed, fallback to original order
      if (reranked.length === 0) {
        logger.warn('Reranking failed to produce results, using original order');
        return results.slice(0, topK);
      }

      const rerankTimeMs = Date.now() - startTime;

      logger.info('LLM reranking completed', {
        inputResults: results.length,
        outputResults: reranked.length,
        timeMs: rerankTimeMs,
      });

      return reranked;
    } catch (error) {
      logger.error('Reranking failed, falling back to original order', error as Error);
      return results.slice(0, topK);
    }
  }

  /**
   * Build reranking prompt
   */
  private buildRerankPrompt(query: string, results: RetrievalResult[]): string {
    let prompt = `Given this user query:
"${query}"

Rank these code snippets by relevance (most relevant first). Consider:
- How well the code addresses the query
- Code quality and clarity
- Relevance to the task described

Code snippets:

`;

    results.forEach((result, idx) => {
      const preview = result.content.substring(0, 400);
      prompt += `[${idx}] File: ${result.filePath}\n`;
      prompt += `Type: ${result.chunkType} | Language: ${result.language}\n`;
      prompt += `Code:\n${preview}${result.content.length > 400 ? '...' : ''}\n\n`;
    });

    prompt += `\nRespond with ONLY the indices in order of relevance, one per line.
Example response:
2
0
5
1
3

Your response (indices only, most relevant first):`;

    return prompt;
  }

  /**
   * Parse rankings from LLM response
   */
  private parseRankings(text: string, maxIndex: number): number[] {
    const lines = text.trim().split('\n');
    const rankings: number[] = [];

    for (const line of lines) {
      // Try to extract a number from the line
      const match = line.match(/^\s*(\d+)\s*$/);
      if (match) {
        const idx = parseInt(match[1]);
        if (!isNaN(idx) && idx >= 0 && idx < maxIndex && !rankings.includes(idx)) {
          rankings.push(idx);
        }
      }
    }

    logger.debug('Parsed rankings', {
      rawText: text.substring(0, 100),
      rankings,
    });

    return rankings;
  }

  /**
   * Batch rerank multiple queries
   */
  async rerankBatch(
    queries: Array<{ query: string; results: RetrievalResult[] }>,
    topK = 5
  ): Promise<RetrievalResult[][]> {
    logger.info('Starting batch reranking', {
      queries: queries.length,
      topK,
    });

    const reranked = await Promise.all(
      queries.map(({ query, results }) => this.rerank(query, results, topK))
    );

    logger.info('Batch reranking completed', {
      queries: queries.length,
      totalResults: reranked.reduce((sum, r) => sum + r.length, 0),
    });

    return reranked;
  }

  /**
   * Estimate cost of reranking
   */
  estimateCost(inputLength: number, outputLength: number): number {
    // Claude 3 Haiku via OpenRouter: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
    const inputTokens = Math.ceil(inputLength / 4);
    const outputTokens = Math.ceil(outputLength / 4);

    const inputCost = (inputTokens / 1_000_000) * 0.25;
    const outputCost = (outputTokens / 1_000_000) * 1.25;

    return inputCost + outputCost;
  }
}
