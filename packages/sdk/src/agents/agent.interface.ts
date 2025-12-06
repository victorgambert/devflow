/**
 * Code Agent Interface - Universal interface for AI providers (Phase 3 Enhanced)
 */

import {
  AgentPrompt,
  AgentResponse,
  SpecGenerationInput,
  SpecGenerationOutput,
  CodeGenerationInput,
  CodeGenerationOutput,
  FixGenerationInput,
  FixGenerationOutput,
} from '@soma-squad-ai/common';

// ============================================
// Phase 3: New Types for QA Agent
// ============================================

export interface TestGenerationInput {
  // Task details
  task: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
  };

  // Code context
  implementation: {
    files: Array<{
      path: string;
      content: string;
    }>;
  };

  // Project context
  project: {
    language: string;
    framework?: string;
    testFramework?: string;  // jest, vitest, pytest, etc.
  };

  // Test types to generate
  testTypes: ('unit' | 'integration' | 'e2e')[];
}

export interface TestGenerationOutput {
  tests: Array<{
    type: 'unit' | 'integration' | 'e2e';
    path: string;
    content: string;
    description: string;
    coverageTarget: string[];  // Functions/classes covered
  }>;
  summary: {
    totalTests: number;
    byType: Record<string, number>;
    estimatedCoverage: number;
  };
}

export interface TestFailureAnalysisInput {
  // Test failures
  failures: Array<{
    testName: string;
    testPath: string;
    error: string;
    stackTrace?: string;
  }>;

  // Implementation code
  implementationFiles: Array<{
    path: string;
    content: string;
  }>;

  // Test code
  testFiles: Array<{
    path: string;
    content: string;
  }>;

  // Previous fix attempts
  previousAttempts?: number;
}

export interface TestFixOutput {
  fixStrategy: 'fix_implementation' | 'fix_tests' | 'both';
  
  implementationFixes?: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
  
  testFixes?: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
  
  analysis: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// Agent Interface (Extended)
// ============================================

export interface CodeAgentDriver {
  /**
   * Generate a response from a prompt
   */
  generate(prompt: AgentPrompt): Promise<AgentResponse>;

  /**
   * Generate technical specification from task
   */
  generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput>;

  /**
   * Generate code implementation from spec
   */
  generateCode(input: CodeGenerationInput): Promise<CodeGenerationOutput>;

  /**
   * Generate fixes for errors
   */
  generateFix(input: FixGenerationInput): Promise<FixGenerationOutput>;

  // ============================================
  // Phase 3: QA Agent Methods
  // ============================================

  /**
   * Generate tests from acceptance criteria and implementation
   */
  generateTests(input: TestGenerationInput): Promise<TestGenerationOutput>;

  /**
   * Analyze test failures and generate fixes
   */
  analyzeTestFailures(input: TestFailureAnalysisInput): Promise<TestFixOutput>;
}

// ============================================
// Agent Factory
// ============================================

export interface AgentConfig {
  provider: 'openrouter' | 'anthropic' | 'openai' | 'cursor';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxContextLength: number;
  supportedModels: string[];
}
