/**
 * Embeddings Provider Interface
 * Defines the contract for embedding generation services
 */

export interface EmbeddingsProvider {
  /**
   * Generate embedding for a single text
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimensions of the embeddings
   */
  getDimensions(): number;

  /**
   * Get the model name/identifier
   */
  getModel(): string;

  /**
   * Estimate cost based on token count
   */
  estimateCost(tokenCount: number): number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  cost: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
  totalCost: number;
}
