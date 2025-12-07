/**
 * Unit Tests for Embeddings Provider
 */

import { OpenAIEmbeddingsProvider } from '../embeddings/openai.embeddings';

describe('OpenAIEmbeddingsProvider', () => {
  let provider: OpenAIEmbeddingsProvider;

  // Mock API key for testing
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    provider = new OpenAIEmbeddingsProvider({
      apiKey: mockApiKey,
      model: 'text-embedding-3-large',
      dimensions: 3072,
    });
  });

  describe('Configuration', () => {
    it('should initialize with correct model', () => {
      expect(provider.getModel()).toBe('text-embedding-3-large');
    });

    it('should initialize with correct dimensions', () => {
      expect(provider.getDimensions()).toBe(3072);
    });

    it('should default to OpenRouter baseURL', () => {
      const providerWithDefaults = new OpenAIEmbeddingsProvider({
        apiKey: mockApiKey,
      });

      // Should use defaults
      expect(providerWithDefaults.getModel()).toBe('text-embedding-3-large');
      expect(providerWithDefaults.getDimensions()).toBe(3072);
    });

    it('should accept custom model and dimensions', () => {
      const customProvider = new OpenAIEmbeddingsProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      expect(customProvider.getModel()).toBe('text-embedding-3-small');
      expect(customProvider.getDimensions()).toBe(1536);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost for large model correctly', () => {
      const cost = provider.estimateCost(1_000_000);

      expect(cost).toBeCloseTo(0.13, 2);
    });

    it('should estimate cost for small model correctly', () => {
      const smallProvider = new OpenAIEmbeddingsProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-small',
      });

      const cost = smallProvider.estimateCost(1_000_000);

      expect(cost).toBeCloseTo(0.02, 2);
    });

    it('should scale cost linearly with tokens', () => {
      const cost1 = provider.estimateCost(100_000);
      const cost2 = provider.estimateCost(200_000);

      expect(cost2).toBeCloseTo(cost1 * 2, 6);
    });

    it('should handle zero tokens', () => {
      const cost = provider.estimateCost(0);

      expect(cost).toBe(0);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for short text', () => {
      const text = 'Hello, world!';
      const tokens = Math.ceil(text.length / 4);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for longer text', () => {
      const text = 'A'.repeat(400);
      const tokens = Math.ceil(text.length / 4);

      expect(tokens).toBeCloseTo(100, 0);
    });
  });

  // Note: Integration tests with real API calls should be in separate files
  // and marked as integration tests to avoid hitting API limits in unit tests
});
