/**
 * Dependency Analyzer - Analyzes project dependencies via GitHub API
 */

import { createLogger } from '@soma-squad-ai/common';
import { GitHubProvider } from '../vcs/github.provider';

export interface DependencyInfo {
  production: Record<string, string>;
  dev: Record<string, string>;
  mainLibraries: string[];
  summary: string;
}

const logger = createLogger('DependencyAnalyzer');

/**
 * Analyze project dependencies from GitHub repository
 */
export async function analyzeDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  language: string,
): Promise<DependencyInfo> {
  logger.info('Analyzing dependencies', { owner, repo, language });

  try {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return await analyzeNodeDependencies(githubProvider, owner, repo);

      case 'python':
        return await analyzePythonDependencies(githubProvider, owner, repo);

      case 'rust':
        return await analyzeRustDependencies(githubProvider, owner, repo);

      case 'go':
        return await analyzeGoDependencies(githubProvider, owner, repo);

      case 'php':
        return await analyzePhpDependencies(githubProvider, owner, repo);

      case 'ruby':
        return await analyzeRubyDependencies(githubProvider, owner, repo);

      default:
        logger.warn('Unknown language for dependency analysis', { language });
        return {
          production: {},
          dev: {},
          mainLibraries: [],
          summary: `Dependencies could not be analyzed for ${language}`,
        };
    }
  } catch (error) {
    logger.error('Failed to analyze dependencies', error as Error);
    return {
      production: {},
      dev: {},
      mainLibraries: [],
      summary: 'Dependencies could not be analyzed',
    };
  }
}

/**
 * Analyze Node.js (package.json) dependencies
 */
async function analyzeNodeDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    const packageJson = await githubProvider.getFileContent(owner, repo, 'package.json');
    const parsed = JSON.parse(packageJson);

    const production = parsed.dependencies || {};
    const dev = parsed.devDependencies || {};

    // Extract main libraries (most important ones)
    const mainLibraries = [
      ...Object.keys(production).filter((dep) => isMainLibrary(dep)),
      ...Object.keys(dev).filter((dep) => isMainLibrary(dep)),
    ].slice(0, 10);

    const summary = generateDependencySummary('Node.js', production, dev, mainLibraries);

    return { production, dev, mainLibraries, summary };
  } catch (error) {
    logger.warn('Could not read package.json');
    return { production: {}, dev: {}, mainLibraries: [], summary: 'No package.json found' };
  }
}

/**
 * Analyze Python dependencies
 */
async function analyzePythonDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    // Try requirements.txt first
    const requirementsTxt = await githubProvider.getFileContent(owner, repo, 'requirements.txt');
    const deps = parsePythonRequirements(requirementsTxt);

    const mainLibraries = Object.keys(deps).slice(0, 10);
    const summary = generateDependencySummary('Python', deps, {}, mainLibraries);

    return { production: deps, dev: {}, mainLibraries, summary };
  } catch (error) {
    // Try pyproject.toml
    try {
      const pyproject = await githubProvider.getFileContent(owner, repo, 'pyproject.toml');
      const deps = parsePyprojectToml(pyproject);

      const mainLibraries = Object.keys(deps).slice(0, 10);
      const summary = generateDependencySummary('Python', deps, {}, mainLibraries);

      return { production: deps, dev: {}, mainLibraries, summary };
    } catch (error) {
      logger.warn('Could not read Python dependency files');
      return { production: {}, dev: {}, mainLibraries: [], summary: 'No Python dependency file found' };
    }
  }
}

/**
 * Analyze Rust dependencies
 */
async function analyzeRustDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    const cargoToml = await githubProvider.getFileContent(owner, repo, 'Cargo.toml');
    const deps = parseCargoToml(cargoToml);

    const mainLibraries = Object.keys(deps).slice(0, 10);
    const summary = generateDependencySummary('Rust', deps, {}, mainLibraries);

    return { production: deps, dev: {}, mainLibraries, summary };
  } catch (error) {
    logger.warn('Could not read Cargo.toml');
    return { production: {}, dev: {}, mainLibraries: [], summary: 'No Cargo.toml found' };
  }
}

/**
 * Analyze Go dependencies
 */
async function analyzeGoDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    const goMod = await githubProvider.getFileContent(owner, repo, 'go.mod');
    const deps = parseGoMod(goMod);

    const mainLibraries = Object.keys(deps).slice(0, 10);
    const summary = generateDependencySummary('Go', deps, {}, mainLibraries);

    return { production: deps, dev: {}, mainLibraries, summary };
  } catch (error) {
    logger.warn('Could not read go.mod');
    return { production: {}, dev: {}, mainLibraries: [], summary: 'No go.mod found' };
  }
}

