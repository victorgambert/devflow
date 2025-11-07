/**
 * Project Configuration Types
 */

export interface ProjectConfig {
  version: string;
  project: ProjectMetadata;
  notion?: NotionConfig;
  vcs: VCSConfig;
  commands: CommandsConfig;
  ci: CIConfig;
  code_agent: CodeAgentConfig;
  quality_gates: QualityGatesConfig;
  notifications: NotificationsConfig;
  files: FilesConfig;
  advanced?: AdvancedConfig;
}

export interface ProjectMetadata {
  name: string;
  description: string;
  repository: string;
  language: string;
  framework?: string;
  owner?: string; // Repository owner (parsed from URL)
  repo?: string; // Repository name (parsed from URL)
}

export interface NotionConfig {
  enabled: boolean;
  database_id: string;
  field_mapping: {
    title: string;
    status: string;
    priority: string;
    assignee: string;
    epic?: string;
    story_points?: string;
  };
}

export interface VCSConfig {
  provider: 'github';
  owner?: string; // Repository owner
  repo?: string; // Repository name
  base_branch: string;
  branch_pattern: string;
  pr_template?: string;
  reviewers?: string[];
}

export interface CommandsConfig {
  install: string;
  build: string;
  lint: string;
  unit: string;
  e2e: string;
  migrate?: string;
  custom?: Record<string, string>;
}

export interface CIConfig {
  provider: 'github-actions';
  config_path: string;
  artifacts?: {
    coverage?: string;
    test_results?: string;
    build_output?: string;
  };
}

export interface CodeAgentConfig {
  provider: 'anthropic';
  model: string;
  prompts?: {
    spec?: string;
    implementation?: string;
    fix?: string;
  };
}

export interface QualityGatesConfig {
  required: string[];
  optional?: string[];
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
}

export interface NotificationsConfig {
  events: string[];
  channels: {
    slack?: { enabled: boolean; webhook_url: string };
    discord?: { enabled: boolean; webhook_url: string };
    email?: { enabled: boolean; recipients: string[] };
  };
}

export interface FilesConfig {
  watch: string[];
  ignore: string[];
}

export interface AdvancedConfig {
  parallel?: boolean;
  timeout?: number;
  retry?: {
    enabled: boolean;
    max_attempts: number;
    backoff: 'linear' | 'exponential';
  };
  workspace?: {
    clean: boolean;
    path: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  repository: string;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

