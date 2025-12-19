/**
 * Unit Tests for Ranking Parser
 *
 * Tests the core ranking extraction and aggregation logic
 * for the LLM Council deliberation system.
 */

import {
  parseRankingFromText,
  calculateAggregateRankings,
  createAnonymousLabels,
  createLabelToModelMapping,
} from '../ranking-parser';
import type { CouncilRanking } from '@devflow/common';

describe('ranking-parser', () => {
  describe('parseRankingFromText', () => {
    it('should parse numbered FINAL RANKING format', () => {
      const text = `
I've analyzed all responses carefully.

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Response C provides the most comprehensive solution.
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response C', 'Response A', 'Response B']);
    });

    it('should parse FINAL RANKING without numbers', () => {
      const text = `
After evaluation:

FINAL RANKING:
Response B
Response C
Response A

The ranking is based on completeness.
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response B', 'Response C', 'Response A']);
    });

    it('should handle FINAL RANKING with extra whitespace', () => {
      const text = `
FINAL RANKING:

  1.  Response A
  2.  Response B
  3.  Response C
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response A', 'Response B', 'Response C']);
    });

    it('should fallback to any Response X patterns when no FINAL RANKING section', () => {
      const text = `
I rank Response B as the best, followed by Response A, and finally Response C.
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response B', 'Response A', 'Response C']);
    });

    it('should return empty array when no responses found', () => {
      const text = 'This text has no rankings at all.';

      const result = parseRankingFromText(text);

      expect(result).toEqual([]);
    });

    it('should handle mixed case in surrounding text', () => {
      const text = `
FINAL RANKING:
1. Response A - excellent solution
2. Response B - good approach
3. Response C - needs improvement
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response A', 'Response B', 'Response C']);
    });

    it('should handle duplicate mentions in FINAL RANKING section', () => {
      const text = `
FINAL RANKING:
1. Response A (best)
2. Response B (good)

Note: Response A was clearly superior to Response B.
      `;

      const result = parseRankingFromText(text);

      // Should get the numbered ones first
      expect(result.slice(0, 2)).toEqual(['Response A', 'Response B']);
    });

    it('should handle single response', () => {
      const text = `
FINAL RANKING:
1. Response A
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual(['Response A']);
    });

    it('should handle many responses (A-Z)', () => {
      const text = `
FINAL RANKING:
1. Response D
2. Response A
3. Response E
4. Response B
5. Response C
      `;

      const result = parseRankingFromText(text);

      expect(result).toEqual([
        'Response D',
        'Response A',
        'Response E',
        'Response B',
        'Response C',
      ]);
    });
  });

  describe('calculateAggregateRankings', () => {
    const labelToModel: Record<string, string> = {
      'Response A': 'anthropic/claude-sonnet-4',
      'Response B': 'openai/gpt-4o',
      'Response C': 'google/gemini-2.0-flash-exp',
    };

    it('should calculate correct average rankings', () => {
      const rankings: CouncilRanking[] = [
        {
          model: 'anthropic/claude-sonnet-4',
          rawText: '',
          parsedRanking: ['Response A', 'Response B', 'Response C'],
        },
        {
          model: 'openai/gpt-4o',
          rawText: '',
          parsedRanking: ['Response A', 'Response C', 'Response B'],
        },
        {
          model: 'google/gemini-2.0-flash-exp',
          rawText: '',
          parsedRanking: ['Response B', 'Response A', 'Response C'],
        },
      ];

      const result = calculateAggregateRankings(rankings, labelToModel);

      // Claude: positions 1, 1, 2 = avg 1.33
      // GPT-4: positions 2, 3, 1 = avg 2.00
      // Gemini: positions 3, 2, 3 = avg 2.67
      expect(result[0].model).toBe('anthropic/claude-sonnet-4');
      expect(result[0].averageRank).toBeCloseTo(1.33, 1);
      expect(result[0].rankingsCount).toBe(3);

      expect(result[1].model).toBe('openai/gpt-4o');
      expect(result[1].averageRank).toBeCloseTo(2.0, 1);

      expect(result[2].model).toBe('google/gemini-2.0-flash-exp');
      expect(result[2].averageRank).toBeCloseTo(2.67, 1);
    });

    it('should handle unanimous rankings', () => {
      const rankings: CouncilRanking[] = [
        {
          model: 'model1',
          rawText: '',
          parsedRanking: ['Response A', 'Response B', 'Response C'],
        },
        {
          model: 'model2',
          rawText: '',
          parsedRanking: ['Response A', 'Response B', 'Response C'],
        },
        {
          model: 'model3',
          rawText: '',
          parsedRanking: ['Response A', 'Response B', 'Response C'],
        },
      ];

      const result = calculateAggregateRankings(rankings, labelToModel);

      expect(result[0].averageRank).toBe(1);
      expect(result[1].averageRank).toBe(2);
      expect(result[2].averageRank).toBe(3);
    });

    it('should handle partial rankings (some models missing)', () => {
      const rankings: CouncilRanking[] = [
        {
          model: 'model1',
          rawText: '',
          parsedRanking: ['Response A', 'Response B'], // Missing C
        },
        {
          model: 'model2',
          rawText: '',
          parsedRanking: ['Response A', 'Response B', 'Response C'],
        },
      ];

      const result = calculateAggregateRankings(rankings, labelToModel);

      // Claude: 2 votes, GPT: 2 votes, Gemini: 1 vote
      const claude = result.find((r) => r.model === 'anthropic/claude-sonnet-4');
      const gpt = result.find((r) => r.model === 'openai/gpt-4o');
      const gemini = result.find((r) => r.model === 'google/gemini-2.0-flash-exp');

      expect(claude?.rankingsCount).toBe(2);
      expect(gpt?.rankingsCount).toBe(2);
      expect(gemini?.rankingsCount).toBe(1);
    });

    it('should handle empty rankings array', () => {
      const result = calculateAggregateRankings([], labelToModel);

      expect(result).toEqual([]);
    });

    it('should handle unknown labels gracefully', () => {
      const rankings: CouncilRanking[] = [
        {
          model: 'model1',
          rawText: '',
          parsedRanking: ['Response X', 'Response Y'], // Unknown labels
        },
      ];

      const result = calculateAggregateRankings(rankings, labelToModel);

      // Should ignore unknown labels
      expect(result).toEqual([]);
    });

    it('should sort by average rank ascending (best first)', () => {
      const rankings: CouncilRanking[] = [
        {
          model: 'model1',
          rawText: '',
          parsedRanking: ['Response C', 'Response B', 'Response A'],
        },
        {
          model: 'model2',
          rawText: '',
          parsedRanking: ['Response C', 'Response A', 'Response B'],
        },
      ];

      const result = calculateAggregateRankings(rankings, labelToModel);

      // Gemini should be first (positions 1, 1)
      expect(result[0].model).toBe('google/gemini-2.0-flash-exp');
      expect(result[0].averageRank).toBe(1);
    });
  });

  describe('createAnonymousLabels', () => {
    it('should create labels A, B, C for 3 responses', () => {
      const labels = createAnonymousLabels(3);

      expect(labels).toEqual(['A', 'B', 'C']);
    });

    it('should create single label for 1 response', () => {
      const labels = createAnonymousLabels(1);

      expect(labels).toEqual(['A']);
    });

    it('should handle 26 responses (A-Z)', () => {
      const labels = createAnonymousLabels(26);

      expect(labels[0]).toBe('A');
      expect(labels[25]).toBe('Z');
      expect(labels.length).toBe(26);
    });

    it('should return empty array for 0 responses', () => {
      const labels = createAnonymousLabels(0);

      expect(labels).toEqual([]);
    });

    it('should handle negative numbers gracefully', () => {
      const labels = createAnonymousLabels(-1);

      expect(labels).toEqual([]);
    });
  });

  describe('createLabelToModelMapping', () => {
    it('should create correct mapping', () => {
      const labels = ['A', 'B', 'C'];
      const models = [
        'anthropic/claude-sonnet-4',
        'openai/gpt-4o',
        'google/gemini-2.0-flash-exp',
      ];

      const mapping = createLabelToModelMapping(labels, models);

      expect(mapping).toEqual({
        'Response A': 'anthropic/claude-sonnet-4',
        'Response B': 'openai/gpt-4o',
        'Response C': 'google/gemini-2.0-flash-exp',
      });
    });

    it('should handle single model', () => {
      const labels = ['A'];
      const models = ['model1'];

      const mapping = createLabelToModelMapping(labels, models);

      expect(mapping).toEqual({
        'Response A': 'model1',
      });
    });

    it('should handle empty arrays', () => {
      const mapping = createLabelToModelMapping([], []);

      expect(mapping).toEqual({});
    });

    it('should handle mismatched array lengths (takes minimum)', () => {
      const labels = ['A', 'B', 'C'];
      const models = ['model1', 'model2']; // One less

      const mapping = createLabelToModelMapping(labels, models);

      // Only A and B should be mapped
      expect(mapping['Response A']).toBe('model1');
      expect(mapping['Response B']).toBe('model2');
      expect(mapping['Response C']).toBeUndefined();
    });
  });
});