/**
 * Analyze PHP dependencies
 */
async function analyzePhpDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    const composerJson = await githubProvider.getFileContent(owner, repo, 'composer.json');
    const parsed = JSON.parse(composerJson);

    const production = parsed.require || {};
    const dev = parsed['require-dev'] || {};

    const mainLibraries = Object.keys(production).slice(0, 10);
    const summary = generateDependencySummary('PHP', production, dev, mainLibraries);

    return { production, dev, mainLibraries, summary };
  } catch (error) {
    logger.warn('Could not read composer.json');
    return { production: {}, dev: {}, mainLibraries: [], summary: 'No composer.json found' };
  }
}

/**
 * Analyze Ruby dependencies
 */
async function analyzeRubyDependencies(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DependencyInfo> {
  try {
    const gemfile = await githubProvider.getFileContent(owner, repo, 'Gemfile');
    const deps = parseGemfile(gemfile);

    const mainLibraries = Object.keys(deps).slice(0, 10);
    const summary = generateDependencySummary('Ruby', deps, {}, mainLibraries);

    return { production: deps, dev: {}, mainLibraries, summary };
  } catch (error) {
    logger.warn('Could not read Gemfile');
    return { production: {}, dev: {}, mainLibraries: [], summary: 'No Gemfile found' };
  }
}

/**
 * Check if a dependency is considered a "main" library
 */
function isMainLibrary(dep: string): boolean {
  // Framework/important libraries
  const important = [
    'react',
    'vue',
    'angular',
    'next',
    'nuxt',
    'express',
    'fastify',
    'nest',
    '@nestjs/core',
    'typescript',
    'prisma',
    'mongoose',
    'sequelize',
    'axios',
    'graphql',
    'apollo',
    'redux',
    'zustand',
    'tanstack',
  ];

  return important.some((lib) => dep.includes(lib));
}

/**
 * Parse Python requirements.txt
 */
function parsePythonRequirements(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([a-zA-Z0-9-_]+)([>=<]+)?(.*)$/);
    if (match) {
      deps[match[1]] = match[3] || '*';
    }
  }

  return deps;
}

/**
 * Parse pyproject.toml (basic parsing)
 */
function parsePyprojectToml(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const lines = content.split('\n');
  let inDependencies = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '[tool.poetry.dependencies]' || trimmed === '[project.dependencies]') {
      inDependencies = true;
      continue;
    }

    if (trimmed.startsWith('[') && inDependencies) {
      inDependencies = false;
    }

    if (inDependencies && trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([a-zA-Z0-9-_]+)\s*=\s*"([^"]+)"$/);
      if (match) {
        deps[match[1]] = match[2];
      }
    }
  }

  return deps;
}

/**
 * Parse Cargo.toml (basic parsing)
 */
function parseCargoToml(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const lines = content.split('\n');
  let inDependencies = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '[dependencies]') {
      inDependencies = true;
      continue;
    }

    if (trimmed.startsWith('[') && inDependencies) {
      inDependencies = false;
    }

    if (inDependencies && trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([a-zA-Z0-9-_]+)\s*=\s*"([^"]+)"$/);
      if (match) {
        deps[match[1]] = match[2];
      }
    }
  }

  return deps;
}

/**
 * Parse go.mod (basic parsing)
 */
function parseGoMod(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([a-zA-Z0-9.\/-]+)\s+v([0-9.]+)/);
    if (match) {
      deps[match[1]] = match[2];
    }
  }

  return deps;
}

/**
 * Parse Gemfile (basic parsing)
 */
function parseGemfile(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/gem\s+['"]([^'"]+)['"]\s*,?\s*['"]?([^'"]*)/);
    if (match) {
      deps[match[1]] = match[2] || '*';
    }
  }

  return deps;
}

/**
 * Generate dependency summary
 */
function generateDependencySummary(
  language: string,
  production: Record<string, string>,
  dev: Record<string, string>,
  mainLibraries: string[],
): string {
  const prodCount = Object.keys(production).length;
  const devCount = Object.keys(dev).length;

  const parts: string[] = [`This ${language} project has ${prodCount} production dependencies`];

  if (devCount > 0) {
    parts.push(`and ${devCount} dev dependencies`);
  }

  if (mainLibraries.length > 0) {
    parts.push(`Main libraries include: ${mainLibraries.slice(0, 5).join(', ')}`);
  }

  return parts.join('. ') + '.';
}
