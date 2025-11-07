/**
 * Project Structure Analyzer - Analyzes codebase structure via GitHub API
 */

import { createLogger } from '@soma-squad-ai/common';
import { GitHubProvider } from '../vcs/github.provider';

export interface ProjectStructure {
  directories: string[];
  mainPaths: {
    src?: string;
    tests?: string;
    docs?: string;
    config?: string;
  };
  framework?: string;
  language: string;
  fileCount: number;
  summary: string;
}

const logger = createLogger('StructureAnalyzer');

/**
 * Analyze project structure from GitHub repository
 */
export async function analyzeStructure(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<ProjectStructure> {
  logger.info('Analyzing project structure', { owner, repo });

  try {
    // Get complete file tree
    const tree = await githubProvider.getRepositoryTree(owner, repo);

    // Get languages
    const languages = await githubProvider.getRepositoryLanguages(owner, repo);
    const primaryLanguage = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Extract directories
    const directories = Array.from(
      new Set(
        tree
          .filter((item) => item.type === 'tree')
          .map((item) => item.path)
          .filter((path) => !path.includes('node_modules') && !path.includes('.git')),
      ),
    );

    // Identify main paths
    const mainPaths = {
      src: findDirectory(directories, ['src', 'lib', 'app', 'packages']),
      tests: findDirectory(directories, ['test', 'tests', '__tests__', 'spec', 'e2e']),
      docs: findDirectory(directories, ['docs', 'documentation', '.github']),
      config: findDirectory(directories, ['config', 'configuration', '.config']),
    };

    // Detect framework
    const framework = await detectFramework(githubProvider, owner, repo, tree);

    // File count (excluding common large directories)
    const fileCount = tree.filter(
      (item) =>
        item.type === 'blob' &&
        !item.path.includes('node_modules') &&
        !item.path.includes('.git') &&
        !item.path.includes('dist') &&
        !item.path.includes('build'),
    ).length;

    // Generate summary
    const summary = generateStructureSummary({
      directories,
      mainPaths,
      framework,
      language: primaryLanguage,
      fileCount,
    });

    return {
      directories,
      mainPaths,
      framework,
      language: primaryLanguage,
      fileCount,
      summary,
    };
  } catch (error) {
    logger.error('Failed to analyze structure', error as Error);
    throw error;
  }
}

/**
 * Find a directory from a list of possible names
 */
function findDirectory(directories: string[], possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    const found = directories.find((dir) => {
      const parts = dir.split('/');
      return parts[0] === name || parts.some((part) => part === name);
    });
    if (found) return found;
  }
  return undefined;
}

/**
 * Detect framework from configuration files and package.json
 */
async function detectFramework(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  tree: Array<{ path: string; type: string }>,
): Promise<string | undefined> {
  // Check for common framework indicator files
  const frameworkIndicators: Record<string, string> = {
    'next.config.js': 'Next.js',
    'next.config.ts': 'Next.js',
    'nuxt.config.js': 'Nuxt.js',
    'nuxt.config.ts': 'Nuxt.js',
    'angular.json': 'Angular',
    'vue.config.js': 'Vue.js',
    'svelte.config.js': 'Svelte',
    'remix.config.js': 'Remix',
    'gatsby-config.js': 'Gatsby',
    'nest-cli.json': 'NestJS',
    'Cargo.toml': 'Rust',
    'go.mod': 'Go',
    'requirements.txt': 'Python',
    'setup.py': 'Python',
    'composer.json': 'PHP',
  };

  for (const [file, framework] of Object.entries(frameworkIndicators)) {
    if (tree.some((item) => item.path === file)) {
      return framework;
    }
  }

  // Try to detect from package.json
  try {
    const packageJsonExists = tree.some((item) => item.path === 'package.json');
    if (packageJsonExists) {
      const packageJson = await githubProvider.getFileContent(owner, repo, 'package.json');
      const parsed = JSON.parse(packageJson);
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };

      if (deps['next']) return 'Next.js';
      if (deps['nuxt']) return 'Nuxt.js';
      if (deps['@angular/core']) return 'Angular';
      if (deps['vue']) return 'Vue.js';
      if (deps['svelte']) return 'Svelte';
      if (deps['@remix-run/react']) return 'Remix';
      if (deps['gatsby']) return 'Gatsby';
      if (deps['@nestjs/core']) return 'NestJS';
      if (deps['react']) return 'React';
      if (deps['express']) return 'Express';
      if (deps['fastify']) return 'Fastify';
    }
  } catch (error) {
    logger.warn('Could not read package.json for framework detection');
  }

  return undefined;
}

/**
 * Generate a human-readable summary of the structure
 */
function generateStructureSummary(structure: Omit<ProjectStructure, 'summary'>): string {
  const parts: string[] = [];

  parts.push(`This is a ${structure.language} project`);

  if (structure.framework) {
    parts.push(`using ${structure.framework}`);
  }

  if (structure.mainPaths.src) {
    parts.push(`with source code in ${structure.mainPaths.src}/`);
  }

  if (structure.mainPaths.tests) {
    parts.push(`tests in ${structure.mainPaths.tests}/`);
  }

  parts.push(`The project contains ${structure.fileCount} files`);

  parts.push(`across ${structure.directories.length} directories`);

  return parts.join(', ') + '.';
}
