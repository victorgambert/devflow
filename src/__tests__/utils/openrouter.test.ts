/**
 * OpenRouter Client Tests
 */

import axios from 'axios';
import { callLLM, parseJSONFromLLM } from '../../utils/openrouter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouter Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, OPENROUTER_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('callLLM', () => {
    const mockResponse = {
      data: {
        id: 'test-id',
        choices: [
          {
            message: { role: 'assistant', content: 'test response' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        model: 'test-model',
        created: 1234567890,
        object: 'chat.completion',
      },
    };

    it('should call OpenRouter API with correct parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await callLLM('test-model', [{ role: 'user', content: 'hello' }]);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          model: 'test-model',
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result.content).toBe('test response');
      expect(result.model).toBe('test-model');
      expect(result.usage.totalTokens).toBe(30);
    });

    it('should use custom options when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await callLLM('test-model', [{ role: 'user', content: 'hello' }], {
        maxTokens: 8192,
        temperature: 0.5,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max_tokens: 8192,
          temperature: 0.5,
        }),
        expect.any(Object)
      );
    });

    it('should throw error when API key is missing', async () => {
      process.env.OPENROUTER_API_KEY = '';

      await expect(
        callLLM('model', [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('OPENROUTER_API_KEY environment variable is not set');
    });

    it('should propagate axios errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        callLLM('model', [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Network error');
    });
  });

  describe('parseJSONFromLLM', () => {
    it('should parse direct JSON', () => {
      const result = parseJSONFromLLM<{ key: string }>('{"key": "value"}');
      expect(result.key).toBe('value');
    });

    it('should parse JSON from markdown code block with json tag', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = parseJSONFromLLM<{ key: string }>(input);
      expect(result.key).toBe('value');
    });

    it('should parse JSON from markdown code block without tag', () => {
      const input = '```\n{"key": "value"}\n```';
      const result = parseJSONFromLLM<{ key: string }>(input);
      expect(result.key).toBe('value');
    });

    it('should extract JSON object from mixed content', () => {
      const input = 'Here is the result: {"key": "value"} and more text';
      const result = parseJSONFromLLM<{ key: string }>(input);
      expect(result.key).toBe('value');
    });

    it('should parse complex nested JSON', () => {
      const input = `{
        "summary": "Test",
        "items": ["a", "b", "c"],
        "nested": { "inner": true }
      }`;
      const result = parseJSONFromLLM<{
        summary: string;
        items: string[];
        nested: { inner: boolean };
      }>(input);

      expect(result.summary).toBe('Test');
      expect(result.items).toEqual(['a', 'b', 'c']);
      expect(result.nested.inner).toBe(true);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseJSONFromLLM('not json at all')).toThrow(
        'No valid JSON found in LLM response'
      );
    });

    it('should throw error for malformed JSON', () => {
      expect(() => parseJSONFromLLM('{"key": invalid}')).toThrow(
        'No valid JSON found in LLM response'
      );
    });
  });
});
