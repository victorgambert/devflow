/**
 * DevFlow SDK - Main exports
 */

// VCS Drivers
export * from './vcs';

// CI Drivers
export * from './ci';

// Linear Client
export { LinearClient, createLinearClient, type LinearCustomField } from './linear/linear.client';
export { LinearMapper } from './linear/linear.mapper';
export {
  LinearSetupService,
  createLinearSetupService,
  DEVFLOW_CUSTOM_FIELDS,
  type DevFlowCustomFieldKey,
  type SetupCustomFieldsResult,
  type ValidateSetupResult,
} from './linear/linear-setup.service';
export {
  LabelService,
  createLabelService,
  TASK_TYPE_LABELS,
  type TaskType,
} from './linear/label.service';
export {
  formatSpecAsMarkdown,
  formatWarningMessage,
  formatSpecWithWarning,
  formatRefinementAsMarkdown,
  formatUserStoryAsMarkdown,
  formatTechnicalPlanAsMarkdown,
} from './linear/spec-formatter';
export {
  LinearSyncService,
  createLinearSyncService,
  TASK_TO_LINEAR_FIELD_MAP,
  type TaskFieldKey,
  type SyncDirection,
  type LinearFullIssue,
  type TaskSyncData,
  type SyncDiff,
  type SyncResult,
} from './linear/linear-sync.service';
export type {
  LinearConfig,
  LinearIssue,
  LinearLabel,
  LinearTask,
  LinearState,
  LinearTeam,
  LinearUser,
  LinearWebhookPayload,
  LinearQueryOptions,
} from './linear/linear.types';

// Phase 3: Project Adapter & Agents
export * from './project-adapter';
export * from './agents';

// Phase 4: Security & Governance
export * from './security';

// Codebase Analysis
export * from './codebase';

// RAG (Retrieval-Augmented Generation)
export * from './rag';

// Auth
export * from './auth';

// Figma
export * from './figma';

// Sentry
export * from './sentry';

// Factory functions
export * from './factories';
