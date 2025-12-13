/**
 * User Story Activities - Phase 2 of Three-Phase Agile Workflow
 *
 * Generates formal user stories from refined requirements.
 * Focus: User story format, acceptance criteria, definition of done, story points
 */

import { createLogger } from '@devflow/common';
import type {
  RefinementOutput,
  UserStoryGenerationOutput,
} from '@devflow/common';
import { createCodeAgentDriver, loadPrompts } from '@devflow/sdk';

const logger = createLogger('UserStoryActivities');

export interface GenerateUserStoryInput {
  task: {
    title: string;
    description: string;
    priority: string;
  };
  refinement: RefinementOutput;
  projectId: string;
}

export interface GenerateUserStoryOutput {
  userStory: UserStoryGenerationOutput;
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
    }>;
    bestModel: string;
    detailedExplanation: string;
  };
}

const MULTI_LLM_MODELS = [
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o',
  'google/gemini-2.0-flash-exp',
];

/**
 * Generate user story from refinement using AI
 */
export async function generateUserStory(
  input: GenerateUserStoryInput
): Promise<GenerateUserStoryOutput> {
  logger.info('Generating user story', {
    taskTitle: input.task.title,
    projectId: input.projectId,
  });

  try {
    // Load prompts with refinement context
    const prompts = await loadPrompts('user-story', {
      taskTitle: input.task.title,
      taskPriority: input.task.priority,
      refinementContext: input.refinement.businessContext,
      refinementObjectives: input.refinement.objectives.join('\n- '),
    });

    // Generate with AI (multi-LLM or single model)
    const useMultiLLM = process.env.ENABLE_MULTI_LLM === 'true';

    if (useMultiLLM) {
      logger.info('Using multi-LLM generation for user story');

      const results = await Promise.all(
        MULTI_LLM_MODELS.map(async (model) => {
          try {
            const agent = createCodeAgentDriver({
              provider: 'openrouter',
              apiKey: process.env.OPENROUTER_API_KEY || '',
              model,
            });

            const response = await agent.generate(prompts);
            const userStory = parseUserStoryResponse(response.content);
            const score = scoreUserStory(userStory);

            logger.info(`User story generated with ${model}`, { score });

            return {
              model,
              userStory,
              score,
            };
          } catch (error) {
            logger.error(`Failed to generate user story with ${model}`, error);
            throw error;
          }
        })
      );

      // Select best result
      const best = results.reduce((best, curr) =>
        curr.score > best.score ? curr : best
      );

      logger.info('Multi-LLM user story generation complete', {
        bestModel: best.model,
        bestScore: best.score,
      });

      return {
        userStory: best.userStory,
        multiLLM: {
          models: results.map((r) => ({ model: r.model, score: r.score })),
          bestModel: best.model,
          detailedExplanation: formatMultiLLMExplanation(results),
        },
      };
    } else {
      // Single model generation
      logger.info('Using single model generation for user story');

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      const response = await agent.generate(prompts);
      const userStory = parseUserStoryResponse(response.content);

      logger.info('User story generated successfully');

      return { userStory };
    }
  } catch (error) {
    logger.error('Failed to generate user story', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into UserStoryGenerationOutput
 */
function parseUserStoryResponse(content: string): UserStoryGenerationOutput {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      userStory: {
        actor: parsed.userStory?.actor || 'user',
        goal: parsed.userStory?.goal || '',
        benefit: parsed.userStory?.benefit || '',
      },
      acceptanceCriteria: parsed.acceptanceCriteria || [],
      definitionOfDone: parsed.definitionOfDone || [],
      businessValue: parsed.businessValue || '',
      storyPoints: parsed.storyPoints || 5,
    };
  } catch (error) {
    logger.error('Failed to parse user story response', error as Error, { content });
    throw new Error(
      `Failed to parse user story JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Score user story quality (0-100)
 */
function scoreUserStory(story: UserStoryGenerationOutput): number {
  let score = 0;

  // User story components (60 points total)
  if (story.userStory.actor && story.userStory.actor.length > 3) {
    score += 20;
  }
  if (story.userStory.goal && story.userStory.goal.length > 10) {
    score += 20;
  }
  if (story.userStory.benefit && story.userStory.benefit.length > 10) {
    score += 20;
  }

  // Acceptance criteria (20 points)
  if (story.acceptanceCriteria.length >= 4) {
    score += 20;
  } else if (story.acceptanceCriteria.length >= 3) {
    score += 15;
  } else if (story.acceptanceCriteria.length >= 2) {
    score += 10;
  }

  // Definition of done (10 points)
  if (story.definitionOfDone.length >= 3) {
    score += 10;
  } else if (story.definitionOfDone.length >= 2) {
    score += 7;
  } else if (story.definitionOfDone.length >= 1) {
    score += 5;
  }

  // Business value (10 points)
  if (story.businessValue && story.businessValue.length > 20) {
    score += 10;
  } else if (story.businessValue) {
    score += 5;
  }

  return score;
}

/**
 * Format multi-LLM comparison explanation
 */
function formatMultiLLMExplanation(
  results: Array<{
    model: string;
    userStory: UserStoryGenerationOutput;
    score: number;
  }>
): string {
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  let explanation = `## Multi-LLM User Story Analysis\n\n`;
  explanation += `Generated user stories from ${results.length} AI models and selected the best result.\n\n`;

  explanation += `### Model Scores\n\n`;
  sortedResults.forEach((result, index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    explanation += `${emoji} **${result.model}**: ${result.score}/100\n`;
    explanation += `   - Story Points: ${result.userStory.storyPoints}\n`;
    explanation += `   - Acceptance Criteria: ${result.userStory.acceptanceCriteria.length}\n`;
  });

  explanation += `\n### Selection Criteria\n\n`;
  explanation += `- Complete user story format (60 points)\n`;
  explanation += `  - Actor clarity (20 points)\n`;
  explanation += `  - Goal specificity (20 points)\n`;
  explanation += `  - Benefit explanation (20 points)\n`;
  explanation += `- Number and quality of acceptance criteria (20 points)\n`;
  explanation += `- Definition of done completeness (10 points)\n`;
  explanation += `- Business value explanation (10 points)\n\n`;

  const best = sortedResults[0];
  explanation += `**Selected model:** ${best.model} achieved the highest score with `;
  explanation += `${best.userStory.acceptanceCriteria.length} acceptance criteria `;
  explanation += `and ${best.userStory.storyPoints} story points.`;

  return explanation;
}
