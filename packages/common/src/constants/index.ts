/**
 * DevFlow Constants
 */

export const DEVFLOW_CONFIG_FILE = '.soma-squad-ai.yml';

export const DEFAULT_BRANCH = 'main';

export const DEFAULT_TIMEOUT = 1800; // 30 minutes

export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: 'exponential' as const,
  initialInterval: 1000,
  maxInterval: 30000,
};

export const SUPPORTED_VCS_PROVIDERS = ['github', 'gitlab', 'bitbucket'] as const;

export const SUPPORTED_CI_PROVIDERS = [
  'github-actions',
  'gitlab-ci',
  'bitbucket-pipelines',
  'jenkins',
  'circleci',
] as const;

export const SUPPORTED_CODE_AGENTS = ['anthropic', 'openai', 'cursor'] as const;

export const WORKFLOW_TASK_QUEUE = 'soma-squad-ai';

export const TEMPORAL_NAMESPACE = 'default';

export const API_VERSION = 'v1';

export const DEFAULT_RATE_LIMIT = {
  ttl: 60,
  max: 100,
};

export const LOG_CONTEXT = {
  WORKFLOW: 'workflow',
  VCS: 'vcs',
  CI: 'ci',
  AGENT: 'agent',
  NOTION: 'notion',
  NOTIFICATION: 'notification',
} as const;

