/**
 * Configuration that can be safely passed to Temporal workflows
 * Must be serializable (no functions, no complex objects)
 */
export interface WorkflowConfig {
  linear: {
    statuses: {
      // Generic statuses (kept for compatibility with other flows)
      inReview: string;
      done: string;
      blocked: string;

      // Three-phase Agile workflow
      // Phase 0: Backlog
      backlog: string;

      // Phase 1: Refinement
      toRefinement: string;
      refinementInProgress: string;
      refinementReady: string;
      refinementFailed: string;

      // Phase 2: User Story
      toUserStory: string;
      userStoryInProgress: string;
      userStoryReady: string;
      userStoryFailed: string;

      // Phase 3: Technical Plan
      toPlan: string;
      planInProgress: string;
      planReady: string;
      planFailed: string;

      // Legacy statuses (for backward compatibility with spec-generation workflow)
      specInProgress?: string;
      specReady?: string;
      specFailed?: string;
      specification?: string;
      triggerStatus?: string;
      nextStatus?: string;
    };

    /**
     * Ordered list of statuses from least progressed to most progressed.
     * Used for parent rollup logic (parent = minimum status of children).
     */
    statusOrder: string[];

    /**
     * Workflow behavior configuration
     */
    workflow: {
      /** Statuses that trigger a workflow when an issue moves to them */
      triggerStatuses: string[];

      /** Statuses that cascade to children (not "To Refinement" since children don't exist yet) */
      cascadeStatuses: string[];

      /** Statuses that trigger parent rollup when a child reaches them */
      rollupStatuses: string[];
    };

    features?: {
      // Enable automatic subtask creation in refinement phase for L/XL complexity
      enableSubtaskCreation?: boolean; // default: true
    };
  };
  // Can add more workflow-safe config here as needed
}

/**
 * Default workflow configuration (used as fallback)
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  linear: {
    statuses: {
      // Generic
      inReview: 'In Review',
      done: 'Done',
      blocked: 'Blocked',

      // Backlog
      backlog: 'Backlog',

      // Refinement
      toRefinement: 'To Refinement',
      refinementInProgress: 'Refinement In Progress',
      refinementReady: 'Refinement Ready',
      refinementFailed: 'Refinement Failed',

      // User Story
      toUserStory: 'To User Story', // Explicit trigger (no auto-chain)
      userStoryInProgress: 'UserStory In Progress',
      userStoryReady: 'UserStory Ready',
      userStoryFailed: 'UserStory Failed',

      // Technical Plan
      toPlan: 'To Plan', // Explicit trigger (no auto-chain)
      planInProgress: 'Plan In Progress',
      planReady: 'Plan Ready',
      planFailed: 'Plan Failed',

      // Legacy (backward compatibility)
      specInProgress: 'Spec In Progress',
      specReady: 'Spec Ready',
      specFailed: 'Spec Failed',
      specification: 'Specification',
      triggerStatus: 'To Spec',
      nextStatus: 'In Development',
    },

    // Ordered from least progressed to most progressed
    statusOrder: [
      'To Refinement',
      'Refinement In Progress',
      'Refinement Failed',
      'Refinement Ready',
      'To User Story',
      'UserStory In Progress',
      'UserStory Failed',
      'UserStory Ready',
      'To Plan',
      'Plan In Progress',
      'Plan Failed',
      'Plan Ready',
      'Done',
    ],

    workflow: {
      // Statuses that trigger a workflow
      triggerStatuses: ['To Refinement', 'To User Story', 'To Plan'],

      // Statuses that cascade to children (not To Refinement - children don't exist yet)
      cascadeStatuses: ['To User Story', 'To Plan'],

      // Statuses that trigger parent rollup
      rollupStatuses: ['Refinement Ready', 'UserStory Ready', 'Plan Ready', 'Done'],
    },

    features: {
      enableSubtaskCreation: true, // Enable by default
    },
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the rank (index) of a status in the hierarchy.
 * Lower rank = less progressed, Higher rank = more progressed.
 * Returns statusOrder.length if status not found (treated as "beyond all known statuses").
 */
export function getStatusRank(
  status: string,
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG
): number {
  const index = config.linear.statusOrder.findIndex(
    (s) => s.toLowerCase() === status.toLowerCase()
  );
  return index === -1 ? config.linear.statusOrder.length : index;
}

/**
 * Check if a status triggers a workflow
 */
export function isTriggerStatus(
  status: string,
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG
): boolean {
  return config.linear.workflow.triggerStatuses.some(
    (s) => s.toLowerCase() === status.toLowerCase()
  );
}

/**
 * Check if a status should cascade to children
 */
export function isCascadeStatus(
  status: string,
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG
): boolean {
  return config.linear.workflow.cascadeStatuses.some(
    (s) => s.toLowerCase() === status.toLowerCase()
  );
}

/**
 * Check if a status should trigger parent rollup
 */
export function isRollupStatus(
  status: string,
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG
): boolean {
  return config.linear.workflow.rollupStatuses.some(
    (s) => s.toLowerCase() === status.toLowerCase()
  );
}

/**
 * Get the status name at a given rank
 */
export function getStatusAtRank(
  rank: number,
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG
): string | undefined {
  return config.linear.statusOrder[rank];
}
