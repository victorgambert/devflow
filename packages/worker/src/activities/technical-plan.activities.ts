/**
 * Technical Plan Activities - Phase 3 of Three-Phase Agile Workflow
 *
 * Generates detailed technical implementation plans from user stories.
 * Focus: Architecture, implementation steps, testing strategy, risk analysis
 * Uses RAG context for codebase-aware planning
 */

import { createLogger } from '@devflow/common';
import type {
  TechnicalPlanGenerationInput,
  TechnicalPlanGenerationOutput,
  UserStoryGenerationOutput,
} from '@devflow/common/types/agent.types';
import {
  createCodeAgentDriver,
  extractSpecGenerationContext,
  formatContextForAI,
} from '@devflow/sdk';
import type { CodebaseContext } from '@devflow/sdk';
import { loadPrompts } from '@devflow/sdk/agents/prompts/prompt-loader';
import { analyzeRepositoryContext } from '@/activities/codebase.activities';

const logger = createLogger('TechnicalPlanActivities');

export interface GenerateTechnicalPlanInput {
  task: any;
  userStory: UserStoryGenerationOutput;
  projectId: string;
  ragContext?: {
    chunks: Array<{
      filePath: string;
      content: string;
      score: number;
      language: string;
    }>;
    retrievalTimeMs: number;
    totalChunks: number;
  };
}

export interface GenerateTechnicalPlanOutput {
  plan: TechnicalPlanGenerationOutput;
  contextUsed?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    filesAnalyzed: string[];
    usingRAG: boolean;
  };
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
  'perplexity/sonar-pro',
];

/**
 * Generate technical plan from user story using AI with codebase context
 */
