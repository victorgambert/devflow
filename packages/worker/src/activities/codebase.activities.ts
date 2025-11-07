/**
 * Codebase Analysis Activities
 */

import { createLogger } from '@soma-squad-ai/common';
import { GitHubProvider, analyzeRepository, CodebaseContext } from '@soma-squad-ai/sdk';
import { PrismaClient } from '@prisma/client';

const logger = createLogger('CodebaseActivities');
const prisma = new PrismaClient();

export interface AnalyzeRepositoryInput {
  projectId: string;
  taskDescription?: string;
}

/**
 * Analyze repository context using GitHub API
 */
export async function analyzeRepositoryContext(
  input: AnalyzeRepositoryInput,
): Promise<CodebaseContext> {
  logger.info('Analyzing repository context', input);

  try {
    // Get project from database
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    const config = project.config as any;

    // Extract repository info from config
    const owner = config?.vcs?.owner || config?.project?.owner;
    const repo = config?.vcs?.repo || config?.project?.repo;

    if (!owner || !repo) {
      throw new Error(`Repository owner/repo not configured for project ${input.projectId}`);
    }

    logger.info('Repository info extracted', { owner, repo });

    // Get GitHub token
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
    if (!token) {
      throw new Error('GitHub token not configured (GITHUB_TOKEN or GITHUB_APP_TOKEN)');
    }

    // Create GitHub provider
    const github = new GitHubProvider(token);

    // Verify repository access
    try {
      await github.getRepository(owner, repo);
    } catch (error) {
      logger.error('Cannot access repository', error as Error, { owner, repo });
      throw new Error(`Cannot access repository ${owner}/${repo}. Check token permissions.`);
    }

    // Analyze repository
    logger.info('Starting repository analysis', { owner, repo });
    const context = await analyzeRepository(github, owner, repo, input.taskDescription);

    logger.info('Repository analysis completed', {
      owner,
      repo,
      language: context.structure.language,
      framework: context.structure.framework,
      dependencies: context.dependencies.mainLibraries.length,
      similarCode: context.similarCode.length,
    });

    return context;
  } catch (error) {
    logger.error('Failed to analyze repository context', error as Error, input);
    throw error;
  }
}

/**
 * Get project repository configuration
 */
export async function getProjectRepositoryConfig(projectId: string): Promise<{
  owner: string;
  repo: string;
  provider: string;
  url: string;
}> {
  logger.info('Getting project repository config', { projectId });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const config = project.config as any;

  const owner = config?.vcs?.owner || config?.project?.owner;
  const repo = config?.vcs?.repo || config?.project?.repo;
  const provider = config?.vcs?.provider || 'github';

  if (!owner || !repo) {
    throw new Error(`Repository not configured for project ${projectId}`);
  }

  return {
    owner,
    repo,
    provider,
    url: project.repository,
  };
}
