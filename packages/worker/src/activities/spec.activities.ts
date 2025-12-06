/**
 * Specification Generation Activities
 */

import { createLogger } from '@devflow/common';
import { createCodeAgentDriver, extractSpecGenerationContext, formatContextForAI } from '@devflow/sdk';
import { analyzeRepositoryContext } from './codebase.activities';
import { generateSpecsWithMultiLLM } from './spec-multi-llm.activities';

const logger = createLogger('SpecActivities');

export interface GenerateSpecificationInput {
  task: any;
  projectId: string;
}

export interface GenerateSpecificationOutput {
  architecture: string[];
  implementationSteps: string[];
  testingStrategy: string;
  risks: string[];
  // Context used for generation (for transparency)
  contextUsed?: {
    language: string;
    framework?: string;
    dependencies: number;
    conventions: number;
    similarCode: number;
    filesAnalyzed: string[];
  };
  // Multi-LLM results (if enabled)
  multiLLM?: {
    models: Array<{
      model: string;
      score: number;
      reasoning: string;
      summary: string;
    }>;
    chosenModel: string;
    detailedExplanation: string;
    agreementScore: number;
    comparisonPoints: string[];
  };
}

/**
 * Generate technical specification using AI with codebase context
 */
export async function generateSpecification(
  input: GenerateSpecificationInput,
): Promise<GenerateSpecificationOutput> {
  logger.info('Generating specification', input);

  try {
    // Analyze codebase context
    logger.info('Analyzing repository context');
    const codebaseContext = await analyzeRepositoryContext({
      projectId: input.projectId,
      taskDescription: input.task.description,
    });

    // Extract relevant context for spec generation
    const specContext = extractSpecGenerationContext(codebaseContext);

    logger.info('Repository context analyzed', {
      language: specContext.language,
      framework: specContext.framework,
      dependencies: specContext.dependencies.length,
      conventions: specContext.conventions.length,
    });

    // Check if multi-LLM is enabled
    const useMultiLLM = process.env.ENABLE_MULTI_LLM === 'true';

    let spec: any;
    let multiLLMResults: any = undefined;

    if (useMultiLLM) {
      logger.info('Using multi-LLM generation (Claude + GPT-4 + Gemini)');

      // Generate specs with multiple models in parallel
      const multiResult = await generateSpecsWithMultiLLM({
        task: input.task,
        codebaseContext,
        specContext,
      });

      spec = multiResult.bestSpec;
      multiLLMResults = {
        models: multiResult.allSpecs.map((s) => ({
          model: s.model,
          score: s.score,
          reasoning: s.reasoning,
          summary: s.summary,
        })),
        chosenModel: multiResult.synthesis.chosenModel,
        detailedExplanation: multiResult.synthesis.detailedExplanation,
        agreementScore: multiResult.synthesis.agreementScore,
        comparisonPoints: multiResult.synthesis.comparisonPoints,
      };

      logger.info('Multi-LLM generation completed', {
        chosenModel: multiResult.synthesis.chosenModel,
        agreementScore: multiResult.synthesis.agreementScore,
      });
    } else {
      logger.info('Using single LLM generation');

      // Create AI agent via OpenRouter
      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      // Generate spec with real codebase context
      spec = await agent.generateSpec({
        task: {
          title: input.task.title,
          description: input.task.description,
          priority: input.task.priority,
        },
        project: {
          language: specContext.language,
          framework: specContext.framework,
          dependencies: specContext.dependencies,
          conventions: specContext.conventions,
          patterns: specContext.patterns,
        },
        // Add full context as additional info
        codebaseContext: formatContextForAI(codebaseContext),
      });
    }

    // Add context information to the result for transparency
    return {
      ...spec,
      contextUsed: {
        language: codebaseContext.structure.language,
        framework: codebaseContext.structure.framework,
        dependencies: codebaseContext.dependencies.mainLibraries.length,
        conventions: codebaseContext.documentation.conventions.length,
        similarCode: codebaseContext.similarCode.length,
        filesAnalyzed: codebaseContext.similarCode.map((code) => code.path),
      },
      multiLLM: multiLLMResults,
    };
  } catch (error) {
    logger.error('Failed to generate specification', error as Error);
    throw error;
  }
}

