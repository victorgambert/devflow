/**
 * QA Testing Activities - Phase 3 Enhanced
 */

import { createLogger } from '@soma-squad-ai/common';
import { ProjectAdapter, createCodeAgentDriver } from '@soma-squad-ai/sdk';

const logger = createLogger('QAActivities');

// ============================================
// Test Generation
// ============================================

export interface GenerateTestsInput {
  projectId: string;
  taskId: string;
  acceptanceCriteria: string[];
  implementationFiles: Array<{ path: string; content: string }>;
  testTypes: ('unit' | 'integration' | 'e2e')[];
}

export interface GenerateTestsOutput {
  tests: Array<{
    type: string;
    path: string;
    content: string;
    description: string;
  }>;
  summary: {
    totalTests: number;
    byType: Record<string, number>;
  };
}

export async function generateTests(input: GenerateTestsInput): Promise<GenerateTestsOutput> {
  logger.info('Generating tests', {
    taskId: input.taskId,
    testTypes: input.testTypes,
    acCount: input.acceptanceCriteria.length,
  });

  try {
    // Get agent via OpenRouter
    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    });

    // Generate tests
    const result = await agent.generateTests({
      task: {
        title: `Task ${input.taskId}`,
        description: 'Generate tests based on acceptance criteria',
        acceptanceCriteria: input.acceptanceCriteria,
      },
      implementation: {
        files: input.implementationFiles,
      },
      project: {
        language: 'typescript',  // TODO: Get from project config
        framework: 'nestjs',
        testFramework: 'jest',
      },
      testTypes: input.testTypes,
    });

    logger.info('Tests generated', {
      totalTests: result.summary.totalTests,
      byType: result.summary.byType,
    });

    return {
      tests: result.tests,
      summary: result.summary,
    };
  } catch (error) {
    logger.error('Failed to generate tests', error as Error);
    throw error;
  }
}

// ============================================
// Test Execution
// ============================================

export interface RunTestsInput {
  projectId: string;
  workspacePath: string;
  testType?: 'unit' | 'integration' | 'e2e' | 'all';
}

export interface RunTestsOutput {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures?: Array<{
    testName: string;
    testPath: string;
    error: string;
    stackTrace?: string;
  }>;
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
}

export async function runTests(input: RunTestsInput): Promise<RunTestsOutput> {
  logger.info('Running tests', { projectId: input.projectId, testType: input.testType });

  try {
    const adapter = new ProjectAdapter(input.workspacePath);
    await adapter.loadProfile();

    // Determine which command to run
    let commandName: string;
    switch (input.testType) {
      case 'unit':
        commandName = 'unit';
        break;
      case 'integration':
        commandName = 'integration' in adapter.getProfile().commands 
          ? 'integration' 
          : 'unit';
        break;
      case 'e2e':
        commandName = 'e2e';
        break;
      default:
        commandName = 'unit';  // Default to unit tests
    }

    // Run tests
    const result = await adapter.executeCommand(commandName as any);

    // Parse test output (basic parsing - can be enhanced)
    const failures = parseTestFailures(result.stdout + result.stderr);

    const passed = failures.length === 0 ? 1 : 0;
    const failed = failures.length;

    logger.info('Tests executed', {
      success: result.success,
      passed,
      failed,
      duration: result.duration,
    });

    return {
      success: result.success,
      passed,
      failed,
      skipped: 0,
      duration: result.duration,
      failures: failures.length > 0 ? failures : undefined,
    };
  } catch (error) {
    logger.error('Failed to run tests', error as Error);
    throw error;
  }
}

// ============================================
// Test Failure Analysis
// ============================================

export interface AnalyzeTestFailuresInput {
  projectId: string;
  failures: Array<{
    testName: string;
    testPath: string;
    error: string;
    stackTrace?: string;
  }>;
  implementationFiles: Array<{ path: string; content: string }>;
  testFiles: Array<{ path: string; content: string }>;
  previousAttempts?: number;
}

export interface AnalyzeTestFailuresOutput {
  fixStrategy: 'fix_implementation' | 'fix_tests' | 'both';
  implementationFixes?: Array<{ path: string; content: string; reason: string }>;
  testFixes?: Array<{ path: string; content: string; reason: string }>;
  analysis: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function analyzeTestFailures(
  input: AnalyzeTestFailuresInput,
): Promise<AnalyzeTestFailuresOutput> {
  logger.info('Analyzing test failures', {
    failureCount: input.failures.length,
    previousAttempts: input.previousAttempts,
  });

  try {
    const agent = createCodeAgentDriver({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    });

    const result = await agent.analyzeTestFailures({
      failures: input.failures,
      implementationFiles: input.implementationFiles,
      testFiles: input.testFiles,
      previousAttempts: input.previousAttempts,
    });

    logger.info('Test failures analyzed', {
      fixStrategy: result.fixStrategy,
      confidence: result.confidence,
    });

    return result;
  } catch (error) {
    logger.error('Failed to analyze test failures', error as Error);
    throw error;
  }
}

// ============================================
// QA Testing (Combined)
// ============================================

export interface RunQATestsInput {
  projectId: string;
  branchName: string;
  errorLogs: string;
}

export interface RunQATestsOutput {
  passed: boolean;
  failures?: any[];
  logs: string;
}

/**
 * Run QA tests on the branch (Legacy from Phase 2, kept for compatibility)
 */
export async function runQATests(input: RunQATestsInput): Promise<RunQATestsOutput> {
  logger.info('Running QA tests', input);

  try {
    // TODO: Get workspace path from project config
    const adapter = new ProjectAdapter('/tmp/workspace');
    await adapter.loadProfile();

    // Run tests
    const testResult = await adapter.executeCommand('e2e');

    return {
      passed: testResult.success,
      logs: testResult.stdout + testResult.stderr,
    };
  } catch (error) {
    logger.error('QA tests failed', error as Error);
    return {
      passed: false,
      logs: (error as Error).message,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function parseTestFailures(output: string): Array<{
  testName: string;
  testPath: string;
  error: string;
  stackTrace?: string;
}> {
  const failures: Array<{
    testName: string;
    testPath: string;
    error: string;
    stackTrace?: string;
  }> = [];

  // Basic parsing for Jest/Vitest output
  // This can be enhanced based on actual test framework output

  const failurePattern = /FAIL\s+(.+\.spec\.\w+)/g;
  const matches = output.matchAll(failurePattern);

  for (const match of matches) {
    failures.push({
      testName: 'Unknown test',  // Would need more sophisticated parsing
      testPath: match[1],
      error: 'Test failed',
      stackTrace: undefined,
    });
  }

  return failures;
}
