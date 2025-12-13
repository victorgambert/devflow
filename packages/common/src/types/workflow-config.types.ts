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
      toUserStory: 'Refinement Ready', // Auto-trigger par défaut
      userStoryInProgress: 'UserStory In Progress',
      userStoryReady: 'UserStory Ready',
      userStoryFailed: 'UserStory Failed',

      // Technical Plan
      toPlan: 'UserStory Ready', // Auto-trigger par défaut
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
    features: {
      enableSubtaskCreation: true, // Enable by default
    },
  },
};
