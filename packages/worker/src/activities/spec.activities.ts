/**
 * Specification Generation Activities
 */

import { createLogger } from '@soma-squad-ai/common';
import { createCodeAgentDriver, extractSpecGenerationContext, formatContextForAI } from '@soma-squad-ai/sdk';
import { analyzeRepositoryContext } from './codebase.activities';

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

    // Create AI agent via OpenRouter
    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    });

    // Generate spec with real codebase context
    const spec = await agent.generateSpec({
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

    return spec;
  } catch (error) {
    logger.error('Failed to generate specification', error as Error);
    throw error;
  }
}

