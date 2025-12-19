/**
 * Code Agents - Multi-provider support
 */

export * from '@/agents/agent.interface';
export * from '@/agents/anthropic.provider';
export * from '@/agents/openrouter.provider';
export * from '@/agents/prompts/prompt-loader';
export * from '@/agents/council';

// Agent Factory
import { CodeAgentDriver, AgentConfig } from '@/agents/agent.interface';
import { AnthropicProvider } from '@/agents/anthropic.provider';
import { OpenRouterProvider } from '@/agents/openrouter.provider';

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
