/**
 * Documentation Scanner - Scans documentation files via GitHub API
 */

import { createLogger } from '@soma-squad-ai/common';
import { GitHubProvider } from '../vcs/github.provider';

export interface DocumentationInfo {
  readme: string;
  contributing?: string;
  conventions: string[];
  patterns: string[];
  summary: string;
}

const logger = createLogger('DocumentationScanner');

/**
 * Scan repository documentation
 */
export async function scanDocumentation(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<DocumentationInfo> {
  logger.info('Scanning documentation', { owner, repo });

  try {
    // Read common documentation files
    const [readme, contributing, codeOfConduct, docs] = await Promise.all([
      readFile(githubProvider, owner, repo, 'README.md'),
      readFile(githubProvider, owner, repo, 'CONTRIBUTING.md'),
      readFile(githubProvider, owner, repo, 'CODE_OF_CONDUCT.md'),
      readDocsDirectory(githubProvider, owner, repo),
    ]);

    // Extract conventions and patterns
    const conventions = extractConventions(readme || '', contributing || '');
    const patterns = extractPatterns(readme || '', contributing || '', docs);

    // Generate summary
    const summary = generateDocumentationSummary({
      readme: readme || 'No README found',
      contributing,
      conventions,
      patterns,
    });

    return {
      readme: readme || 'No README found',
      contributing,
      conventions,
      patterns,
      summary,
    };
  } catch (error) {
    logger.error('Failed to scan documentation', error as Error);
    return {
      readme: 'Documentation not available',
      conventions: [],
      patterns: [],
      summary: 'Documentation could not be scanned',
    };
  }
}

/**
 * Read a file from repository, return null if not found
 */
async function readFile(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  path: string,
): Promise<string | undefined> {
  try {
    const content = await githubProvider.getFileContent(owner, repo, path);
    return content;
  } catch (error) {
    logger.debug(`File not found: ${path}`);
    return undefined;
  }
}

/**
 * Read docs directory if it exists
 */
async function readDocsDirectory(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
): Promise<string> {
  const docPaths = ['docs/', '.github/docs/', 'documentation/'];

  for (const docPath of docPaths) {
    try {
      const files = await githubProvider.getDirectoryTree(owner, repo, docPath);
      const mdFiles = files.filter((f) => f.endsWith('.md')).slice(0, 5); // Limit to 5 files

      if (mdFiles.length > 0) {
        const contents = await githubProvider.getMultipleFiles(owner, repo, mdFiles);
        return contents.map((c) => c.content).join('\n\n---\n\n');
      }
    } catch (error) {
      // Directory doesn't exist, continue
    }
  }

  return '';
}

/**
 * Extract coding conventions from documentation
 */
function extractConventions(readme?: string, contributing?: string): string[] {
  const conventions: string[] = [];
  const content = [readme, contributing].filter(Boolean).join('\n\n');

  if (!content) return conventions;

  // Look for common convention patterns
  const conventionPatterns = [
    /code style[:\s]+([^\n]+)/gi,
    /coding standards?[:\s]+([^\n]+)/gi,
    /naming conventions?[:\s]+([^\n]+)/gi,
    /file structure[:\s]+([^\n]+)/gi,
    /commit message[:\s]+([^\n]+)/gi,
    /branch naming[:\s]+([^\n]+)/gi,
    /pr template[:\s]+([^\n]+)/gi,
  ];

  for (const pattern of conventionPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        conventions.push(match[1].trim());
      }
    }
  }

  // Look for bullet points in "Style Guide" or "Conventions" sections
  const styleGuideMatch = content.match(/##\s*(style guide|conventions|standards)(.*?)(?=##|$)/is);
  if (styleGuideMatch) {
    const bullets = styleGuideMatch[2].match(/[-*]\s+([^\n]+)/g);
    if (bullets) {
      conventions.push(...bullets.map((b) => b.replace(/^[-*]\s+/, '').trim()));
    }
  }

  return [...new Set(conventions)].slice(0, 10); // Deduplicate and limit
}

/**
 * Extract design patterns from documentation
 */
function extractPatterns(readme?: string, contributing?: string, docs?: string): string[] {
  const patterns: string[] = [];
  const content = [readme, contributing, docs].filter(Boolean).join('\n\n');

  if (!content) return patterns;

  // Look for common pattern mentions
  const patternKeywords = [
    'MVC',
    'MVVM',
    'Repository pattern',
    'Factory pattern',
    'Singleton',
    'Observer pattern',
    'Dependency injection',
    'Service layer',
    'Controller',
    'Middleware',
    'Hook',
    'HOC',
    'Render prop',
    'Composition',
    'Clean architecture',
    'Hexagonal architecture',
    'Domain-driven design',
    'Event-driven',
    'Microservices',
    'Monorepo',
  ];

  const lowerContent = content.toLowerCase();

  for (const keyword of patternKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      patterns.push(keyword);
    }
  }

  // Look for architecture sections
  const archMatch = content.match(/##\s*architecture(.*?)(?=##|$)/is);
  if (archMatch) {
    const bullets = archMatch[1].match(/[-*]\s+([^\n]+)/g);
    if (bullets) {
      patterns.push(...bullets.map((b) => b.replace(/^[-*]\s+/, '').trim()));
    }
  }

  return [...new Set(patterns)].slice(0, 10); // Deduplicate and limit
}

/**
 * Generate documentation summary
 */
function generateDocumentationSummary(info: Omit<DocumentationInfo, 'summary'>): string {
  const parts: string[] = [];

  if (info.readme && info.readme !== 'No README found') {
    parts.push('Project has README documentation');
  }

  if (info.contributing) {
    parts.push('includes contribution guidelines');
  }

  if (info.conventions.length > 0) {
    parts.push(`Conventions found: ${info.conventions.slice(0, 3).join(', ')}`);
  }

  if (info.patterns.length > 0) {
    parts.push(`Patterns used: ${info.patterns.slice(0, 3).join(', ')}`);
  }

  if (parts.length === 0) {
    return 'Limited documentation available';
  }

  return parts.join('. ') + '.';
}

/**
 * Extract section from markdown by heading
 */
export function extractMarkdownSection(content: string, heading: string): string | undefined {
  const regex = new RegExp(`##\\s*${heading}(.*?)(?=##|$)`, 'is');
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract code blocks from markdown
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w+)?\n(.*?)```/gs;

  let match;
  while ((match = regex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return codeBlocks;
}
