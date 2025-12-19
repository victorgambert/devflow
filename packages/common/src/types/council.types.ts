/**
 * LLM Council Types - 3-Stage Deliberation System
 *
 * Implements a peer-ranking and chairman synthesis approach:
 * - Stage 1: Collect individual responses from all council models
 * - Stage 2: Each model ranks anonymized responses from other models
 * - Stage 3: Chairman synthesizes final response from all context
 */

/**
 * Stage 1: Individual model response
 */
export interface CouncilResponse {
  model: string;
  response: string;
  error?: string;
}

/**
 * Stage 2: Peer ranking from a single model
 */
export interface CouncilRanking {
  model: string;
  rawText: string; // Full evaluation text
  parsedRanking: string[]; // ["Response A", "Response C", "Response B"]
}

/**
 * Aggregate ranking across all peer evaluations
 */
export interface AggregateRanking {
  model: string;
  averageRank: number;
  rankingsCount: number;
}

/**
 * Stage 3: Chairman synthesis result
 */
export interface CouncilSynthesis {
  model: string;
  response: string;
}

/**
 * Summary for Linear persistence
 */
export interface CouncilSummary {
  councilModels: string[];
  chairmanModel: string;
  topRankedModel: string;
  agreementLevel: 'high' | 'medium' | 'low';
  rankingSummary: string; // Markdown table
  synthesisExplanation: string;
}

/**
 * Stage 2 complete result
 */
export interface CouncilStage2Result {
  rankings: CouncilRanking[];
  labelToModel: Record<string, string>; // "Response A" -> "anthropic/claude-sonnet-4"
  aggregateRankings: AggregateRanking[];
}

/**
 * Full council deliberation result
 */
export interface CouncilResult<T = unknown> {
  stage1: CouncilResponse[];
  stage2: CouncilStage2Result;
  stage3: CouncilSynthesis;
  finalOutput: T;
  summary: CouncilSummary;
}

/**
 * Council configuration
 */
export interface CouncilConfig {
  enabled: boolean;
  models: string[];
  chairmanModel: string;
  timeout?: number; // Per-request timeout in ms
}

/**
 * Default council configuration
 */
export const DEFAULT_COUNCIL_CONFIG: CouncilConfig = {
  enabled: false,
  models: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-exp',
  ],
  chairmanModel: 'anthropic/claude-sonnet-4',
  timeout: 120000,
};
