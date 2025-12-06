/**
 * OpenRouter API Types
 * Standalone type definitions for the OpenRouter API client
 */

/**
 * Message format for OpenRouter chat completions
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request payload for OpenRouter chat completions API
 */
export interface OpenRouterRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

/**
 * Response from OpenRouter chat completions API
 */
export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  created: number;
  object: string;
}

/**
 * Simplified result from an LLM call
 */
export interface LLMCallResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Options for LLM calls
 */
export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
