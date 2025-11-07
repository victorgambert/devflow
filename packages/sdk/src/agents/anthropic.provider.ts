/**
 * Anthropic (Claude) Code Agent Provider - Phase 3 Enhanced with QA Agent
 */

import axios from 'axios';
import {
  AgentPrompt,
  AgentResponse,
  SpecGenerationInput,
  SpecGenerationOutput,
  CodeGenerationInput,
  CodeGenerationOutput,
  FixGenerationInput,
  FixGenerationOutput,
  createLogger,
} from '@soma-squad-ai/common';

import {
  CodeAgentDriver,
  TestGenerationInput,
  TestGenerationOutput,
  TestFailureAnalysisInput,
  TestFixOutput,
} from './agent.interface';

export class AnthropicProvider implements CodeAgentDriver {
  private apiKey: string;
  private model: string;
  private logger = createLogger('AnthropicProvider');
  private baseURL = 'https://api.anthropic.com/v1';

  constructor(apiKey: string, model = 'claude-sonnet-4-0') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    this.logger.info('Generating response', { model: this.model });

    const response = await axios.post(
      `${this.baseURL}/messages`,
      {
        model: this.model,
        max_tokens: 4096,
        system: prompt.system,
        messages: [
          {
            role: 'user',
            content: prompt.user,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    );

    const data = response.data;

    return {
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: this.model,
      finishReason: data.stop_reason,
    };
  }

  async generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput> {
    this.logger.info('Generating spec', { task: input.task.title });

    const prompt: AgentPrompt = {
      system: `You are a senior software architect. Generate detailed technical specifications for development tasks.
Return your response as valid JSON with the following structure:
{
  "architecture": ["decision 1", "decision 2"],
  "implementationSteps": ["step 1", "step 2"],
  "testingStrategy": "strategy description",
  "risks": ["risk 1", "risk 2"],
  "estimatedTime": 120,
  "dependencies": ["dep 1"],
  "technicalDecisions": ["decision 1"]
}`,
      user: `Generate a technical specification for this task:

Title: ${input.task.title}
Description: ${input.task.description}
Priority: ${input.task.priority}

Project Context:
- Language: ${input.project.language}
- Framework: ${input.project.framework || 'N/A'}
- Existing files: ${input.existingFiles?.join(', ') || 'N/A'}

Provide detailed architecture decisions, implementation steps, testing strategy, and potential risks.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  async generateCode(input: CodeGenerationInput): Promise<CodeGenerationOutput> {
    this.logger.info('Generating code', { task: input.task.title });

    const relevantFilesContext = input.relevantFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are an expert software developer. Generate production-ready code based on specifications.
Return your response as valid JSON with the following structure:
{
  "files": [
    {
      "path": "src/file.ts",
      "action": "create",
      "content": "file content",
      "reason": "why this change"
    }
  ],
  "commitMessage": "feat: add feature",
  "prDescription": "PR description"
}`,
      user: `Implement this specification:

Task: ${input.task.title}
Description: ${input.task.description}

Specification:
${JSON.stringify(input.spec, null, 2)}

Project Structure:
${input.projectStructure}

Relevant Files:
${relevantFilesContext}

Generate clean, typed, production-ready code with proper error handling.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  async generateFix(input: FixGenerationInput): Promise<FixGenerationOutput> {
    this.logger.info('Generating fix', { previousAttempts: input.previousAttempts });

    const filesContext = input.files.map((f) => `File: ${f.path}\n${f.content}`).join('\n\n');

    const failuresContext = input.testFailures
      ?.map((f) => `Test: ${f.name}\nError: ${f.message}\n${f.stackTrace || ''}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are an expert debugger. Analyze errors and generate fixes.
Return your response as valid JSON with the following structure:
{
  "files": [
    {
      "path": "src/file.ts",
      "content": "fixed content",
      "reason": "what was fixed"
    }
  ],
  "analysis": "root cause analysis",
  "commitMessage": "fix: description"
}`,
      user: `Fix these errors:

Error Logs:
${input.errorLogs}

Test Failures:
${failuresContext || 'N/A'}

Affected Files:
${filesContext}

Previous Fix Attempts: ${input.previousAttempts || 0}

Analyze the root cause and provide a fix.`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // ============================================
  // Phase 3: QA Agent Implementation
  // ============================================

  async generateTests(input: TestGenerationInput): Promise<TestGenerationOutput> {
    this.logger.info('Generating tests', {
      task: input.task.title,
      testTypes: input.testTypes,
    });

    const implementationContext = input.implementation.files
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const acContext = input.task.acceptanceCriteria
      .map((ac, i) => `${i + 1}. ${ac}`)
      .join('\n');

    const prompt: AgentPrompt = {
      system: `You are a QA engineer specialized in test generation. Generate comprehensive tests based on acceptance criteria and implementation.
Return your response as valid JSON with the following structure:
{
  "tests": [
    {
      "type": "unit",
      "path": "tests/unit/file.spec.ts",
      "content": "test code",
      "description": "what this test covers",
      "coverageTarget": ["functionName", "className"]
    }
  ],
  "summary": {
    "totalTests": 5,
    "byType": {"unit": 3, "integration": 2},
    "estimatedCoverage": 85
  }
}`,
      user: `Generate ${input.testTypes.join(', ')} tests for this implementation:

Task: ${input.task.title}
Description: ${input.task.description}

Acceptance Criteria:
${acContext}

Implementation:
${implementationContext}

Project Context:
- Language: ${input.project.language}
- Framework: ${input.project.framework || 'N/A'}
- Test Framework: ${input.project.testFramework || 'jest'}

Generate:
1. Tests covering all acceptance criteria
2. Edge cases and error scenarios
3. Clear test descriptions
4. Proper test structure and assertions

Test Types Requested: ${input.testTypes.join(', ')}`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  async analyzeTestFailures(input: TestFailureAnalysisInput): Promise<TestFixOutput> {
    this.logger.info('Analyzing test failures', {
      failureCount: input.failures.length,
      previousAttempts: input.previousAttempts,
    });

    const failuresContext = input.failures
      .map(
        (f) => `
Test: ${f.testName}
File: ${f.testPath}
Error: ${f.error}
Stack Trace:
${f.stackTrace || 'N/A'}
`,
      )
      .join('\n---\n');

    const implContext = input.implementationFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const testContext = input.testFiles
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join('\n\n');

    const prompt: AgentPrompt = {
      system: `You are a QA engineer specialized in debugging test failures. Analyze failures and determine the best fix strategy.
Return your response as valid JSON with the following structure:
{
  "fixStrategy": "fix_implementation" | "fix_tests" | "both",
  "implementationFixes": [
    {
      "path": "src/file.ts",
      "content": "fixed content",
      "reason": "explanation"
    }
  ],
  "testFixes": [
    {
      "path": "tests/file.spec.ts",
      "content": "fixed content",
      "reason": "explanation"
    }
  ],
  "analysis": "detailed root cause analysis",
  "confidence": "high" | "medium" | "low"
}`,
      user: `Analyze these test failures and provide fixes:

Test Failures (${input.failures.length}):
${failuresContext}

Implementation Code:
${implContext}

Test Code:
${testContext}

Previous Fix Attempts: ${input.previousAttempts || 0}

Determine:
1. Root cause of failures
2. Whether implementation or tests need fixing
3. Provide corrected code
4. Confidence level in the fix`,
    };

    const response = await this.generate(prompt);
    return this.parseJSONResponse(response.content);
  }

  // Helper to parse JSON from AI response
  private parseJSONResponse<T>(content: string): T {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error('Failed to parse JSON response', error as Error);
      throw error;
    }
  }
}
