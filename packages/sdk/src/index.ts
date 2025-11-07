/**
 * DevFlow SDK - Main exports
 */

// VCS Drivers
export * from './vcs';

// CI Drivers
export * from './ci';

// Notion Client - export everything except NotionConfig (handled below)
export { NotionClient } from './notion/notion.client';
export { NotionMapper } from './notion/notion.mapper';
export { formatSpecAsMarkdown } from './notion/spec-formatter';
export type {
  NotionFieldMapping,
  NotionTask,
  NotionPage,
  NotionDatabaseQuery,
} from './notion/notion.types';

// Phase 3: Project Adapter & Agents
export * from './project-adapter';
export * from './agents';

// Phase 4: Security & Governance
export * from './security';

// Codebase Analysis
export * from './codebase';

// Factory functions
export * from './factories';

// Re-export NotionConfig types explicitly with aliases to avoid ambiguity
export type { NotionConfig as NotionClientConfig } from './notion/notion.types';
export type { NotionConfig as NotionProfileConfig } from './project-adapter/soma-squad-ai-profile.types';
