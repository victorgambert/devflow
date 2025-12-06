/**
 * Code Agents - Multi-provider support
 */

export * from './agent.interface';
export * from './anthropic.provider';
export * from './openrouter.provider';

// Agent Factory
import { CodeAgentDriver, AgentConfig } from './agent.interface';
import { AnthropicProvider } from './anthropic.provider';
import { OpenRouterProvider } from './openrouter.provider';

export function createCodeAgentDriver(config: AgentConfig): CodeAgentDriver {
  switch (config.provider) {
    case 'openrouter':
      return new OpenRouterProvider(config.apiKey, config.model);
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unsupported provider: ${config.provider}. Use 'openrouter' or 'anthropic'.`);
  }
}
