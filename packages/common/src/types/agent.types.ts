/**
 * Agent Types - For AI code agents
 */

export interface AgentPrompt {
  system: string;
  user: string;
}

export interface AgentResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface SpecGenerationInput {
  task: {
    title: string;
    description: string;
    priority: string;
  };
  project: {
    language: string;
    framework?: string;
  };
  existingFiles?: string[];
}

export interface SpecGenerationOutput {
  architecture: string[];
  implementationSteps: string[];
  testingStrategy: string;
  risks: string[];
  estimatedTime: number;
  dependencies?: string[];
  technicalDecisions?: string[];
}

export interface CodeGenerationInput {
  task: {
    title: string;
    description: string;
  };
  spec: SpecGenerationOutput;
  projectStructure: string;
  relevantFiles: Array<{
    path: string;
    content: string;
  }>;
}

export interface CodeGenerationOutput {
  files: Array<{
    path: string;
    action: 'create' | 'update' | 'delete';
    content: string;
    reason: string;
  }>;
  commitMessage: string;
  prDescription: string;
}

export interface FixGenerationInput {
  errorLogs: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  testFailures?: Array<{
    name: string;
    message: string;
    stackTrace?: string;
  }>;
  previousAttempts?: number;
}

export interface FixGenerationOutput {
  files: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
  analysis: string;
  commitMessage: string;
}
