/**
 * Repository URL parsing utilities
 */

export interface RepositoryInfo {
  owner: string;
  repo: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
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
 * Parse a GitLab repository URL
 *
 * Supports formats:
 * - https://gitlab.com/owner/repo
 * - https://gitlab.com/group/subgroup/repo
 */
export function parseGitLabUrl(url: string): { owner: string; repo: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '');

  const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?gitlab\.com\/(.+?)\/([^\/\.]+)(?:\.git)?$/);

  if (!match) {
    throw new Error(`Invalid GitLab URL format: ${url}`);
  }

  const [, owner, repo] = match;

  return {
    owner: owner.trim(),
    repo: repo.trim().replace(/\.git$/, ''), // Only remove .git at the end
  };
}

/**
 * Parse a Bitbucket repository URL
 *
 * Supports formats:
 * - https://bitbucket.org/owner/repo
 */
export function parseBitbucketUrl(url: string): { owner: string; repo: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '');

  const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?bitbucket\.org\/([^\/]+)\/([^\/\.]+)(?:\.git)?/);

  if (!match) {
    throw new Error(`Invalid Bitbucket URL format: ${url}`);
  }

  const [, owner, repo] = match;

  return {
    owner: owner.trim(),
    repo: repo.trim().replace(/\.git$/, ''), // Only remove .git at the end
  };
}

/**
 * Detect repository provider from URL
 */
export function detectProvider(url: string): 'github' | 'gitlab' | 'bitbucket' {
  const cleanUrl = url.toLowerCase();

  if (cleanUrl.includes('github.com')) {
    return 'github';
  }

  if (cleanUrl.includes('gitlab.com')) {
    return 'gitlab';
  }

  if (cleanUrl.includes('bitbucket.org')) {
    return 'bitbucket';
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
    case 'gitlab':
      ({ owner, repo } = parseGitLabUrl(url));
      break;
    case 'bitbucket':
      ({ owner, repo } = parseBitbucketUrl(url));
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
    case 'gitlab':
      return `https://gitlab.com/${owner}/${repo}`;
    case 'bitbucket':
      return `https://bitbucket.org/${owner}/${repo}`;
    default:
      return url;
  }
}
