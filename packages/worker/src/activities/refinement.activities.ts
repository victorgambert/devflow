/**
 * Refinement Activities - Phase 1 of Three-Phase Agile Workflow
 *
 * Generates backlog refinement to clarify business requirements.
 * Focus: Business context, objectives, questions for PO, complexity estimation
 */

import { createLogger } from '@devflow/common';
import type { RefinementOutput } from '@devflow/common/types/agent.types';
import { createCodeAgentDriver } from '@devflow/sdk';
import { loadPrompts } from '@devflow/sdk/agents/prompts/prompt-loader';
import { detectTaskType } from './helpers/task-type-detector';

const logger = createLogger('RefinementActivities');

export interface GenerateRefinementInput {
  task: {
    title: string;
    description: string;
    priority: string;
    labels?: string[];
  };
  projectId: string;
}

export interface GenerateRefinementOutput {
  refinement: RefinementOutput;
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
 * Generate refinement for a task using AI
 */
export async function generateRefinement(
  input: GenerateRefinementInput
): Promise<GenerateRefinementOutput> {
  logger.info('Generating refinement', {
    taskTitle: input.task.title,
    projectId: input.projectId,
  });

  try {
    // Step 1: Detect task type
    const taskType = detectTaskType(input.task);
    logger.info('Task type detected', { taskType });

    // Step 2: Load prompts from markdown files
    const prompts = await loadPrompts('refinement', {
      taskTitle: input.task.title,
      taskDescription: input.task.description || 'No description provided',
      taskPriority: input.task.priority,
    });

    // Step 3: Generate refinement with AI
    const useMultiLLM = process.env.ENABLE_MULTI_LLM === 'true';

    if (useMultiLLM) {
      logger.info('Using multi-LLM generation for refinement');

      const results = await Promise.all(
        MULTI_LLM_MODELS.map(async (model) => {
          try {
            const agent = createCodeAgentDriver({
              provider: 'openrouter',
              apiKey: process.env.OPENROUTER_API_KEY || '',
              model,
            });

            const response = await agent.generate(prompts);
            const parsed = parseRefinementResponse(response.content);
            const score = scoreRefinement(parsed);

            logger.info(`Refinement generated with ${model}`, { score });

            return {
              model,
              refinement: parsed,
              score,
            };
          } catch (error) {
            logger.error(`Failed to generate refinement with ${model}`, error);
            throw error;
          }
        })
      );

      // Select best result
      const best = results.reduce((best, curr) =>
        curr.score > best.score ? curr : best
      );

      logger.info('Multi-LLM refinement complete', {
        bestModel: best.model,
        bestScore: best.score,
        allScores: results.map((r) => ({ model: r.model, score: r.score })),
      });

      return {
        refinement: {
          ...best.refinement,
          taskType,
        },
        multiLLM: {
          models: results.map((r) => ({ model: r.model, score: r.score })),
          bestModel: best.model,
          detailedExplanation: formatMultiLLMExplanation(results),
        },
      };
    } else {
      // Single model generation
      logger.info('Using single model generation for refinement');

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      const response = await agent.generate(prompts);
      const refinement = parseRefinementResponse(response.content);

      logger.info('Refinement generated successfully', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      return {
        refinement: {
          ...refinement,
          taskType,
        },
      };
    }
  } catch (error) {
    logger.error('Failed to generate refinement', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into RefinementOutput (without taskType)
 */
function parseRefinementResponse(
  content: string
): Omit<RefinementOutput, 'taskType'> {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      businessContext: parsed.businessContext || '',
      objectives: parsed.objectives || [],
      questionsForPO: parsed.questionsForPO,
      suggestedSplit: parsed.suggestedSplit,
      preliminaryAcceptanceCriteria:
        parsed.preliminaryAcceptanceCriteria || [],
      complexityEstimate: parsed.complexityEstimate || 'M',
    };
  } catch (error) {
    logger.error('Failed to parse refinement response', { content, error });
    throw new Error(
      `Failed to parse refinement JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Score refinement quality (0-100)
 */
function scoreRefinement(
  refinement: Omit<RefinementOutput, 'taskType'>
): number {
  let score = 0;

  // Business context (30 points)
  if (refinement.businessContext && refinement.businessContext.length > 50) {
    score += 30;
  } else if (refinement.businessContext) {
    score += 15;
  }

  // Objectives (20 points)
  if (refinement.objectives.length >= 3) {
    score += 20;
  } else if (refinement.objectives.length >= 2) {
    score += 15;
  } else if (refinement.objectives.length >= 1) {
    score += 10;
  }

  // Preliminary acceptance criteria (20 points)
  if (refinement.preliminaryAcceptanceCriteria.length >= 3) {
    score += 20;
  } else if (refinement.preliminaryAcceptanceCriteria.length >= 2) {
    score += 15;
  } else if (refinement.preliminaryAcceptanceCriteria.length >= 1) {
    score += 10;
  }

  // Complexity estimate (15 points)
  if (refinement.complexityEstimate) {
    score += 15;
  }

  // Questions for PO (10 points - bonus for identifying ambiguities)
  if (
    refinement.questionsForPO &&
    refinement.questionsForPO.length > 0
  ) {
    score += 10;
  }

  // Suggested split (5 points - bonus for identifying large stories)
  if (refinement.suggestedSplit) {
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
    refinement: Omit<RefinementOutput, 'taskType'>;
    score: number;
  }>
): string {
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  let explanation = `## Multi-LLM Refinement Analysis\n\n`;
  explanation += `Generated refinements from ${results.length} AI models and selected the best result.\n\n`;

  explanation += `### Model Scores\n\n`;
  sortedResults.forEach((result, index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    explanation += `${emoji} **${result.model}**: ${result.score}/100\n`;
  });

  explanation += `\n### Selection Criteria\n\n`;
  explanation += `- Business context clarity and depth (30 points)\n`;
  explanation += `- Number and quality of objectives (20 points)\n`;
  explanation += `- Preliminary acceptance criteria (20 points)\n`;
  explanation += `- Complexity estimation (15 points)\n`;
  explanation += `- Questions for Product Owner (10 points bonus)\n`;
  explanation += `- Story split suggestions (5 points bonus)\n\n`;

  const best = sortedResults[0];
  explanation += `**Selected model:** ${best.model} achieved the highest score with comprehensive business context`;
  if (best.refinement.questionsForPO?.length) {
    explanation += ` and ${best.refinement.questionsForPO.length} clarifying question(s) for the Product Owner`;
  }
  explanation += `.`;

  return explanation;
}