export async function generateTechnicalPlan(
  input: GenerateTechnicalPlanInput
): Promise<GenerateTechnicalPlanOutput> {
  logger.info('Generating technical plan', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasRAGContext: !!input.ragContext,
  });

  try {
    // Step 1: Build codebase context (RAG or legacy analysis)
    let codebaseContext: CodebaseContext;
    let usingRAG = false;

    if (input.ragContext && input.ragContext.chunks.length > 0) {
      logger.info('Using RAG context for technical plan', {
        chunks: input.ragContext.chunks.length,
        retrievalTime: input.ragContext.retrievalTimeMs,
      });

      usingRAG = true;

      // Build context from RAG chunks
      const languages = [
        ...new Set(input.ragContext.chunks.map((c) => c.language)),
      ];
      const primaryLanguage = languages[0] || 'unknown';

      codebaseContext = {
        structure: {
          language: primaryLanguage,
          framework: undefined,
        },
        dependencies: {
          mainLibraries: [],
          devDependencies: [],
          allDependencies: [],
        },
        similarCode: input.ragContext.chunks.map((chunk) => ({
          path: chunk.filePath,
          content: chunk.content,
          relevanceScore: chunk.score * 100,
          reason: `RAG retrieval (score: ${chunk.score.toFixed(2)})`,
        })),
        documentation: {
          conventions: [],
          codeStyle: [],
          architectureNotes: [],
          patterns: [],
        },
        timestamp: new Date(),
      };
    } else {
      logger.info('No RAG context, using legacy repository analysis');

      codebaseContext = await analyzeRepositoryContext({
        projectId: input.projectId,
        taskDescription: input.task.description,
      });
    }

    // Step 2: Extract spec context for AI
    const specContext = extractSpecGenerationContext(codebaseContext);

    logger.info('Codebase context prepared', {
      language: specContext.language,
      framework: specContext.framework,
      dependencies: specContext.dependencies.length,
      usingRAG,
    });

    // Step 3: Load prompts with user story and context
    const prompts = await loadPrompts('technical-plan', {
      userStoryActor: input.userStory.userStory.actor,
      userStoryGoal: input.userStory.userStory.goal,
      userStoryBenefit: input.userStory.userStory.benefit,
      acceptanceCriteria: input.userStory.acceptanceCriteria
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n'),
      projectLanguage: specContext.language,
      projectFramework: specContext.framework || 'Not specified',
      projectDependencies: specContext.dependencies.join(', '),
      codebaseContext: formatContextForAI(codebaseContext),
    });

    // Step 4: Generate with AI (multi-LLM or single model)
    const useMultiLLM = process.env.ENABLE_MULTI_LLM === 'true';

    let plan: TechnicalPlanGenerationOutput;
    let multiLLMResults: any = undefined;

    if (useMultiLLM) {
      logger.info('Using multi-LLM generation for technical plan');

      const results = await Promise.all(
        MULTI_LLM_MODELS.map(async (model) => {
          try {
            const agent = createCodeAgentDriver({
              provider: 'openrouter',
              apiKey: process.env.OPENROUTER_API_KEY || '',
              model,
            });

            const response = await agent.generate(prompts);
            const parsedPlan = parseTechnicalPlanResponse(response.content);
            const score = scoreTechnicalPlan(parsedPlan, input.userStory);

            logger.info(`Technical plan generated with ${model}`, { score });

            return {
              model,
              plan: parsedPlan,
              score,
            };
          } catch (error) {
            logger.error(
              `Failed to generate technical plan with ${model}`,
              error
            );
            throw error;
          }
        })
      );

      // Select best result
      const best = results.reduce((best, curr) =>
        curr.score > best.score ? curr : best
      );

      logger.info('Multi-LLM technical plan generation complete', {
        bestModel: best.model,
        bestScore: best.score,
      });

      plan = best.plan;
      multiLLMResults = {
        models: results.map((r) => ({ model: r.model, score: r.score })),
        bestModel: best.model,
        detailedExplanation: formatMultiLLMExplanation(results, input.userStory),
      };
    } else {
      // Single model generation
      logger.info('Using single model generation for technical plan');

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      const response = await agent.generate(prompts);
      plan = parseTechnicalPlanResponse(response.content);

      logger.info('Technical plan generated successfully');
    }

    return {
      plan,
      contextUsed: {
        language: specContext.language,
        framework: specContext.framework,
        dependencies: specContext.dependencies.length,
        conventions: specContext.conventions.length,
        filesAnalyzed: codebaseContext.similarCode?.map((c) => c.path) || [],
        usingRAG,
      },
      multiLLM: multiLLMResults,
    };
  } catch (error) {
    logger.error('Failed to generate technical plan', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into TechnicalPlanGenerationOutput
 */
function parseTechnicalPlanResponse(
  content: string
): TechnicalPlanGenerationOutput {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      architecture: parsed.architecture || [],
      implementationSteps: parsed.implementationSteps || [],
      testingStrategy: parsed.testingStrategy || '',
      risks: parsed.risks || [],
      estimatedTime: parsed.estimatedTime || 180,
      dependencies: parsed.dependencies,
      technicalDecisions: parsed.technicalDecisions,
      filesAffected: parsed.filesAffected,
    };
  } catch (error) {
    logger.error('Failed to parse technical plan response', { content, error });
    throw new Error(
      `Failed to parse technical plan JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Score technical plan quality (0-100)
 */
function scoreTechnicalPlan(
  plan: TechnicalPlanGenerationOutput,
  userStory: UserStoryGenerationOutput
): number {
  let score = 0;

  // Architecture decisions (25 points)
  if (plan.architecture.length >= 3) {
    score += 25;
  } else if (plan.architecture.length >= 2) {
    score += 18;
  } else if (plan.architecture.length >= 1) {
    score += 12;
  }

  // Implementation steps (25 points)
  if (plan.implementationSteps.length >= 5) {
    score += 25;
  } else if (plan.implementationSteps.length >= 3) {
    score += 18;
  } else if (plan.implementationSteps.length >= 1) {
    score += 12;
  }

  // Testing strategy (20 points)
  if (plan.testingStrategy && plan.testingStrategy.length > 100) {
    score += 20;
  } else if (plan.testingStrategy && plan.testingStrategy.length > 50) {
    score += 15;
  } else if (plan.testingStrategy) {
    score += 10;
  }

  // Risks identified (15 points)
  if (plan.risks.length >= 3) {
    score += 15;
  } else if (plan.risks.length >= 2) {
    score += 10;
  } else if (plan.risks.length >= 1) {
    score += 5;
  }

  // Files affected specified (10 points - bonus for specificity)
  if (plan.filesAffected && plan.filesAffected.length > 0) {
    score += 10;
  }

  // Time estimation present (5 points)
  if (plan.estimatedTime && plan.estimatedTime > 0) {
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
    plan: TechnicalPlanGenerationOutput;
    score: number;
  }>,
  userStory: UserStoryGenerationOutput
): string {
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  let explanation = `## Multi-LLM Technical Plan Analysis\n\n`;
  explanation += `Generated technical plans from ${results.length} AI models and selected the best result.\n\n`;

  explanation += `### Model Scores\n\n`;
  sortedResults.forEach((result, index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    explanation += `${emoji} **${result.model}**: ${result.score}/100\n`;
    explanation += `   - Architecture decisions: ${result.plan.architecture.length}\n`;
    explanation += `   - Implementation steps: ${result.plan.implementationSteps.length}\n`;
    explanation += `   - Files affected: ${result.plan.filesAffected?.length || 0}\n`;
  });

  explanation += `\n### Selection Criteria\n\n`;
  explanation += `- Architecture decisions quality (25 points)\n`;
  explanation += `- Implementation steps detail (25 points)\n`;
  explanation += `- Testing strategy comprehensiveness (20 points)\n`;
  explanation += `- Risk analysis thoroughness (15 points)\n`;
  explanation += `- Specific files identified (10 points)\n`;
  explanation += `- Time estimation provided (5 points)\n\n`;

  const best = sortedResults[0];
  explanation += `**Selected model:** ${best.model} achieved the highest score with `;
  explanation += `${best.plan.implementationSteps.length} implementation steps`;
  if (best.plan.filesAffected && best.plan.filesAffected.length > 0) {
    explanation += ` referencing ${best.plan.filesAffected.length} specific files`;
  }
  explanation += `.`;

  return explanation;
}
