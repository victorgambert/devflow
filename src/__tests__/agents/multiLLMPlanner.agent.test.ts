/**
 * Multi-LLM Planner Agent Tests
 */

import { runMultiLLMPlanner } from '../../agents/multiLLMPlanner.agent';
import * as openrouter from '../../utils/openrouter';

jest.mock('../../utils/openrouter');

describe('Multi-LLM Planner Agent', () => {
  const mockCallLLM = openrouter.callLLM as jest.Mock;
  const mockParseJSON = openrouter.parseJSONFromLLM as jest.Mock;

  const originalEnv = process.env;

  const mockRefinedStory = {
    summary: 'Test summary',
    context: 'Test context',
    objectives: ['Objective 1'],
    constraints: ['Constraint 1'],
    dependencies: ['Dependency 1'],
    acceptance_criteria: ['AC 1'],
    risks: ['Risk 1'],
  };

  const mockPlanResponse = {
    architecture_overview: 'Test architecture',
    technical_steps: ['Step 1'],
    tradeoffs: ['Tradeoff 1'],
    risks_and_unknowns: ['Risk 1'],
    implementation_notes: ['Note 1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockCallLLM.mockResolvedValue({
      content: 'mock content',
      model: 'test',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    mockParseJSON.mockReturnValue(mockPlanResponse);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should call all 3 default models in parallel', async () => {
    const result = await runMultiLLMPlanner(mockRefinedStory);

    expect(mockCallLLM).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);

    // Verify each plan has the model field added
    result.forEach((plan) => {
      expect(plan).toHaveProperty('model');
      expect(plan).toHaveProperty('architecture_overview');
      expect(plan).toHaveProperty('technical_steps');
    });
  });

  it('should use custom models from environment variable', async () => {
    process.env.SPEC_ENGINE_PLANNER_MODELS = 'model-a, model-b, model-c';

    const result = await runMultiLLMPlanner(mockRefinedStory);

    expect(mockCallLLM).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);

    // Verify models were called correctly
    expect(mockCallLLM).toHaveBeenNthCalledWith(1, 'model-a', expect.any(Array));
    expect(mockCallLLM).toHaveBeenNthCalledWith(2, 'model-b', expect.any(Array));
    expect(mockCallLLM).toHaveBeenNthCalledWith(3, 'model-c', expect.any(Array));
  });

  it('should trim whitespace from model names', async () => {
    process.env.SPEC_ENGINE_PLANNER_MODELS = '  model-a  ,  model-b  ';

    await runMultiLLMPlanner(mockRefinedStory);

    expect(mockCallLLM).toHaveBeenCalledWith('model-a', expect.any(Array));
    expect(mockCallLLM).toHaveBeenCalledWith('model-b', expect.any(Array));
  });

  it('should include model name in each result', async () => {
    process.env.SPEC_ENGINE_PLANNER_MODELS = 'test-model-1,test-model-2';

    const result = await runMultiLLMPlanner(mockRefinedStory);

    expect(result[0].model).toBe('test-model-1');
    expect(result[1].model).toBe('test-model-2');
  });

  it('should fail fast if any model fails', async () => {
    mockCallLLM
      .mockResolvedValueOnce({ content: 'ok', model: 'test', usage: {} })
      .mockRejectedValueOnce(new Error('Model 2 failed'))
      .mockResolvedValueOnce({ content: 'ok', model: 'test', usage: {} });

    await expect(runMultiLLMPlanner(mockRefinedStory)).rejects.toThrow(
      'Model 2 failed'
    );
  });

  it('should use default models when env var is not set', async () => {
    delete process.env.SPEC_ENGINE_PLANNER_MODELS;

    await runMultiLLMPlanner(mockRefinedStory);

    // Should call 3 default models
    expect(mockCallLLM).toHaveBeenCalledTimes(3);

    // Verify default model names
    expect(mockCallLLM).toHaveBeenCalledWith(
      'anthropic/claude-3.5-sonnet',
      expect.any(Array)
    );
    expect(mockCallLLM).toHaveBeenCalledWith(
      'openai/gpt-4o',
      expect.any(Array)
    );
    expect(mockCallLLM).toHaveBeenCalledWith(
      'google/gemini-2.0-flash-001',
      expect.any(Array)
    );
  });

  it('should pass the refined story to the prompt builder', async () => {
    process.env.SPEC_ENGINE_PLANNER_MODELS = 'test-model';

    await runMultiLLMPlanner(mockRefinedStory);

    // Verify the messages passed to callLLM contain the story info
    const callArgs = mockCallLLM.mock.calls[0];
    const messages = callArgs[1];

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('Test summary');
  });
});
