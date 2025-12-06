/**
 * Refine User Story Prompt Template
 * Stage 1: Transform raw user story into structured specification
 */

import { Message } from '../types/openrouter.types';

/**
 * Build the prompt messages for refining a user story
 *
 * @param userStory - Raw user story text
 * @returns Array of messages for the LLM
 */
export function buildRefineUserStoryPrompt(userStory: string): Message[] {
  return [
    {
      role: 'system',
      content: `You are a senior software architect and product analyst. Your task is to analyze raw user stories and transform them into structured, detailed specifications.

Return your response as valid JSON matching this exact structure:
{
  "summary": "A clear, concise summary of the user story",
  "context": "Background context and domain information",
  "objectives": ["Primary objective 1", "Primary objective 2"],
  "constraints": ["Technical constraint 1", "Business constraint 2"],
  "dependencies": ["External dependency 1", "Internal dependency 2"],
  "acceptance_criteria": ["AC1: Given/When/Then format", "AC2: Given/When/Then format"],
  "risks": ["Risk 1 with potential impact", "Risk 2 with potential impact"]
}

Guidelines:
- Be thorough but concise
- Focus on actionable, measurable criteria
- Identify implicit requirements that may not be explicitly stated
- Consider edge cases and potential issues
- Use Given/When/Then format for acceptance criteria when applicable`,
    },
    {
      role: 'user',
      content: `Analyze and refine the following user story into a structured specification:

---
${userStory}
---

Provide a comprehensive breakdown with:
1. A clear summary capturing the essence of the request
2. Context explaining the domain and background
3. Specific, measurable objectives
4. Technical and business constraints
5. External and internal dependencies
6. Testable acceptance criteria
7. Potential risks and their impacts`,
    },
  ];
}
