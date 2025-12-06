/**
 * Code Generation Activities
 */

import { createLogger, generateBranchName } from '@soma-squad-ai/common';
import { createCodeAgentDriver, extractCodeGenerationContext, formatContextForAI } from '@soma-squad-ai/sdk';
import { analyzeRepositoryContext } from './codebase.activities';

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
    // Analyze codebase context
    logger.info('Analyzing repository context');
    const codebaseContext = await analyzeRepositoryContext({
      projectId: input.projectId,
      taskDescription: input.task.description,
    });

    // Extract relevant context for code generation
    const codeContext = extractCodeGenerationContext(codebaseContext);

    logger.info('Repository context analyzed', {
      language: codebaseContext.structure.language,
      framework: codebaseContext.structure.framework,
      dependencies: codeContext.dependencies.length,
      conventions: codeContext.conventions.length,
      relevantFiles: codeContext.relevantFiles.length,
    });

    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    });

    const code = await agent.generateCode({
      spec: input.spec,
      projectStructure: codeContext.projectStructure,
      relevantFiles: codeContext.relevantFiles,
      conventions: codeContext.conventions,
      dependencies: codeContext.dependencies,
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
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
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

