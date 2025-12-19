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
  CouncilSummary,
} from '@devflow/common';
import { createCodeAgentDriver, loadPrompts, createCouncilService } from '@devflow/sdk';

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
  council?: CouncilSummary;
}

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

    // Generate with AI (council or single model)
    const useCouncil = process.env.ENABLE_COUNCIL === 'true';

    if (useCouncil) {
      logger.info('Using LLM Council for user story');

      const councilModels = process.env.COUNCIL_MODELS
        ? process.env.COUNCIL_MODELS.split(',').map((m) => m.trim())
        : ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp'];

      const council = createCouncilService(
        process.env.OPENROUTER_API_KEY || '',
        {
          enabled: true,
          models: councilModels,
          chairmanModel: process.env.COUNCIL_CHAIRMAN_MODEL || 'anthropic/claude-sonnet-4',
          timeout: parseInt(process.env.COUNCIL_TIMEOUT || '120000'),
        }
      );

      const result = await council.deliberate<UserStoryGenerationOutput>(
        prompts,
        parseUserStoryResponse
      );

      logger.info('Council user story generation complete', {
        topRankedModel: result.summary.topRankedModel,
        agreementLevel: result.summary.agreementLevel,
      });

      return {
        userStory: result.finalOutput,
        council: result.summary,
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

