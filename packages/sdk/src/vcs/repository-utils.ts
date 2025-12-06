/**
 * Repository URL parsing utilities
 */

export interface RepositoryInfo {
  owner: string;
  repo: string;
  provider: 'github';
  url: string;
}

/**
 * Parse a GitHub repository URL and extract owner and repo
 *
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - github.com/owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Remove trailing slashes
  const cleanUrl = url.trim().replace(/\/+$/, '');

  // Match various GitHub URL formats
  const httpsMatch = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  const sshMatch = cleanUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);

  const match = httpsMatch || sshMatch;

  if (!match) {
    throw new Error(`Invalid GitHub URL format: ${url}`);
  }

  const [, owner, repo] = match;

  if (!owner || !repo) {
    throw new Error(`Could not extract owner and repo from URL: ${url}`);
  }

  return {
    owner: owner.trim(),
    repo: repo.trim().replace(/\.git$/, ''), // Only remove .git at the end
  };
}

/**
 * Detect repository provider from URL
 */
export function detectProvider(url: string): 'github' {
  const cleanUrl = url.toLowerCase();

  if (cleanUrl.includes('github.com')) {
    return 'github';
  }

  throw new Error(`Unknown repository provider in URL: ${url}`);
}

/**
 * Parse any repository URL and return structured information
 */
export function parseRepositoryUrl(url: string): RepositoryInfo {
  const provider = detectProvider(url);

  let owner: string;
  let repo: string;

  switch (provider) {
    case 'github':
      ({ owner, repo } = parseGitHubUrl(url));
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return {
    owner,
    repo,
    provider,
    url,
  };
}

/**
 * Normalize a repository URL to HTTPS format
 */
export function normalizeRepositoryUrl(url: string): string {
  const provider = detectProvider(url);
  const { owner, repo } = parseRepositoryUrl(url);

  switch (provider) {
    case 'github':
      return `https://github.com/${owner}/${repo}`;
    default:
      return url;
  }
}
