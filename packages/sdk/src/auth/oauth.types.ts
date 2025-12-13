/**
 * OAuth Types for SDK
 *
 * These types mirror the Prisma models but are defined locally
 * to avoid coupling the SDK to @prisma/client.
 * This allows the SDK to be built independently.
 */

/**
 * OAuth Provider enum - mirrors Prisma's OAuthProvider
 */
export type OAuthProvider = 'GITHUB' | 'LINEAR' | 'SENTRY' | 'FIGMA' | 'GITHUB_ISSUES';

/**
 * OAuth Connection - mirrors Prisma's OAuthConnection model
 */
export interface OAuthConnection {
  id: string;
  projectId: string;
  provider: OAuthProvider;
  refreshToken: string;
  encryptionIv: string;
  scopes: string[];
  expiresAt: Date | null;
  providerUserId: string | null;
  providerEmail: string | null;
  isActive: boolean;
  refreshFailed: boolean;
  failureReason: string | null;
  lastRefreshed: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth Application - mirrors Prisma's OAuthApplication model
 */
export interface OAuthApplication {
  id: string;
  projectId: string;
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  encryptionIv: string;
  redirectUri: string;
  scopes: string[];
  flowType: string;
  name: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database interface for OAuth operations
 * This abstraction allows the SDK to work with any database implementation
 */
export interface OAuthDatabase {
  oAuthConnection: {
    findUnique(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } } | { id: string };
    }): Promise<OAuthConnection | null>;
    findMany(args: { where: { projectId: string }; orderBy?: { createdAt: 'desc' | 'asc' } }): Promise<OAuthConnection[]>;
    upsert(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } };
      create: Omit<OAuthConnection, 'id' | 'createdAt' | 'updatedAt'>;
      update: Partial<Omit<OAuthConnection, 'id' | 'projectId' | 'provider' | 'createdAt' | 'updatedAt'>>;
    }): Promise<OAuthConnection>;
    update(args: {
      where: { id: string };
      data: Partial<Omit<OAuthConnection, 'id' | 'projectId' | 'provider' | 'createdAt' | 'updatedAt'>>;
    }): Promise<OAuthConnection>;
    delete(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } };
    }): Promise<OAuthConnection>;
  };
  oAuthApplication: {
    findUnique(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } };
    }): Promise<OAuthApplication | null>;
    findMany(args: { where: { projectId: string }; orderBy?: { createdAt: 'desc' | 'asc' } }): Promise<OAuthApplication[]>;
    upsert(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } };
      create: Omit<OAuthApplication, 'id' | 'createdAt' | 'updatedAt'>;
      update: Partial<Omit<OAuthApplication, 'id' | 'projectId' | 'provider' | 'createdAt' | 'updatedAt'>>;
    }): Promise<OAuthApplication>;
    delete(args: {
      where: { projectId_provider: { projectId: string; provider: OAuthProvider } };
    }): Promise<OAuthApplication>;
  };
}
