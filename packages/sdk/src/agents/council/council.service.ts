/**
 * CouncilService - 3-Stage LLM Deliberation System
 *
 * Implements the LLM Council pattern:
 * 1. Collect individual responses from all models in parallel
 * 2. Peer ranking with anonymization to prevent bias
 * 3. Chairman synthesis combining all insights
 *
 * Based on: https://github.com/karpathy/llm-council
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  createLogger,
  AgentPrompt,
  CouncilConfig,
  CouncilResponse,
  CouncilRanking,
  CouncilResult,
  CouncilSummary,
  CouncilStage2Result,
  CouncilSynthesis,
  AggregateRanking,
  DEFAULT_COUNCIL_CONFIG,
} from '@devflow/common';

import { createCodeAgentDriver } from '@/agents/index';
import {
  parseRankingFromText,
  calculateAggregateRankings,
  createAnonymousLabels,
  createLabelToModelMapping,
} from './ranking-parser';

const logger = createLogger('CouncilService');

// Prompt template cache
const promptCache = new Map<string, { system: string; user: string }>();

/**
 * Load council prompts from markdown files
 */
async function loadCouncilPrompts(
  promptType: 'ranking' | 'synthesis',
  variables: Record<string, string>
): Promise<AgentPrompt> {
  const cacheKey = promptType;

  let templates: { system: string; user: string };

  if (process.env.NODE_ENV === 'production' && promptCache.has(cacheKey)) {
    templates = promptCache.get(cacheKey)!;
  } else {
    const promptsDir = path.join(__dirname, 'prompts');
    const systemPath = path.join(promptsDir, `${promptType}.system.md`);
    const userPath = path.join(promptsDir, `${promptType}.user.md`);

    const [system, user] = await Promise.all([
      fs.readFile(systemPath, 'utf-8'),
      fs.readFile(userPath, 'utf-8'),
    ]);

    templates = { system, user };

    if (process.env.NODE_ENV === 'production') {
      promptCache.set(cacheKey, templates);
    }
  }

  // Substitute variables
  let system = templates.system;
  let user = templates.user;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    system = system.replace(new RegExp(placeholder, 'g'), value);
    user = user.replace(new RegExp(placeholder, 'g'), value);
  }

  return { system, user };
}

export class CouncilService {
  private config: CouncilConfig;
  private apiKey: string;

  constructor(apiKey: string, config?: Partial<CouncilConfig>) {
    this.apiKey = apiKey;
    this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
  }

  /**
   * Run full council deliberation
   *
   * @param prompt - The prompt to send to all council models
   * @param parseResponse - Function to parse the final response into structured output
   * @returns Complete council result with all stages
   */
  async deliberate<T>(
    prompt: AgentPrompt,
    parseResponse: (content: string) => T
  ): Promise<CouncilResult<T>> {
    logger.info('Starting council deliberation', {
      models: this.config.models,
      chairman: this.config.chairmanModel,
    });

    // Stage 1: Collect responses from all models
    const stage1Results = await this.collectResponses(prompt);

    if (stage1Results.length === 0) {
      throw new Error('All council models failed to respond');
    }

    logger.info('Stage 1 complete', {
      successfulResponses: stage1Results.length,
    });

    // Stage 2: Peer rankings with anonymization
    const stage2Result = await this.collectRankings(
      prompt.user,
      stage1Results
    );

    logger.info('Stage 2 complete', {
      rankingsCollected: stage2Result.rankings.length,
      topRanked: stage2Result.aggregateRankings[0]?.model,
    });

    // Stage 3: Chairman synthesis
    const stage3Result = await this.synthesize(
      prompt.user,
      stage1Results,
      stage2Result.rankings
    );

    logger.info('Stage 3 complete', {
      chairmanModel: stage3Result.model,
    });

    // Parse final output
    const finalOutput = parseResponse(stage3Result.response);

    // Generate summary for Linear
    const summary = this.generateSummary(
      stage1Results,
      stage2Result.aggregateRankings,
      stage3Result
    );

    return {
      stage1: stage1Results,
      stage2: stage2Result,
      stage3: stage3Result,
      finalOutput,
      summary,
    };
  }

