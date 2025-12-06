/**
 * Perplexity Research Prompt Template
 * Stage 3: Research best practices and industry insights
 */

import { Message } from '../types/openrouter.types';
import { RefinedUserStory, MultiLLMPlan } from '../types/spec.types';

/**
 * Build the prompt messages for researching implementation best practices
 *
 * @param refinedStory - Structured user story from Stage 1
 * @param plans - Implementation plans from Stage 2
 * @returns Array of messages for the LLM
 */
export function buildPerplexityResearchPrompt(
  refinedStory: RefinedUserStory,
  plans: MultiLLMPlan[]
): Message[] {
  const architectures = plans
    .map((p) => `- ${p.model}: ${p.architecture_overview}`)
    .join('\n');

  const allTechnologies = new Set<string>();
  plans.forEach((plan) => {
    plan.technical_steps.forEach((step) => {
      // Extract technology mentions (simplified extraction)
      const techMatches = step.match(/\b[A-Z][a-z]+(?:\.[A-Za-z]+)*\b/g);
      if (techMatches) {
        techMatches.forEach((t) => allTechnologies.add(t));
      }
    });
  });

  return [
    {
      role: 'system',
      content: `You are a technical researcher with access to current web information. Search for and synthesize relevant information about implementation approaches, best practices, and potential pitfalls.

Return your response as valid JSON matching this exact structure:
{
  "best_practices": ["Best practice 1 with source context", "Best practice 2 with rationale"],
  "patterns": ["Design pattern 1 applicable to this project", "Architectural pattern 2"],
  "pitfalls": ["Common pitfall 1 to avoid", "Anti-pattern 2 with explanation"],
  "benchmarks": ["Performance benchmark 1", "Scalability consideration 2"],
  "recommendations": ["Specific recommendation 1 based on research", "Recommendation 2"]
}

Guidelines:
- Focus on recent, relevant information (2023-2024 preferred)
- Cite specific technologies, libraries, or frameworks when applicable
- Prioritize practical, actionable insights
- Include performance and scalability considerations
- Reference real-world implementations or case studies when available`,
    },
    {
      role: 'user',
      content: `Research implementation approaches for the following project:

## Project Summary
${refinedStory.summary}

## Context
${refinedStory.context}

## Proposed Architectures from Different Models
${architectures}

## Key Technologies/Dependencies
${[...refinedStory.dependencies, ...Array.from(allTechnologies)].join(', ')}

## Areas to Research
1. Best practices for this type of implementation
2. Common design patterns applicable to this use case
3. Known pitfalls and anti-patterns to avoid
4. Performance benchmarks and scalability considerations
5. Specific recommendations based on current industry standards

Focus on providing actionable insights that can improve the implementation quality.`,
    },
  ];
}
