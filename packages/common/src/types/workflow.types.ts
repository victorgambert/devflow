/**
 * Workflow Types - Enhanced for Phase 3
 */

export enum WorkflowStage {
  NOTION_SYNC = 'notion_sync',
  SPEC_GENERATION = 'spec_generation',
  CODE_GENERATION = 'code_generation',
  PR_CREATION = 'pr_creation',
  CI_EXECUTION = 'ci_execution',
  QA_TESTING = 'qa_testing',
  FIX_GENERATION = 'fix_generation',
  MERGE = 'merge',
  NOTIFICATION = 'notification',
}

export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface WorkflowInput {
  taskId: string;
  projectId: string;
  options?: {
    skipTests?: boolean;
    skipCI?: boolean;
    autoMerge?: boolean;
  };
}

export interface WorkflowResult {
  success: boolean;
  stage: WorkflowStage;
  error?: string;
  data?: any;
  timestamp: Date;
}

// Phase 3: Extended result data
export interface WorkflowResultData {
  task?: any;
  pr?: any;
  branchName?: string;
  fixAttempts?: number;
  testFixAttempts?: number;
  testsGenerated?: number;
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  completed: boolean;
}
