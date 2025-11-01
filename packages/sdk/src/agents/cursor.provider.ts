/**
 * Cursor Code Agent Provider (Stub)
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

export class CursorProvider implements CodeAgentDriver {
  private logger = createLogger('CursorProvider');
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger.warn('CursorProvider is a stub implementation');
  }

  async generate(prompt: AgentPrompt): Promise<AgentResponse> {
    throw new ExternalServiceError('Cursor provider not yet implemented', 'cursor');
  }

  async generateSpec(input: SpecGenerationInput): Promise<SpecGenerationOutput> {
    throw new ExternalServiceError('Cursor provider not yet implemented', 'cursor');
  }

  async generateCode(input: CodeGenerationInput): Promise<CodeGenerationOutput> {
    throw new ExternalServiceError('Cursor provider not yet implemented', 'cursor');
  }

  async generateFix(input: FixGenerationInput): Promise<FixGenerationOutput> {
    throw new ExternalServiceError('Cursor provider not yet implemented', 'cursor');
  }
}

