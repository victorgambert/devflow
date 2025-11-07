/**
 * Code Similarity Service - Finds similar code in repository using GitHub Search API
 */

import { createLogger } from '@soma-squad-ai/common';
import { GitHubProvider } from '../vcs/github.provider';

export interface SimilarCode {
  path: string;
  content: string;
  relevanceScore: number;
  reason: string;
}

const logger = createLogger('CodeSimilarityService');

/**
 * Find similar code based on task description
 */
export async function findSimilarCode(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  taskDescription: string,
): Promise<SimilarCode[]> {
  logger.info('Finding similar code', { owner, repo });

  try {
    // Extract keywords from task description
    const keywords = extractKeywords(taskDescription);

    if (keywords.length === 0) {
      logger.warn('No keywords extracted from task description');
      return [];
    }

    // Search for each keyword
    const results: SimilarCode[] = [];
    const seenPaths = new Set<string>();

    for (const keyword of keywords.slice(0, 3)) {
      // Limit to top 3 keywords
      try {
        const searchResults = await githubProvider.searchCode(owner, repo, keyword);

        for (const result of searchResults) {
          if (!seenPaths.has(result.path)) {
            seenPaths.add(result.path);

            results.push({
              path: result.path,
              content: result.content,
              relevanceScore: calculateRelevanceScore(result.content, keywords),
              reason: `Contains keyword: ${keyword}`,
            });
          }
        }
      } catch (error) {
        logger.warn(`Search failed for keyword: ${keyword}`, error as Error);
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Return top 5 most relevant
    return results.slice(0, 5);
  } catch (error) {
    logger.error('Failed to find similar code', error as Error);
    return [];
  }
}

/**
 * Extract important keywords from task description
 */
function extractKeywords(description: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'need',
    'want',
    'create',
    'add',
    'make',
    'implement',
    'build',
  ]);

  // Extract words
  const words = description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  // Count frequency
  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  // Sort by frequency and return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])
    .slice(0, 5);
}

/**
 * Calculate relevance score based on keyword matching
 */
function calculateRelevanceScore(content: string, keywords: string[]): number {
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    const occurrences = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
    score += occurrences * 10;
  }

  // Bonus for file type
  if (content.includes('export') || content.includes('function')) {
    score += 5;
  }

  if (content.includes('class')) {
    score += 5;
  }

  if (content.includes('interface') || content.includes('type')) {
    score += 3;
  }

  return score;
}

/**
 * Find similar components/services by pattern
 */
export async function findSimilarComponents(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  componentType: 'component' | 'service' | 'controller' | 'model',
): Promise<SimilarCode[]> {
  logger.info('Finding similar components', { owner, repo, componentType });

  const searchTerms: Record<string, string> = {
    component: 'component',
    service: 'service',
    controller: 'controller',
    model: 'model schema',
  };

  const term = searchTerms[componentType];
  const results = await githubProvider.searchCode(owner, repo, term);

  return results.map((result) => ({
    path: result.path,
    content: result.content,
    relevanceScore: 100,
    reason: `Similar ${componentType}`,
  }));
}

/**
 * Get file examples by extension
 */
export async function findFilesByExtension(
  githubProvider: GitHubProvider,
  owner: string,
  repo: string,
  extension: string,
  limit: number = 5,
): Promise<SimilarCode[]> {
  logger.info('Finding files by extension', { owner, repo, extension });

  try {
    const tree = await githubProvider.getRepositoryTree(owner, repo);
    const matchingFiles = tree
      .filter((item) => item.type === 'blob' && item.path.endsWith(`.${extension}`))
      .slice(0, limit);

    const results = await githubProvider.getMultipleFiles(
      owner,
      repo,
      matchingFiles.map((f) => f.path),
    );

    return results.map((result) => ({
      path: result.path,
      content: result.content,
      relevanceScore: 50,
      reason: `Example ${extension} file`,
    }));
  } catch (error) {
    logger.error('Failed to find files by extension', error as Error);
    return [];
  }
}
