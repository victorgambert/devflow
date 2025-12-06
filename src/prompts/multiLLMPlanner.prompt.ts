/**
 * Multi-LLM Planner Prompt Template
 * Stage 2: Generate implementation plan from refined user story
 */

import { Message } from '../types/openrouter.types';
import { RefinedUserStory } from '../types/spec.types';

/**
 * Build the prompt messages for generating an implementation plan
 *
 * @param refinedStory - Structured user story from Stage 1
 * @returns Array of messages for the LLM
 */
export function buildMultiLLMPlannerPrompt(refinedStory: RefinedUserStory): Message[] {
  return [
    {
      role: 'system',
      content: `You are a senior software architect creating an implementation plan. Analyze the refined user story and provide a detailed technical plan.

Return your response as valid JSON matching this exact structure:
{
  "architecture_overview": "High-level architecture description explaining the system design",
  "technical_steps": ["Step 1: Detailed description", "Step 2: Detailed description"],
  "tradeoffs": ["Tradeoff 1: X vs Y, chose X because...", "Tradeoff 2: explanation"],
  "risks_and_unknowns": ["Risk 1 with proposed mitigation", "Unknown 1 requiring investigation"],
  "implementation_notes": ["Important note 1", "Best practice recommendation 2"]
}

Guidelines:
- Focus on practical, implementable solutions
- Consider scalability, maintainability, and testing
- Be specific about technologies and approaches
- Explain the reasoning behind key decisions
- Order technical steps logically for implementation`,
    },
    {
      role: 'user',
      content: `Create an implementation plan for the following refined user story:

## Summary
${refinedStory.summary}

## Context
${refinedStory.context}

## Objectives
${refinedStory.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## Constraints
${refinedStory.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Dependencies
${refinedStory.dependencies.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Acceptance Criteria
${refinedStory.acceptance_criteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

## Known Risks
${refinedStory.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Provide a comprehensive implementation plan addressing all objectives while respecting the constraints.`,
    },
  ];
}
