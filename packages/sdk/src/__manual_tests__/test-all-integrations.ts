/**
 * Test script to verify ALL integration OAuth connections and context extraction
 *
 * Tests all integrations: GitHub, Linear, Figma, Sentry
 * Shows which integrations are connected and working
 *
 * Usage:
 * DATABASE_URL="postgresql://..." PROJECT_ID="..." npx tsx src/__manual_tests__/test-all-integrations.ts
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createClient } from 'redis';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { OAuthService } from '../auth/oauth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { GitHubIntegrationService } from '../vcs/github-integration.service';
import { LinearIntegrationService } from '../linear/linear-integration.service';
import { FigmaIntegrationService } from '../figma/figma-integration.service';
import { SentryIntegrationService } from '../sentry/sentry-integration.service';
import { createLogger } from '@devflow/common';
import { OAuthProvider } from '../auth/oauth.types';

const logger = createLogger('test-all-integrations');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

interface TestResult {
  provider: OAuthProvider;
  connected: boolean;
  active: boolean;
  tested: boolean;
  success: boolean;
  error?: string;
  details?: any;
}

async function testAllIntegrations() {
  const projectId = process.env.PROJECT_ID || 'indy-promocode-prod';

  console.log('\n🔌 DevFlow Integration Status Check\n');
  console.log(`Project: ${projectId}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  console.log('━'.repeat(80));
  console.log();

  const results: TestResult[] = [];

  try {
    // Connect to Redis
    await redis.connect();

    // Setup TokenResolver
    const tokenEncryption = new TokenEncryptionService();
    const tokenStorage = new TokenStorageService(redis);
    const oauthService = new OAuthService(prisma, tokenEncryption, tokenStorage);
    const tokenRefresh = new TokenRefreshService(
      prisma,
      tokenEncryption,
      tokenStorage,
      oauthService,
    );

    // Test GitHub
    console.log('🔗 Testing GitHub Integration...');
    const githubResult: TestResult = {
      provider: 'GITHUB',
      connected: false,
      active: false,
      tested: false,
      success: false,
    };

    try {
      const status = await tokenRefresh.getConnectionStatus(projectId, 'GITHUB');
      githubResult.connected = status.exists;
      githubResult.active = status.isActive && !status.refreshFailed;

      if (githubResult.active) {
        const githubService = new GitHubIntegrationService(tokenRefresh);
        const owner = process.env.GITHUB_OWNER || 'facebook';
        const repo = process.env.GITHUB_REPO || 'react';

        const repository = await githubService.getRepository(projectId, owner, repo);
        githubResult.tested = true;
        githubResult.success = true;
        githubResult.details = {
          testRepo: `${owner}/${repo}`,
          repoName: repository.name,
          defaultBranch: repository.defaultBranch,
        };
        console.log(`   ✅ Connected and working`);
        console.log(`   📦 Test: Fetched repository ${owner}/${repo}`);
      } else {
        console.log(`   ⚠️  Connected but ${status.refreshFailed ? 'refresh failed' : 'inactive'}`);
        githubResult.error = status.failureReason || 'Connection not active';
      }
    } catch (error: any) {
      githubResult.error = error.message;
      console.log(`   ❌ Error: ${error.message}`);
    }
    results.push(githubResult);
    console.log();

    // Test Linear
    console.log('📋 Testing Linear Integration...');
    const linearResult: TestResult = {
      provider: 'LINEAR',
      connected: false,
      active: false,
      tested: false,
      success: false,
    };

    try {
      const status = await tokenRefresh.getConnectionStatus(projectId, 'LINEAR');
      linearResult.connected = status.exists;
      linearResult.active = status.isActive && !status.refreshFailed;

      if (linearResult.active) {
        const linearService = new LinearIntegrationService(tokenRefresh);
        const testStatus = process.env.LINEAR_STATUS || 'To Refinement';

        const issues = await linearService.queryIssuesByStatus(projectId, testStatus);
        linearResult.tested = true;
        linearResult.success = true;
        linearResult.details = {
          testStatus,
          issuesFound: issues.length,
        };
        console.log(`   ✅ Connected and working`);
        console.log(`   📋 Test: Found ${issues.length} issues with status "${testStatus}"`);
      } else {
        console.log(`   ⚠️  Connected but ${status.refreshFailed ? 'refresh failed' : 'inactive'}`);
        linearResult.error = status.failureReason || 'Connection not active';
      }
    } catch (error: any) {
      linearResult.error = error.message;
      console.log(`   ❌ Error: ${error.message}`);
    }
    results.push(linearResult);
    console.log();

    // Test Figma
    console.log('🎨 Testing Figma Integration...');
    const figmaResult: TestResult = {
      provider: 'FIGMA',
      connected: false,
      active: false,
      tested: false,
      success: false,
    };

    try {
      const status = await tokenRefresh.getConnectionStatus(projectId, 'FIGMA');
      figmaResult.connected = status.exists;
      figmaResult.active = status.isActive && !status.refreshFailed;

      if (figmaResult.active) {
        const figmaService = new FigmaIntegrationService(tokenRefresh);
        const fileKey = process.env.FIGMA_FILE_KEY || 'TfJw2zsGB11mbievCt5c3n';

        const fileMetadata = await figmaService.getFileMetadata(projectId, fileKey);
        const comments = await figmaService.getFileComments(projectId, fileKey);
        figmaResult.tested = true;
        figmaResult.success = true;
        figmaResult.details = {
          testFileKey: fileKey,
          fileName: fileMetadata.name,
          commentsCount: comments.length,
        };
        console.log(`   ✅ Connected and working`);
        console.log(`   🎨 Test: Fetched file "${fileMetadata.name}" (${comments.length} comments)`);
      } else {
        console.log(`   ⚠️  Connected but ${status.refreshFailed ? 'refresh failed' : 'inactive'}`);
        figmaResult.error = status.failureReason || 'Connection not active';
      }
    } catch (error: any) {
      figmaResult.error = error.message;
      console.log(`   ❌ Error: ${error.message}`);
    }
    results.push(figmaResult);
    console.log();

    // Test Sentry
    console.log('🐛 Testing Sentry Integration...');
    const sentryResult: TestResult = {
      provider: 'SENTRY',
      connected: false,
      active: false,
      tested: false,
      success: false,
    };

    try {
      const status = await tokenRefresh.getConnectionStatus(projectId, 'SENTRY');
      sentryResult.connected = status.exists;
      sentryResult.active = status.isActive && !status.refreshFailed;

      if (sentryResult.active && process.env.SENTRY_ISSUE_ID) {
        const sentryService = new SentryIntegrationService(tokenRefresh);
        const issueId = process.env.SENTRY_ISSUE_ID;

        const issue = await sentryService.getIssue(projectId, issueId);
        sentryResult.tested = true;
        sentryResult.success = true;
        sentryResult.details = {
          testIssueId: issueId,
          issueTitle: issue.title,
          issueStatus: issue.status,
        };
        console.log(`   ✅ Connected and working`);
        console.log(`   🐛 Test: Fetched issue "${issue.title}" (${issue.status})`);
      } else if (sentryResult.active) {
        console.log(`   ⚠️  Connected but no SENTRY_ISSUE_ID provided for testing`);
        sentryResult.error = 'No test issue ID provided';
      } else {
        console.log(`   ⚠️  Connected but ${status.refreshFailed ? 'refresh failed' : 'inactive'}`);
        sentryResult.error = status.failureReason || 'Connection not active';
      }
    } catch (error: any) {
      sentryResult.error = error.message;
      console.log(`   ❌ Error: ${error.message}`);
    }
    results.push(sentryResult);
    console.log();

    // Summary
    console.log('━'.repeat(80));
    console.log('\n📊 Summary\n');

    const connectedCount = results.filter(r => r.connected).length;
    const activeCount = results.filter(r => r.active).length;
    const successCount = results.filter(r => r.success).length;

    console.log(`Total Integrations: ${results.length}`);
    console.log(`Connected: ${connectedCount}/${results.length}`);
    console.log(`Active: ${activeCount}/${results.length}`);
    console.log(`Working: ${successCount}/${results.length}\n`);

    console.log('Integration Status:');
    results.forEach(result => {
      const icon = result.success ? '✅' : result.active ? '⚠️' : result.connected ? '🔴' : '⚪';
      const status = result.success ? 'Working' : result.active ? 'Active (not tested)' : result.connected ? 'Connected (inactive)' : 'Not connected';
      console.log(`  ${icon} ${result.provider.padEnd(10)} - ${status}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log('\n💡 Next Steps:\n');

    const notConnected = results.filter(r => !r.connected);
    if (notConnected.length > 0) {
      console.log('To connect missing integrations:');
      notConnected.forEach(result => {
        const provider = result.provider.toLowerCase();
        console.log(`  • ${result.provider}: POST /api/v1/auth/${provider}/authorize {"projectId": "${projectId}"}`);
      });
      console.log();
    }

    const connected = results.filter(r => r.connected && !r.active);
    if (connected.length > 0) {
      console.log('To fix inactive connections:');
      connected.forEach(result => {
        console.log(`  • ${result.provider}: Check OAuth app configuration and refresh token`);
      });
      console.log();
    }

    if (successCount === results.length) {
      console.log('✅ All integrations are connected and working!\n');
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    logger.error('Full error:', error);
    throw error;
  } finally {
    await redis.disconnect();
    await prisma.$disconnect();
  }

  // Exit with error code if not all integrations are working
  const allWorking = results.every(r => r.success);
  if (!allWorking) {
    process.exit(1);
  }
}

testAllIntegrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
