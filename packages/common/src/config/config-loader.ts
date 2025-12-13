import { z } from 'zod';

// Define schemas for validation
const AppConfigSchema = z.object({
  port: z.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  database: z.object({
    url: z.string(),
  }),
  temporal: z.object({
    address: z.string().default('localhost:7233'),
    namespace: z.string().default('default'),
    taskQueue: z.string().default('devflow'),
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
  }),
});

const LinearSystemConfigSchema = z.object({
  statuses: z.object({
    // Generic
    inReview: z.string().default('In Review'),
    done: z.string().default('Done'),
    blocked: z.string().default('Blocked'),
    // Backlog
    backlog: z.string().default('Backlog'),
    // Refinement
    toRefinement: z.string().default('To Refinement'),
    refinementInProgress: z.string().default('Refinement In Progress'),
    refinementReady: z.string().default('Refinement Ready'),
    refinementFailed: z.string().default('Refinement Failed'),
    // User Story
    toUserStory: z.string().default('Refinement Ready'),
    userStoryInProgress: z.string().default('UserStory In Progress'),
    userStoryReady: z.string().default('UserStory Ready'),
    userStoryFailed: z.string().default('UserStory Failed'),
    // Technical Plan
    toPlan: z.string().default('UserStory Ready'),
    planInProgress: z.string().default('Plan In Progress'),
    planReady: z.string().default('Plan Ready'),
    planFailed: z.string().default('Plan Failed'),
  }),
  webhookSecret: z.string().optional(),
  specWarningMessage: z.string().optional(),
});

const AIConfigSchema = z.object({
  openrouter: z.object({
    apiKey: z.string(),
    model: z.string().default('anthropic/claude-sonnet-4'),
  }).optional(),
  anthropic: z.object({
    apiKey: z.string(),
  }).optional(),
});

const VCSSystemConfigSchema = z.object({
  github: z.object({
    token: z.string().optional(), // Optional for OAuth-based auth
  }),
});

const OAuthConfigSchema = z.object({
  encryptionKey: z.string(), // Required for encrypting OAuth tokens
});

// Export types
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type LinearSystemConfig = z.infer<typeof LinearSystemConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type VCSSystemConfig = z.infer<typeof VCSSystemConfigSchema>;
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

// Unified config interface
export interface DevFlowConfig {
  app: AppConfig;
  linear: LinearSystemConfig;
  ai: AIConfig;
  vcs: VCSSystemConfig;
  oauth: OAuthConfig;
}

/**
 * Load and validate all configuration from environment variables
 *
 * IMPORTANT: Can only be called in contexts with process.env access:
 * - API server initialization
 * - Worker initialization
 * - Activity functions
 *
 * CANNOT be called in Temporal workflows (sandboxed environment)
 */
export function loadConfig(): DevFlowConfig {
  if (typeof process === 'undefined') {
    throw new Error(
      'loadConfig() cannot be called in Temporal workflows. ' +
      'Use config passed via WorkflowInput instead.'
    );
  }

  const appConfig = AppConfigSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/devflow',
    },
    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    },
  });

  const linearConfig = LinearSystemConfigSchema.parse({
    statuses: {
      // Generic
      inReview: process.env.LINEAR_STATUS_IN_REVIEW || 'In Review',
      done: process.env.LINEAR_STATUS_DONE || 'Done',
      blocked: process.env.LINEAR_STATUS_BLOCKED || 'Blocked',
      // Backlog
      backlog: process.env.LINEAR_STATUS_BACKLOG || 'Backlog',
      // Refinement
      toRefinement: process.env.LINEAR_STATUS_TO_REFINEMENT || 'To Refinement',
      refinementInProgress: process.env.LINEAR_STATUS_REFINEMENT_IN_PROGRESS || 'Refinement In Progress',
      refinementReady: process.env.LINEAR_STATUS_REFINEMENT_READY || 'Refinement Ready',
      refinementFailed: process.env.LINEAR_STATUS_REFINEMENT_FAILED || 'Refinement Failed',
      // User Story
      toUserStory: process.env.LINEAR_STATUS_TO_USER_STORY || 'Refinement Ready',
      userStoryInProgress: process.env.LINEAR_STATUS_USER_STORY_IN_PROGRESS || 'UserStory In Progress',
      userStoryReady: process.env.LINEAR_STATUS_USER_STORY_READY || 'UserStory Ready',
      userStoryFailed: process.env.LINEAR_STATUS_USER_STORY_FAILED || 'UserStory Failed',
      // Technical Plan
      toPlan: process.env.LINEAR_STATUS_TO_PLAN || 'UserStory Ready',
      planInProgress: process.env.LINEAR_STATUS_PLAN_IN_PROGRESS || 'Plan In Progress',
      planReady: process.env.LINEAR_STATUS_PLAN_READY || 'Plan Ready',
      planFailed: process.env.LINEAR_STATUS_PLAN_FAILED || 'Plan Failed',
    },
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
    specWarningMessage: process.env.LINEAR_SPEC_WARNING_MESSAGE,
  });

  const aiConfig = AIConfigSchema.parse({
    openrouter: process.env.OPENROUTER_API_KEY ? {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    } : undefined,
    anthropic: process.env.ANTHROPIC_API_KEY ? {
      apiKey: process.env.ANTHROPIC_API_KEY,
    } : undefined,
  });

  const vcsConfig = VCSSystemConfigSchema.parse({
    github: {
      token: process.env.GITHUB_TOKEN,
    },
  });

  const oauthConfig = OAuthConfigSchema.parse({
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY,
  });

  return {
    app: appConfig,
    linear: linearConfig,
    ai: aiConfig,
    vcs: vcsConfig,
    oauth: oauthConfig,
  };
}

/**
 * Validate that all required environment variables are set
 * Call this at application startup
 */
export function validateConfig(): void {
  try {
    loadConfig();
    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    throw error;
  }
}
