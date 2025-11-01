/**
 * Specification Generation Activities
 */

import { createLogger } from '@devflow/common';
import { createCodeAgentDriver } from '@devflow/sdk';

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
 * Generate technical specification using AI
 */
export async function generateSpecification(
  input: GenerateSpecificationInput,
): Promise<GenerateSpecificationOutput> {
  logger.info('Generating specification', input);

  try {
    const agent = createCodeAgentDriver({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022',
    });

    const spec = await agent.generateSpec({
      task: {
        title: input.task.title,
        description: input.task.description,
        priority: input.task.priority,
      },
      project: {
        name: 'DevFlow Project',
        language: 'typescript',
        framework: 'nestjs',
      },
    });

    return spec;
  } catch (error) {
    logger.error('Failed to generate specification', error as Error);
    throw error;
  }
}

