/**
 * Factory functions to create providers based on configuration
 */

import { VCSDriver } from '../vcs/vcs.interface';
import { GitHubProvider } from '../vcs/github.provider';
import { GitLabProvider } from '../vcs/gitlab.provider';
import { BitbucketProvider } from '../vcs/bitbucket.provider';

import { CIDriver } from '../ci/ci.interface';
import { GitHubActionsProvider } from '../ci/github-actions.provider';
import { GitLabCIProvider } from '../ci/gitlab-ci.provider';
import { BitbucketPipelinesProvider } from '../ci/bitbucket-pipelines.provider';

import { CodeAgentDriver } from '../agents/agent.interface';
import { AnthropicProvider } from '../agents/anthropic.provider';
import { OpenAIProvider } from '../agents/openai.provider';
import { CursorProvider } from '../agents/cursor.provider';

import { ConfigurationError } from '@devflow/common';

export interface VCSConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  token?: string;
  username?: string;
  password?: string;
}

export interface CIConfig {
  provider: 'github-actions' | 'gitlab-ci' | 'bitbucket-pipelines';
  token?: string;
  username?: string;
  password?: string;
}

export interface AgentConfig {
  provider: 'anthropic' | 'openai' | 'cursor';
  apiKey: string;
  model?: string;
}

/**
 * Create VCS driver based on configuration
 */
export function createVCSDriver(config: VCSConfig): VCSDriver {
  switch (config.provider) {
    case 'github':
      if (!config.token) {
        throw new ConfigurationError('GitHub token is required');
      }
      return new GitHubProvider(config.token);

    case 'gitlab':
      if (!config.token) {
        throw new ConfigurationError('GitLab token is required');
      }
      return new GitLabProvider(config.token);

    case 'bitbucket':
      if (!config.username || !config.password) {
        throw new ConfigurationError('Bitbucket username and app password are required');
      }
      return new BitbucketProvider(config.username, config.password);

    default:
      throw new ConfigurationError(`Unsupported VCS provider: ${config.provider}`);
  }
}

/**
 * Create CI driver based on configuration
 */
export function createCIDriver(config: CIConfig): CIDriver {
  switch (config.provider) {
    case 'github-actions':
      if (!config.token) {
        throw new ConfigurationError('GitHub token is required');
      }
      return new GitHubActionsProvider(config.token);

    case 'gitlab-ci':
      if (!config.token) {
        throw new ConfigurationError('GitLab token is required');
      }
      return new GitLabCIProvider(config.token);

    case 'bitbucket-pipelines':
      if (!config.username || !config.password) {
        throw new ConfigurationError('Bitbucket username and app password are required');
      }
      return new BitbucketPipelinesProvider(config.username, config.password);

    default:
      throw new ConfigurationError(`Unsupported CI provider: ${config.provider}`);
  }
}

/**
 * Create code agent driver based on configuration
 */
export function createCodeAgentDriver(config: AgentConfig): CodeAgentDriver {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);

    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);

    case 'cursor':
      return new CursorProvider(config.apiKey);

    default:
      throw new ConfigurationError(`Unsupported code agent provider: ${config.provider}`);
  }
}

