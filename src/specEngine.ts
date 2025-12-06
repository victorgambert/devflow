/**
 * Soma Spec Engine - Main Orchestrator
 *
 * Transforms raw user stories into comprehensive Master Plans
 * using a multi-LLM pipeline via OpenRouter.
 *
 * Pipeline Stages:
 * 1. Refine User Story - Structure and clarify the raw input (ACTIVE)
 * 2. Multi-LLM Planner - Get implementation plans from multiple models (DISABLED)
 * 3. Perplexity Research - Gather best practices and insights (DISABLED)
 * 4. Comparator & Synthesizer - Create the definitive Master Plan (DISABLED)
 */

import { RefinedUserStory } from './types/spec.types';
import { refineUserStory } from './agents/refineUserStory.agent';
// import { runMultiLLMPlanner } from './agents/multiLLMPlanner.agent';
// import { runPerplexityResearch } from './agents/perplexityResearch.agent';
// import { runComparatorSynthesizer } from './agents/comparatorSynthesizer.agent';

/**
 * Phase 1 Output - Only refined user story for now
 */
export interface Phase1Output {
  refined_user_story: RefinedUserStory;
}

/**
 * Generate a refined specification from a raw user story
 *
 * Currently only runs Stage 1: Refine User Story
 *
 * @param userStory - Raw user story text describing the feature/requirement
 * @returns Promise resolving to refined user story
 * @throws Error if user story is empty or stage fails
 *
 * @example
 * ```typescript
 * const result = await generateSpecification(`
 *   As a user, I want to be able to upload images to my profile
 *   so that other users can see my avatar.
 * `);
 * console.log(result.refined_user_story.summary);
 * ```
 */
export async function generateSpecification(userStory: string): Promise<Phase1Output> {
  // Validate input
  if (!userStory || userStory.trim().length === 0) {
    throw new Error('User story cannot be empty');
  }

  // Stage 1: Refine the user story
  const refinedUserStory = await refineUserStory(userStory);

  // TODO: Stages 2-4 disabled for now
  // const multiLLMPlans = await runMultiLLMPlanner(refinedUserStory);
  // const researchInsights = await runPerplexityResearch(refinedUserStory, multiLLMPlans);
  // const masterPlan = await runComparatorSynthesizer(refinedUserStory, multiLLMPlans, researchInsights);

  return {
    refined_user_story: refinedUserStory,
  };
}

// Re-export types for consumers
export * from './types/spec.types';
export * from './types/openrouter.types';

// Re-export individual stage functions for advanced usage
export { refineUserStory } from './agents/refineUserStory.agent';
export { runMultiLLMPlanner } from './agents/multiLLMPlanner.agent';
export { runPerplexityResearch } from './agents/perplexityResearch.agent';
export { runComparatorSynthesizer } from './agents/comparatorSynthesizer.agent';

// Re-export utilities
export { callLLM, parseJSONFromLLM } from './utils/openrouter';
