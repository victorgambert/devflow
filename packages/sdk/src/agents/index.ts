/**
 * Code Agents - MVP with Anthropic only
 */

export * from './agent.interface';
export * from './anthropic.provider';

// Agent Factory
import { CodeAgentDriver, AgentConfig } from './agent.interface';
import { AnthropicProvider } from './anthropic.provider';

export function createCodeAgentDriver(config: AgentConfig): CodeAgentDriver {
  if (config.provider !== 'anthropic') {
    throw new Error(`Only Anthropic provider is supported in MVP. Got: ${config.provider}`);
  }

  return new AnthropicProvider(config.apiKey, config.model);
}
