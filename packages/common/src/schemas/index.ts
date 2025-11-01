/**
 * Zod validation schemas
 */

import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string(),
    description: z.string(),
    repository: z.string().url(),
    language: z.string(),
    framework: z.string().optional(),
  }),
  notion: z
    .object({
      enabled: z.boolean(),
      database_id: z.string(),
      field_mapping: z.object({
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        assignee: z.string(),
        epic: z.string().optional(),
        story_points: z.string().optional(),
      }),
    })
    .optional(),
  vcs: z.object({
    provider: z.enum(['github', 'gitlab', 'bitbucket']),
    base_branch: z.string(),
    branch_pattern: z.string(),
    pr_template: z.string().optional(),
    reviewers: z.array(z.string()).optional(),
  }),
  commands: z.object({
    install: z.string(),
    build: z.string(),
    lint: z.string(),
    unit: z.string(),
    e2e: z.string(),
    migrate: z.string().optional(),
    custom: z.record(z.string()).optional(),
  }),
  ci: z.object({
    provider: z.enum(['github-actions', 'gitlab-ci', 'bitbucket-pipelines', 'jenkins', 'circleci']),
    config_path: z.string(),
    artifacts: z
      .object({
        coverage: z.string().optional(),
        test_results: z.string().optional(),
        build_output: z.string().optional(),
      })
      .optional(),
  }),
  code_agent: z.object({
    provider: z.enum(['anthropic', 'openai', 'cursor']),
    model: z.string(),
    prompts: z
      .object({
        spec: z.string().optional(),
        implementation: z.string().optional(),
        fix: z.string().optional(),
      })
      .optional(),
  }),
  quality_gates: z.object({
    required: z.array(z.string()),
    optional: z.array(z.string()).optional(),
    coverage: z
      .object({
        lines: z.number().min(0).max(100),
        branches: z.number().min(0).max(100),
        functions: z.number().min(0).max(100),
        statements: z.number().min(0).max(100),
      })
      .optional(),
  }),
  notifications: z.object({
    events: z.array(z.string()),
    channels: z.object({
      slack: z
        .object({
          enabled: z.boolean(),
          webhook_url: z.string(),
        })
        .optional(),
      discord: z
        .object({
          enabled: z.boolean(),
          webhook_url: z.string(),
        })
        .optional(),
      email: z
        .object({
          enabled: z.boolean(),
          recipients: z.array(z.string()),
        })
        .optional(),
    }),
  }),
  files: z.object({
    watch: z.array(z.string()),
    ignore: z.array(z.string()),
  }),
  advanced: z
    .object({
      parallel: z.boolean().optional(),
      timeout: z.number().optional(),
      retry: z
        .object({
          enabled: z.boolean(),
          max_attempts: z.number(),
          backoff: z.enum(['linear', 'exponential']),
        })
        .optional(),
      workspace: z
        .object({
          clean: z.boolean(),
          path: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type ProjectConfigSchemaType = z.infer<typeof ProjectConfigSchema>;

