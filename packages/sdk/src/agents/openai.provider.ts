/**
 * OpenAI Code Agent Provider (Stub)
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
  createLogger,
  ExternalServiceError,
} from '@devflow/common';

import { CodeAgentDriver } from './agent.interface';

export class OpenAIProvider implements CodeAgentDriver {
  private logger = createLogger('OpenAIProvider');
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4-turbo-preview') {
    this.apiKey = apiKey;
    this.model = model;
    this.logger.warn('OpenAIProvider is a stub implementation');
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    throw new ExternalServiceError('OpenAI provider not yet implemented', 'openai');
  }

  async generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput> {
    throw new ExternalServiceError('OpenAI provider not yet implemented', 'openai');
  }

  async generateCode(input: CodeGenerationInput): Promise<CodeGenerationOutput> {
    throw new ExternalServiceError('OpenAI provider not yet implemented', 'openai');
  }

  async generateFix(input: FixGenerationInput): Promise<FixGenerationOutput> {
    throw new ExternalServiceError('OpenAI provider not yet implemented', 'openai');
  }
}

