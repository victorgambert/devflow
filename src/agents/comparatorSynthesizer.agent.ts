/**
 * Comparator & Synthesizer Agent
 * Stage 4: Synthesize all inputs into the final Master Plan
 */

import { callLLM, parseJSONFromLLM } from '../utils/openrouter';
import { buildComparatorSynthesizerPrompt } from '../prompts/comparatorSynthesizer.prompt';
import {
  RefinedUserStory,
  MultiLLMPlan,
  ResearchInsights,
  MasterPlan,
} from '../types/spec.types';

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'; // Best synthesis & reasoning

/**
 * Run the comparator and synthesizer stage
 * Analyzes all previous stage outputs and creates the definitive Master Plan
 *
 * @param refinedStory - Structured user story from Stage 1
 * @param plans - Implementation plans from Stage 2
 * @param research - Research insights from Stage 3
 * @returns Promise resolving to the synthesized Master Plan
 */
export async function runComparatorSynthesizer(
  refinedStory: RefinedUserStory,
  plans: MultiLLMPlan[],
  research: ResearchInsights
): Promise<MasterPlan> {
  const model = process.env.SPEC_ENGINE_SYNTHESIZER_MODEL || DEFAULT_MODEL;
  const messages = buildComparatorSynthesizerPrompt(refinedStory, plans, research);

  // Use larger max tokens for the comprehensive Master Plan output
  const result = await callLLM(model, messages, { maxTokens: 8192 });
  return parseJSONFromLLM<MasterPlan>(result.content);
}
