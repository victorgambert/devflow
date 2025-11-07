/**
 * Factory functions to create providers - MVP with GitHub only
 */

import { VCSDriver } from '../vcs/vcs.interface';
import { GitHubProvider } from '../vcs/github.provider';

import { CIDriver } from '../ci/ci.interface';
import { GitHubActionsProvider } from '../ci/github-actions.provider';

import { ConfigurationError } from '@soma-squad-ai/common';

interface VCSConfig {
  provider: 'github';
  token: string;
}

interface CIConfig {
  provider: 'github-actions';
  token: string;
}

/**
 * Create VCS driver - MVP supports GitHub only
 */
export function createVCSDriver(config: VCSConfig): VCSDriver {
  if (config.provider !== 'github') {
    throw new ConfigurationError(`Only GitHub is supported in MVP. Got: ${config.provider}`);
  }

  if (!config.token) {
    throw new ConfigurationError('GitHub token is required');
  }

  return new GitHubProvider(config.token);
}

/**
 * Create CI driver - MVP supports GitHub Actions only
 */
export function createCIDriver(config: CIConfig): CIDriver {
  if (config.provider !== 'github-actions') {
    throw new ConfigurationError(`Only GitHub Actions is supported in MVP. Got: ${config.provider}`);
  }

  if (!config.token) {
    throw new ConfigurationError('GitHub token is required');
  }

  return new GitHubActionsProvider(config.token);
}

