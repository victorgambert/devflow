/**
 * Perplexity Research Agent
 * Stage 3: Research best practices and industry insights using Perplexity
 */

import { callLLM, parseJSONFromLLM } from '../utils/openrouter';
import { buildPerplexityResearchPrompt } from '../prompts/perplexityResearch.prompt';
import { RefinedUserStory, MultiLLMPlan, ResearchInsights } from '../types/spec.types';

const DEFAULT_MODEL = 'perplexity/sonar-pro';

/**
 * Run the Perplexity research stage
 * Gathers best practices, patterns, and recommendations from web research
 *
 * @param refinedStory - Structured user story from Stage 1
 * @param plans - Implementation plans from Stage 2
 * @returns Promise resolving to research insights
 */
export async function runPerplexityResearch(
  refinedStory: RefinedUserStory,
  plans: MultiLLMPlan[]
): Promise<ResearchInsights> {
  const model = process.env.SPEC_ENGINE_RESEARCH_MODEL || DEFAULT_MODEL;
  const messages = buildPerplexityResearchPrompt(refinedStory, plans);

  const result = await callLLM(model, messages);
  return parseJSONFromLLM<ResearchInsights>(result.content);
}
