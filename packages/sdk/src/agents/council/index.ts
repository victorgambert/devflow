/**
 * LLM Council - 3-Stage Deliberation System
 *
 * Exports the council service and utilities for multi-LLM deliberation.
 */

export { CouncilService, createCouncilService } from './council.service';
export {
  parseRankingFromText,
  calculateAggregateRankings,
  createAnonymousLabels,
  createLabelToModelMapping,
} from './ranking-parser';

// Re-export types from common
export type {
  CouncilConfig,
  CouncilResponse,
  CouncilRanking,
  CouncilResult,
  CouncilSummary,
  CouncilStage2Result,
  CouncilSynthesis,
  AggregateRanking,
} from '@devflow/common';
