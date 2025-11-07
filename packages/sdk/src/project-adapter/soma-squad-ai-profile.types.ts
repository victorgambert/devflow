/**
 * Soma Squad AI Profile Types - Extended for Phase 3 & 4
 */

export interface SomaSquadAIProfile {
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
  // Phase 3
  guardrails?: GuardrailsConfig;
  testing?: TestingConfig;
  // Phase 4: New fields
  governance?: GovernanceConfig;
  budget?: BudgetConfigYAML;
  auto_merge?: AutoMergeConfigYAML;
}

export interface ProjectMetadata {
  name: string;
  description: string;
  repository: string;
  language: string;
  framework?: string;
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
    acceptance_criteria?: string;  // Phase 3
  };
}

export interface VCSConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  base_branch: string;
  branch_pattern: string;
  pr_template?: string;
  reviewers?: string[];
}

export interface CommandsConfig {
  // Standard commands
  setup?: string;
  install: string;
  build: string;
  lint: string;
  unit: string;
  e2e: string;
  fmt?: string;
  migrate?: string;
  
  // Custom commands
  custom?: Record<string, string>;
}

export interface CIConfig {
  provider: 'github-actions' | 'gitlab-ci' | 'bitbucket-pipelines' | 'jenkins' | 'circleci';
  config_path: string;
  artifacts?: {
    coverage?: string;
    test_results?: string;
    build_output?: string;
  };
}

export interface CodeAgentConfig {
  provider: 'anthropic' | 'openai' | 'cursor';
  model: string;
  prompts?: {
    spec?: string;
    implementation?: string;
    fix?: string;
    test?: string;
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

// ============================================
// Phase 3: Guardrails & Testing
// ============================================

export interface GuardrailsConfig {
  allow_write_paths: string[];
  forbidden_paths?: string[];
  max_commits?: number;
  codeowners?: {
    enabled: boolean;
    path: string;
    require_approval?: boolean;
  };
  max_file_size_kb?: number;
  max_total_changes?: number;
}

export interface TestingConfig {
  generate_tests: boolean;
  test_types: ('unit' | 'integration' | 'e2e')[];
  framework?: string;
  patterns?: {
    unit?: string;
    integration?: string;
    e2e?: string;
  };
  coverage_threshold?: {
    lines?: number;
    branches?: number;
    functions?: number;
    statements?: number;
  };
  auto_fix: {
    enabled: boolean;
    max_attempts: number;
    strategies: ('regenerate' | 'patch' | 'revert')[];
  };
}

// ============================================
// Phase 4: Governance & Budget
// ============================================

export interface GovernanceConfig {
  // Audit settings
  audit: {
    enabled: boolean;
    persist: boolean;  // Persist to database
    retention_days?: number;
  };
  
  // Security scanning
  security: {
    scan_for_secrets: boolean;
    scan_for_vulnerabilities: boolean;
    allowed_licenses?: string[];
    forbidden_patterns?: string[];  // Regex patterns as strings
  };
  
  // Branch protection
  branch_protection?: {
    enabled: boolean;
    rules: Array<{
      pattern: string;  // Branch pattern (e.g., 'main', 'release/*')
      requires_review: boolean;
      required_reviewers: number;
      requires_status_checks: boolean;
      required_status_checks?: string[];
      enforce_admins: boolean;
      allow_force_push: boolean;
      allow_deletions: boolean;
    }>;
  };
  
  // Workflow iteration limits
  iteration_limits?: {
    max_fix_attempts: number;  // Max CI fix attempts
    max_test_fix_attempts: number;  // Max test fix attempts
    max_workflow_duration_minutes: number;
  };
}

export interface BudgetConfigYAML {
  enabled: boolean;
  
  // Budget limits (USD)
  limits: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    per_workflow?: number;
    per_project?: number;
  };
  
  // Token limits
  tokens?: {
    max_per_request?: number;
    max_per_workflow?: number;
    max_per_day?: number;
  };
  
  // Actions
  warning_threshold?: number;  // Percentage (default: 80)
  block_on_exceeded?: boolean;  // Default: true
  alert_on_exceeded?: boolean;  // Default: true
}

export interface AutoMergeConfigYAML {
  enabled: boolean;
  
  // Required conditions
  require_all_checks_pass: boolean;
  require_reviews: boolean;
  min_reviews: number;
  require_codeowners_approval: boolean;
  
  // Quality gates
  min_coverage?: number;
  max_failed_tests?: number;
  require_lint_pass: boolean;
  require_build_pass: boolean;
  
  // Security gates
  allow_with_security_warnings: boolean;
  allow_with_policy_violations: boolean;
  
  // Limitations
  max_files_changed?: number;
  max_lines_changed?: number;
  max_commits?: number;
  
  // Timing
  merge_delay?: number;  // Wait N seconds
  merge_schedule?: {
    allowed_hours?: [number, number];
    allowed_days?: string[];
    timezone?: string;
  };
  
  // Labels
  require_labels?: string[];
  blocking_labels?: string[];
  override_with?: string;  // Label that overrides rules
}

// ============================================
// Command Execution Results
// ============================================

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
}

export interface CommandExecutionContext {
  workspacePath: string;
  profile: SomaSquadAIProfile;
  environment?: Record<string, string>;
  timeout?: number;
}

// ============================================
// Guardrails Validation
// ============================================

export interface GuardrailsViolation {
  type: 'forbidden_path' | 'outside_allowed_paths' | 'max_commits_exceeded' | 'codeowners_required' | 'file_too_large' | 'too_many_changes';
  message: string;
  details?: any;
}

export interface GuardrailsValidationResult {
  valid: boolean;
  violations: GuardrailsViolation[];
}
