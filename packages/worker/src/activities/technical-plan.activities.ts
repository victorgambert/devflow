/**
 * Technical Plan Activities - Phase 3 of Three-Phase Agile Workflow
 *
 * Generates detailed technical implementation plans from user stories.
 * Focus: Architecture, implementation steps, testing strategy, risk analysis
 * Uses RAG context for codebase-aware planning
 */

import axios from 'axios';
import { createLogger } from '@devflow/common';
import type {
  TechnicalPlanGenerationInput,
  TechnicalPlanGenerationOutput,
  UserStoryGenerationOutput,
  CouncilSummary,
} from '@devflow/common';
import {
  createCodeAgentDriver,
  extractSpecGenerationContext,
  formatContextForAI,
  loadPrompts,
  createCouncilService,
} from '@devflow/sdk';
import type { CodebaseContext } from '@devflow/sdk';
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
  bestPractices?: FetchBestPracticesOutput;
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
  council?: CouncilSummary;
}

/**
 * Fetch best practices for a given task using Perplexity
 */
export interface FetchBestPracticesInput {
  task: {
    title: string;
    description: string;
  };
  projectId: string;
  context?: {
    language: string;
    framework?: string;
  };
}

export interface FetchBestPracticesOutput {
  bestPractices: string;
  sources?: string[];
  perplexityModel: string;
}

export async function fetchBestPractices(
  input: FetchBestPracticesInput
): Promise<FetchBestPracticesOutput> {
  logger.info('Fetching best practices from Perplexity', {
    taskTitle: input.task.title,
    projectId: input.projectId,
  });

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // Build context-aware query for Perplexity
    let query = `What are the best practices for: ${input.task.title}`;

    if (input.context) {
      if (input.context.language) {
        query += `\nLanguage: ${input.context.language}`;
      }
      if (input.context.framework) {
        query += `\nFramework: ${input.context.framework}`;
      }
    }

    query += `\n\nTask description: ${input.task.description}`;
    query += `\n\nPlease provide:
1. Industry best practices for this type of task
2. Common pitfalls to avoid
3. Recommended patterns and approaches
4. Security considerations if applicable
5. Performance optimization tips`;

    // Call Perplexity via OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'perplexity/sonar-pro',
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://devflow.dev',
          'X-Title': 'DevFlow - Best Practices',
        },
      }
    );

    const bestPractices = response.data.choices[0].message.content;
    const model = response.data.model;

    logger.info('Best practices fetched successfully', {
      length: bestPractices.length,
      model,
    });

    return {
      bestPractices,
      perplexityModel: model,
    };
  } catch (error) {
    logger.error('Failed to fetch best practices from Perplexity', error);
    // Return empty best practices instead of failing the entire workflow
    return {
      bestPractices: 'Unable to fetch best practices at this time.',
      perplexityModel: 'perplexity/sonar-pro',
    };
  }
}

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
          directories: [],
          mainPaths: {},
          fileCount: input.ragContext.chunks.length,
          summary: 'Context retrieved via RAG',
        },
        dependencies: {
          production: {},
          dev: {},
          mainLibraries: [],
          summary: 'No dependency information available from RAG',
        },
        similarCode: input.ragContext.chunks.map((chunk) => ({
          path: chunk.filePath,
          content: chunk.content,
          relevanceScore: chunk.score * 100,
          reason: `RAG retrieval (score: ${chunk.score.toFixed(2)})`,
        })),
        documentation: {
          readme: '',
          conventions: [],
          patterns: [],
          summary: 'No documentation scanned',
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

    // Step 3: Load prompts with user story, context, and best practices
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
      bestPractices: input.bestPractices?.bestPractices || 'No best practices available',
    });

    // Step 4: Generate with AI (council or single model)
    const useCouncil = process.env.ENABLE_COUNCIL === 'true';

    let plan: TechnicalPlanGenerationOutput;
    let councilSummary: CouncilSummary | undefined = undefined;

    if (useCouncil) {
      logger.info('Using LLM Council for technical plan');

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

      const result = await council.deliberate<TechnicalPlanGenerationOutput>(
        prompts,
        parseTechnicalPlanResponse
      );

      logger.info('Council technical plan generation complete', {
        topRankedModel: result.summary.topRankedModel,
        agreementLevel: result.summary.agreementLevel,
      });

      plan = result.finalOutput;
      councilSummary = result.summary;
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
      council: councilSummary,
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
    logger.error('Failed to parse technical plan response', error as Error, { content });
    throw new Error(
      `Failed to parse technical plan JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

