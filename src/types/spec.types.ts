/**
 * Spec Engine Types
 * All interfaces for the specification pipeline stages and outputs
 */

/**
 * Stage 1 Output: Refined and structured user story
 */
export interface RefinedUserStory {
  summary: string;
  context: string;
  objectives: string[];
  constraints: string[];
  dependencies: string[];
  acceptance_criteria: string[];
  risks: string[];
}

/**
 * Stage 2 Output: Implementation plan from a single LLM
 */
export interface MultiLLMPlan {
  model: string;
  architecture_overview: string;
  technical_steps: string[];
  tradeoffs: string[];
  risks_and_unknowns: string[];
  implementation_notes: string[];
}

/**
 * Stage 3 Output: Research insights from Perplexity
 */
export interface ResearchInsights {
  best_practices: string[];
  patterns: string[];
  pitfalls: string[];
  benchmarks: string[];
  recommendations: string[];
}

/**
 * Stage 4 Output: Final synthesized master plan
 */
export interface MasterPlan {
  summary: string;
  recommended_architecture: string;
  detailed_steps: string[];
  key_decisions: string[];
  acceptance_criteria: string[];
  dependencies: string[];
  risks_and_mitigations: string[];
  open_questions: string[];
  checklist_before_dev: string[];
}

/**
 * Complete output from the spec engine pipeline
 */
export interface SpecEngineOutput {
  refined_user_story: RefinedUserStory;
  multi_llm_plans: MultiLLMPlan[];
  research_insights: ResearchInsights;
  master_plan: MasterPlan;
}

/**
 * Configuration for the spec engine
 */
export interface SpecEngineConfig {
  refineModel: string;
  plannerModels: string[];
  researchModel: string;
  synthesizerModel: string;
}
