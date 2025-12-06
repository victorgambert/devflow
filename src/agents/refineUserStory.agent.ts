/**
 * Refine User Story Agent
 * Stage 1: Transform raw user story into structured specification
 */

import { callLLM, parseJSONFromLLM } from '../utils/openrouter';
import { buildRefineUserStoryPrompt } from '../prompts/refineUserStory.prompt';
import { RefinedUserStory } from '../types/spec.types';

const DEFAULT_MODEL = 'openai/gpt-4o-mini'; // Fast and efficient for initial refinement

/**
 * Refine a raw user story into a structured specification
 *
 * @param userStory - Raw user story text
 * @returns Promise resolving to the refined, structured user story
 */
export async function refineUserStory(userStory: string): Promise<RefinedUserStory> {
  const model = process.env.SPEC_ENGINE_REFINE_MODEL || DEFAULT_MODEL;
  const messages = buildRefineUserStoryPrompt(userStory);

  const result = await callLLM(model, messages);
  return parseJSONFromLLM<RefinedUserStory>(result.content);
}
