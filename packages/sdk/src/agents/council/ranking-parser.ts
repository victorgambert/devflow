/**
 * Ranking Parser - Extract structured rankings from model responses
 *
 * Parses the "FINAL RANKING:" section from peer evaluation responses.
 * Handles various formats: numbered lists, plain text, etc.
 */

import type { CouncilRanking, AggregateRanking } from '@devflow/common';

/**
 * Parse FINAL RANKING section from model response
 *
 * Expected format:
 * FINAL RANKING:
 * 1. Response C
 * 2. Response A
 * 3. Response B
 *
 * @param text - The full text response from the model
 * @returns List of response labels in ranked order
 */
export function parseRankingFromText(text: string): string[] {
  // Look for "FINAL RANKING:" section
  if (text.includes('FINAL RANKING:')) {
    const parts = text.split('FINAL RANKING:');
    if (parts.length >= 2) {
      const rankingSection = parts[1];

      // Try numbered list format: "1. Response A"
      const numberedMatches = rankingSection.match(/\d+\.\s*Response [A-Z]/g);
      if (numberedMatches && numberedMatches.length > 0) {
        return numberedMatches
          .map((m) => {
            const match = m.match(/Response [A-Z]/);
            return match ? match[0] : '';
          })
          .filter(Boolean);
      }

      // Fallback: extract all "Response X" patterns in order
      const matches = rankingSection.match(/Response [A-Z]/g);
      if (matches) return matches;
    }
  }

  // Last fallback: any "Response X" patterns in entire text
  const matches = text.match(/Response [A-Z]/g);
  return matches || [];
}

/**
 * Calculate aggregate rankings across all peer evaluations
 *
 * Each model's ranking contributes to the average position.
 * Lower average rank = better (rank 1 is best).
 *
 * @param rankings - Rankings from each model
 * @param labelToModel - Mapping from anonymous labels to model names
 * @returns List of aggregate rankings sorted best to worst
 */
export function calculateAggregateRankings(
  rankings: CouncilRanking[],
  labelToModel: Record<string, string>
): AggregateRanking[] {
  const modelPositions = new Map<string, number[]>();

  for (const ranking of rankings) {
    const parsedRanking = ranking.parsedRanking;

    for (let position = 0; position < parsedRanking.length; position++) {
      const label = parsedRanking[position];
      const model = labelToModel[label];

      if (model) {
        const positions = modelPositions.get(model) || [];
        positions.push(position + 1); // 1-indexed (rank 1 is best)
        modelPositions.set(model, positions);
      }
    }
  }

  // Calculate averages
  const aggregates: AggregateRanking[] = [];

  for (const [model, positions] of modelPositions) {
    if (positions.length > 0) {
      const averageRank = positions.reduce((a, b) => a + b, 0) / positions.length;
      aggregates.push({
        model,
        averageRank: Math.round(averageRank * 100) / 100,
        rankingsCount: positions.length,
      });
    }
  }

  // Sort by average rank (lower is better)
  return aggregates.sort((a, b) => a.averageRank - b.averageRank);
}

/**
 * Create anonymized labels for responses (A, B, C, ...)
 *
 * @param count - Number of responses
 * @returns Array of labels
 */
export function createAnonymousLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * Create label-to-model mapping for de-anonymization
 *
 * @param labels - Array of labels (A, B, C, ...)
 * @param models - Array of model names in same order
 * @returns Mapping from "Response X" to model name
 */
export function createLabelToModelMapping(
  labels: string[],
  models: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  labels.forEach((label, i) => {
    mapping[`Response ${label}`] = models[i];
  });
  return mapping;
}
