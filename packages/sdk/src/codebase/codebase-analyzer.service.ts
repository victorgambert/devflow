/**
 * Codebase Analyzer Service - Orchestrates all analyzers to provide complete codebase context
 */

import { createLogger } from '@devflow/common';
import { GitHubProvider } from '../vcs/github.provider';
import { analyzeStructure, ProjectStructure } from './structure-analyzer';
import { analyzeDependencies, DependencyInfo } from './dependency-analyzer';
import { findSimilarCode, SimilarCode } from './code-similarity.service';
import { scanDocumentation, DocumentationInfo } from './documentation-scanner';

const logger = createLogger('CodebaseAnalyzer');

/**
 * Complete codebase context
 */
export interface CodebaseContext {
  structure: ProjectStructure;
  dependencies: DependencyInfo;
  similarCode: SimilarCode[];
  documentation: DocumentationInfo;
  timestamp: Date;
}

/**
 * Analyze complete repository context
 */
export async function analyzeRepository(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  taskDescription?: string,
): Promise<CodebaseContext> {
  logger.info('Analyzing repository', { owner, repo });

  const startTime = Date.now();

  try {
    // Run all analyzers in parallel for better performance
    const [structure, documentation] = await Promise.all([
      analyzeStructure(githubProvider, owner, repo),
      scanDocumentation(githubProvider, owner, repo),
    ]);

    // Dependencies analysis needs the language from structure
    const dependencies = await analyzeDependencies(githubProvider, owner, repo, structure.language);

    // Similar code search is optional and based on task description
    let similarCode: SimilarCode[] = [];
    if (taskDescription) {
      try {
        similarCode = await findSimilarCode(githubProvider, owner, repo, taskDescription);
      } catch (error) {
        logger.warn('Similar code search failed', error as Error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Repository analysis completed', { owner, repo, duration });

    return {
      structure,
      dependencies,
      similarCode,
      documentation,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to analyze repository', error as Error);
    throw error;
  }
}

/**
 * Generate a human-readable summary of the codebase context
 */
export function generateCodebaseSummary(context: CodebaseContext): string {
  const parts: string[] = [];

  // Structure summary
  parts.push(context.structure.summary);

  // Dependencies summary
  if (context.dependencies.summary) {
    parts.push(context.dependencies.summary);
  }

  // Documentation summary
  if (context.documentation.summary) {
    parts.push(context.documentation.summary);
  }

  // Similar code
  if (context.similarCode.length > 0) {
    parts.push(`Found ${context.similarCode.length} similar code examples`);
  }

  return parts.join(' ');
}

/**
 * Format codebase context for AI prompt
 */
export function formatContextForAI(context: CodebaseContext): string {
  const sections: string[] = [];

  // Project Structure
  sections.push('## Project Structure');
  sections.push(context.structure.summary);
  sections.push('');
  sections.push(`**Language:** ${context.structure.language}`);
  if (context.structure.framework) {
    sections.push(`**Framework:** ${context.structure.framework}`);
  }
  if (context.structure.mainPaths?.src) {
    sections.push(`**Source:** ${context.structure.mainPaths.src}/`);
  }
  if (context.structure.mainPaths?.tests) {
    sections.push(`**Tests:** ${context.structure.mainPaths.tests}/`);
  }
  sections.push('');

  // Dependencies
  sections.push('## Dependencies');
  sections.push(context.dependencies.summary);
  if (context.dependencies.mainLibraries.length > 0) {
    sections.push('');
    sections.push('**Main libraries:**');
    context.dependencies.mainLibraries.slice(0, 10).forEach((lib) => {
      sections.push(`- ${lib}`);
    });
  }
  sections.push('');

  // Documentation & Conventions
  sections.push('## Documentation & Conventions');
  sections.push(context.documentation.summary);
  if (context.documentation.conventions.length > 0) {
    sections.push('');
    sections.push('**Conventions:**');
    context.documentation.conventions.slice(0, 5).forEach((conv) => {
      sections.push(`- ${conv}`);
    });
  }
  if (context.documentation.patterns.length > 0) {
    sections.push('');
    sections.push('**Patterns:**');
    context.documentation.patterns.slice(0, 5).forEach((pattern) => {
      sections.push(`- ${pattern}`);
    });
  }
  sections.push('');

  // Similar Code Examples
  if (context.similarCode.length > 0) {
    sections.push('## Similar Code Examples');
    context.similarCode.slice(0, 3).forEach((code, index) => {
      sections.push(`### Example ${index + 1}: ${code.path}`);
      sections.push(`**Reason:** ${code.reason}`);
      sections.push('```');
      sections.push(code.content.substring(0, 1000)); // Limit content length
      if (code.content.length > 1000) {
        sections.push('... (truncated)');
      }
      sections.push('```');
      sections.push('');
    });
  }

  return sections.join('\n');
}

/**
 * Extract key information for spec generation
 */
export function extractSpecGenerationContext(context: CodebaseContext): {
  language: string;
  framework?: string;
  dependencies: string[];
  conventions: string[];
  patterns: string[];
  testingApproach?: string;
} {
  return {
    language: context.structure.language,
    framework: context.structure.framework,
    dependencies: context.dependencies?.mainLibraries || [],
    conventions: context.documentation?.conventions || [],
    patterns: context.documentation?.patterns || [],
    testingApproach: context.structure.mainPaths?.tests
      ? `Tests are located in ${context.structure.mainPaths.tests}/`
      : undefined,
  };
}

/**
 * Extract key information for code generation
 */
export function extractCodeGenerationContext(context: CodebaseContext): {
  projectStructure: string;
  relevantFiles: Array<{ path: string; content: string }>;
  conventions: string[];
  dependencies: string[];
} {
  const structureLines: string[] = [];

  structureLines.push(`Language: ${context.structure.language}`);
  if (context.structure.framework) {
    structureLines.push(`Framework: ${context.structure.framework}`);
  }

  if (context.structure.mainPaths?.src) {
    structureLines.push(`Source: ${context.structure.mainPaths.src}/`);
  }

  if (context.structure.mainPaths?.tests) {
    structureLines.push(`Tests: ${context.structure.mainPaths.tests}/`);
  }

  const mainLibraries = context.dependencies?.mainLibraries || [];
  if (mainLibraries.length > 0) {
    structureLines.push(`\nMain libraries: ${mainLibraries.slice(0, 5).join(', ')}`);
  }

  return {
    projectStructure: structureLines.join('\n'),
    relevantFiles: (context.similarCode || []).map((code) => ({
      path: code.path,
      content: code.content.substring(0, 2000), // Limit content
    })),
    conventions: context.documentation?.conventions || [],
    dependencies: mainLibraries,
  };
}
