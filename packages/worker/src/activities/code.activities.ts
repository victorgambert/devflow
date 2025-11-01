/**
 * Code Generation Activities
 */

import { createLogger, generateBranchName } from '@devflow/common';
import { createCodeAgentDriver } from '@devflow/sdk';

const logger = createLogger('CodeActivities');

export interface GenerateCodeInput {
  spec: any;
  task: any;
  projectId: string;
}

export interface GenerateCodeOutput {
  files: Array<{ path: string; content: string; action: string }>;
  commitMessage: string;
  prDescription: string;
  branchName: string;
}

/**
 * Generate code implementation using AI
 */
export async function generateCode(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  logger.info('Generating code', input);

  try {
    const agent = createCodeAgentDriver({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    const code = await agent.generateCode({
      spec: input.spec,
      projectStructure: '// Project structure',
      relevantFiles: [],
      task: input.task,
    });

    const branchName = generateBranchName('feature/{task-id}-{task-slug}', input.task.id, input.task.title);

    return {
      ...code,
      branchName,
    };
  } catch (error) {
    logger.error('Failed to generate code', error as Error);
    throw error;
  }
}

export interface GenerateFixInput {
  projectId: string;
  errorLogs: string;
  testFailures?: any[];
}

export interface GenerateFixOutput {
  files: Array<{ path: string; content: string }>;
  commitMessage: string;
}

/**
 * Generate fix for errors using AI
 */
export async function generateFix(input: GenerateFixInput): Promise<GenerateFixOutput> {
  logger.info('Generating fix', input);

  try {
    const agent = createCodeAgentDriver({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    const fix = await agent.generateFix({
      errorLogs: input.errorLogs,
      testFailures: input.testFailures,
      files: [],
    });

    return fix;
  } catch (error) {
    logger.error('Failed to generate fix', error as Error);
    throw error;
  }
}

