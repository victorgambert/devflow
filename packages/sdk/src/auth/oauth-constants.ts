/**
 * OAuth Constants for all supported providers
 *
 * Multi-tenant OAuth Architecture:
 * - GitHub: Uses public client ID (Device Flow - RFC 8628)
 * - GitHub Issues: Same as GitHub but separate connection for issues
 * - Linear: Credentials stored per-project in database (Authorization Code Flow)
 * - Sentry: Credentials stored per-project in database (Authorization Code Flow)
 * - Figma: Credentials stored per-project in database (Authorization Code Flow)
 */

export const OAUTH_CONSTANTS = {
  GITHUB: {
    // GitHub CLI public client (officially supported by GitHub)
    // Uses Device Flow (RFC 8628) - no client secret needed
    CLIENT_ID: 'Iv1.b507a08c87ecfe98',
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    SCOPES: ['repo', 'workflow', 'admin:repo_hook'],
    FLOW_TYPE: 'device' as const,
  },
  LINEAR: {
    // Linear OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Each project can have its own Linear OAuth app for multi-tenant support
    // Register via: POST /api/v1/auth/apps/register
    AUTHORIZE_URL: 'https://linear.app/oauth/authorize',
    TOKEN_URL: 'https://api.linear.app/oauth/token',
    REVOKE_URL: 'https://api.linear.app/oauth/revoke',
    USER_API_URL: 'https://api.linear.app/graphql',
    FLOW_TYPE: 'authorization_code' as const,
  },
  SENTRY: {
    // Sentry OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Register at: https://sentry.io/settings/developer-settings/
    AUTHORIZE_URL: 'https://sentry.io/oauth/authorize/',
    TOKEN_URL: 'https://sentry.io/oauth/token/',
    USER_API_URL: 'https://sentry.io/api/0/users/me/',
    SCOPES: ['project:read', 'event:read', 'org:read'],
    FLOW_TYPE: 'authorization_code' as const,
  },
  FIGMA: {
    // Figma OAuth App (uses Authorization Code Flow)
    // Credentials are stored per-project in the database (OAuthApplication table)
    // Register at: https://www.figma.com/developers/apps
    AUTHORIZE_URL: 'https://www.figma.com/oauth',
    TOKEN_URL: 'https://www.figma.com/api/oauth/token',
    USER_API_URL: 'https://api.figma.com/v1/me',
    SCOPES: ['file_content:read', 'file_comments:read'],
    FLOW_TYPE: 'authorization_code' as const,
  },
  GITHUB_ISSUES: {
    // GitHub Issues - separate OAuth connection for issue context extraction
    // Uses Device Flow (RFC 8628) - same as GitHub but different scopes/purpose
    CLIENT_ID: 'Iv1.b507a08c87ecfe98',
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    TOKEN_URL: 'https://github.com/login/oauth/access_token',
    SCOPES: ['repo', 'read:user'],
    FLOW_TYPE: 'device' as const,
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_CONSTANTS;
