/**
 * OpenRouter API Client
 * Reusable client for making LLM calls via OpenRouter
 */

import axios from 'axios';
import {
  Message,
  OpenRouterResponse,
  LLMCallResult,
  LLMCallOptions,
} from '../types/openrouter.types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call an LLM model via OpenRouter
 *
 * @param model - The model identifier (e.g., 'openai/gpt-4.1-mini')
 * @param messages - Array of messages in the conversation
 * @param options - Optional parameters for the call
 * @returns Promise resolving to the LLM response
 * @throws Error if API key is missing or API call fails
 */
export async function callLLM(
  model: string,
  messages: Message[],
  options?: LLMCallOptions
): Promise<LLMCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  try {
    const response = await axios.post<OpenRouterResponse>(
      OPENROUTER_ENDPOINT,
      {
        model,
        messages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://soma-squad-ai.dev',
          'X-Title': 'Soma Spec Engine',
        },
      }
    );

    const data = response.data;

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  } catch (error: any) {
    // Enhanced error logging for OpenRouter API errors
    if (error.response?.data) {
      console.error('OpenRouter API Error:', JSON.stringify(error.response.data, null, 2));
      const errorMsg = error.response.data.error?.message || JSON.stringify(error.response.data.error);
      throw new Error(`OpenRouter API Error (${model}): ${errorMsg}`);
    }
    throw error;
  }
}

/**
 * Parse JSON from an LLM response
 * Handles various output formats: direct JSON, markdown code blocks, embedded objects
 *
 * @param content - Raw string content from the LLM
 * @returns Parsed JSON object
 * @throws Error if no valid JSON is found
 */
export function parseJSONFromLLM<T>(content: string): T {
  // Try direct parse first
  try {
    return JSON.parse(content);
  } catch {
    // Not direct JSON, continue to other methods
  }

  // Try extracting from markdown code block (```json ... ``` or ``` ... ```)
  const jsonCodeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonCodeBlockMatch) {
    try {
      return JSON.parse(jsonCodeBlockMatch[1].trim());
    } catch {
      // Not valid JSON in code block, continue
    }
  }

  // Try finding raw JSON object in the content
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // Found something that looks like JSON but isn't valid
    }
  }

  throw new Error('No valid JSON found in LLM response');
}
