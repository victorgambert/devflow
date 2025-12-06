/**
 * Multi-LLM Planner Agent
 * Stage 2: Generate implementation plans from multiple models in parallel
 */

import { callLLM, parseJSONFromLLM } from '../utils/openrouter';
import { buildMultiLLMPlannerPrompt } from '../prompts/multiLLMPlanner.prompt';
import { RefinedUserStory, MultiLLMPlan } from '../types/spec.types';

const DEFAULT_MODELS = [
  'anthropic/claude-3.5-sonnet',    // Best for architecture & reasoning
  'openai/gpt-4o',                   // Multimodal capabilities, strong coding
  'google/gemini-2.0-flash-001',     // Fast Google model with good reasoning
];

/**
 * Run the multi-LLM planner stage
 * Calls all configured models in parallel and collects their implementation plans
 *
 * @param refinedStory - Structured user story from Stage 1
 * @returns Promise resolving to array of plans from each model
 */
export async function runMultiLLMPlanner(
  refinedStory: RefinedUserStory
): Promise<MultiLLMPlan[]> {
  const modelsEnv = process.env.SPEC_ENGINE_PLANNER_MODELS;
  const models = modelsEnv ? modelsEnv.split(',').map((m) => m.trim()) : DEFAULT_MODELS;

  const messages = buildMultiLLMPlannerPrompt(refinedStory);

  // Run all models in parallel
  const planPromises = models.map(async (model) => {
    const result = await callLLM(model, messages);
    const plan = parseJSONFromLLM<Omit<MultiLLMPlan, 'model'>>(result.content);
    return {
      model,
      ...plan,
    };
  });

  return Promise.all(planPromises);
}
