/**
 * Code Agents - Phase 3 Unified Interface
 */

export * from './agent.interface';
export * from './anthropic.provider';

// Agent Factory
import { CodeAgentDriver, AgentConfig } from './agent.interface';
import { AnthropicProvider } from './anthropic.provider';

export function createCodeAgentDriver(config: AgentConfig): CodeAgentDriver {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    
    case 'openai':
      // TODO: Implement OpenAI provider
      throw new Error('OpenAI provider not yet implemented');
    
    case 'cursor':
      // TODO: Implement Cursor provider
      throw new Error('Cursor provider not yet implemented');
    
    default:
      throw new Error(`Unknown agent provider: ${config.provider}`);
  }
}
