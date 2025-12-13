/**
 * OpenRouter Code Agent Provider - Routes to Claude, GPT-4, and other models
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
} from '@devflow/common';

import {
  CodeAgentDriver,
  TestGenerationInput,
  TestGenerationOutput,
  TestFailureAnalysisInput,
  TestFixOutput,
} from '@/agents/agent.interface';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterProvider implements CodeAgentDriver {
  private apiKey: string;
  private model: string;
  private logger = createLogger('OpenRouterProvider');

  constructor(apiKey: string, model = 'anthropic/claude-sonnet-4') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    this.logger.info('Generating response via OpenRouter', {
      model: this.model,
      hasImages: !!prompt.images?.length,
    });

    // Build user content - with images if provided (for vision-capable models)
    type TextContent = { type: 'text'; text: string };
    type ImageContent = { type: 'image_url'; image_url: { url: string } };
    type MessageContent = string | (TextContent | ImageContent)[];

    let userContent: MessageContent;

    if (prompt.images && prompt.images.length > 0) {
      // Multimodal content with images
      userContent = [
        { type: 'text' as const, text: prompt.user },
        ...prompt.images.map((img) => ({
          type: 'image_url' as const,
          image_url: {
            url: `data:${img.mediaType};base64,${img.data}`,
          },
        })),
      ];
    } else {
      // Text-only content
      userContent = prompt.user;
    }

    const response = await axios.post(
      OPENROUTER_ENDPOINT,
      {
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://devflow.dev',
          'X-Title': 'DevFlow',
        },
      },
    );

    const data = response.data;

    return {
      content: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
      finishReason: data.choices[0].finish_reason,
    };
  }

  async generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput> {
    this.logger.info('Generating spec', { task: input.task.title });

    // Build dependencies context
    const depsContext = input.project.dependencies?.length
      ? `\nMain Dependencies:\n${input.project.dependencies.slice(0, 10).map((d) => `- ${d}`).join('\n')}`
      : '';

    // Build conventions context
    const conventionsContext = input.project.conventions?.length
      ? `\nCoding Conventions:\n${input.project.conventions.map((c) => `- ${c}`).join('\n')}`
      : '';

    // Build patterns context
    const patternsContext = input.project.patterns?.length
      ? `\nExisting Patterns:\n${input.project.patterns.map((p) => `- ${p}`).join('\n')}`
      : '';

    // Build codebase context (if provided)
    const codebaseContext = (input as any).codebaseContext
      ? `\n\n## Codebase Context\n\n${(input as any).codebaseContext}`
      : '';

    const prompt: AgentPrompt = {
      system: `You are a senior software architect. Generate detailed technical specifications for development tasks.

IMPORTANT: Your specification MUST follow the existing codebase patterns, conventions, and architecture.
- Analyze the provided codebase context carefully
- Match the existing code style and patterns
- Use the same dependencies and libraries already in the project
- Follow the established naming conventions
- Respect the existing file structure

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
Description: ${input.task.description || 'No description provided'}
Priority: ${input.task.priority}

## Project Context

**Language:** ${input.project.language}
**Framework:** ${input.project.framework || 'Not specified'}
${depsContext}
${conventionsContext}
${patternsContext}
${codebaseContext}

## Requirements

Based on the existing codebase context above:
1. Provide detailed architecture decisions that MATCH the existing patterns
2. Create implementation steps that follow the project's conventions
3. Suggest a testing strategy aligned with the project's test structure
4. Identify potential risks specific to this codebase
5. Reference existing files and patterns when relevant

Generate a specification that will seamlessly integrate with the existing codebase.`,
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
    // Try direct parse first
    try {
      return JSON.parse(content);
    } catch {
      // Not direct JSON, continue to other methods
    }

    // Try extracting from markdown code block
    const jsonCodeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonCodeBlockMatch) {
      try {
        return JSON.parse(jsonCodeBlockMatch[1].trim());
      } catch {
        // Not valid JSON in code block, continue
      }
    }

    // Try finding raw JSON object in the content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Found something that looks like JSON but isn't valid
      }
    }

    this.logger.error('Failed to parse JSON response');
    throw new Error('No valid JSON found in LLM response');
  }
}