  /**
   * Stage 1: Query all council models in parallel
   */
  private async collectResponses(prompt: AgentPrompt): Promise<CouncilResponse[]> {
    logger.info('Stage 1: Collecting responses from council models');

    const promises = this.config.models.map(async (model): Promise<CouncilResponse> => {
      try {
        const agent = createCodeAgentDriver({
          provider: 'openrouter',
          apiKey: this.apiKey,
          model,
        });

        const response = await agent.generate(prompt);

        return {
          model,
          response: response.content,
        };
      } catch (error) {
        logger.error(`Model ${model} failed`, error as Error);
        return {
          model,
          response: '',
          error: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(promises);

    // Filter out failed responses (graceful degradation)
    return results.filter((r) => !r.error && r.response.length > 0);
  }

  /**
   * Stage 2: Each model ranks anonymized responses
   */
  private async collectRankings(
    originalQuery: string,
    stage1Results: CouncilResponse[]
  ): Promise<CouncilStage2Result> {
    logger.info('Stage 2: Collecting peer rankings');

    // Create anonymized labels (A, B, C, ...)
    const labels = createAnonymousLabels(stage1Results.length);
    const labelToModel = createLabelToModelMapping(
      labels,
      stage1Results.map((r) => r.model)
    );

    // Build anonymized responses text
    const responsesText = stage1Results
      .map((r, i) => `Response ${labels[i]}:\n${r.response}`)
      .join('\n\n---\n\n');

    // Load ranking prompts
    const rankingPrompts = await loadCouncilPrompts('ranking', {
      originalQuery,
      responses: responsesText,
    });

    // Query all models for rankings in parallel
    const rankingPromises = this.config.models.map(
      async (model): Promise<CouncilRanking | null> => {
        try {
          const agent = createCodeAgentDriver({
            provider: 'openrouter',
            apiKey: this.apiKey,
            model,
          });

          const response = await agent.generate(rankingPrompts);
          const parsed = parseRankingFromText(response.content);

          return {
            model,
            rawText: response.content,
            parsedRanking: parsed,
          };
        } catch (error) {
          logger.error(`Ranking failed for ${model}`, error as Error);
          return null;
        }
      }
    );

    const results = await Promise.all(rankingPromises);
    const rankings = results.filter((r): r is CouncilRanking => r !== null);

    // Calculate aggregate rankings
    const aggregateRankings = calculateAggregateRankings(rankings, labelToModel);

    return {
      rankings,
      labelToModel,
      aggregateRankings,
    };
  }

  /**
   * Stage 3: Chairman synthesizes final response
   */
  private async synthesize(
    originalQuery: string,
    stage1Results: CouncilResponse[],
    rankings: CouncilRanking[]
  ): Promise<CouncilSynthesis> {
    logger.info('Stage 3: Chairman synthesis');

    // Build Stage 1 context
    const stage1Text = stage1Results
      .map((r) => `Model: ${r.model}\nResponse:\n${r.response}`)
      .join('\n\n---\n\n');

    // Build Stage 2 context
    const stage2Text = rankings
      .map((r) => `Model: ${r.model}\nEvaluation:\n${r.rawText}`)
      .join('\n\n---\n\n');

    // Load synthesis prompts
    const synthesisPrompts = await loadCouncilPrompts('synthesis', {
      originalQuery,
      stage1Responses: stage1Text,
      stage2Rankings: stage2Text,
    });

    // Query chairman model
    const chairman = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: this.apiKey,
      model: this.config.chairmanModel,
    });

    try {
      const response = await chairman.generate(synthesisPrompts);

      return {
        model: this.config.chairmanModel,
        response: response.content,
      };
    } catch (error) {
      logger.error('Chairman synthesis failed', error as Error);

      // Fallback: use best-ranked response from Stage 1
      const topRanked = stage1Results[0];
      return {
        model: topRanked?.model || this.config.chairmanModel,
        response: topRanked?.response || 'Error: Unable to generate synthesis.',
      };
    }
  }

  /**
   * Generate summary for Linear persistence
   */
  private generateSummary(
    stage1: CouncilResponse[],
    aggregateRankings: AggregateRanking[],
    synthesis: CouncilSynthesis
  ): CouncilSummary {
    const topRanked = aggregateRankings[0];

    // Determine agreement level based on rank spread
    const rankSpread =
      aggregateRankings.length > 1
        ? aggregateRankings[aggregateRankings.length - 1].averageRank -
          aggregateRankings[0].averageRank
        : 0;

    const agreementLevel: 'high' | 'medium' | 'low' =
      rankSpread < 0.5 ? 'high' : rankSpread < 1.5 ? 'medium' : 'low';

    // Build ranking table
    const rankingSummary = this.formatRankingTable(aggregateRankings);

    return {
      councilModels: this.config.models,
      chairmanModel: this.config.chairmanModel,
      topRankedModel: topRanked?.model || 'unknown',
      agreementLevel,
      rankingSummary,
      synthesisExplanation: `Chairman (${this.getShortModelName(synthesis.model)}) synthesized insights from ${stage1.length} council members.`,
    };
  }

  /**
   * Format aggregate rankings as markdown table
   */
  private formatRankingTable(rankings: AggregateRanking[]): string {
    const rows = rankings.map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const shortName = this.getShortModelName(r.model);
      return `| ${medal} | ${shortName} | ${r.averageRank.toFixed(2)} | ${r.rankingsCount} |`;
    });

    return [
      '| Rank | Model | Avg Position | Votes |',
      '|------|-------|--------------|-------|',
      ...rows,
    ].join('\n');
  }

  /**
   * Get short model name (remove provider prefix)
   */
  private getShortModelName(model: string): string {
    return model.split('/')[1] || model;
  }
}

/**
 * Factory function to create a CouncilService
 */
export function createCouncilService(
  apiKey: string,
  config?: Partial<CouncilConfig>
): CouncilService {
  return new CouncilService(apiKey, config);
}
