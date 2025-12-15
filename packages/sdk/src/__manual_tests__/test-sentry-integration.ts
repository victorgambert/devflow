/**
 * Test script to verify Sentry OAuth connection and context extraction
 *
 * Tests:
 * 1. OAuth connection is active and token is valid
 * 2. Can fetch issue details
 * 3. Can extract error context (issue + latest event with stacktrace)
 *
 * Usage:
 * DATABASE_URL="postgresql://..." SENTRY_ISSUE_ID="..." npx tsx src/__manual_tests__/test-sentry-integration.ts
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createClient } from 'redis';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { OAuthService } from '../auth/oauth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { SentryIntegrationService } from '../sentry/sentry-integration.service';
import { createLogger } from '@devflow/common';

const logger = createLogger('test-sentry-integration');

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

async function testSentryIntegration() {
  // Configuration
  const projectId = process.env.PROJECT_ID || 'indy-promocode-prod';
  const issueId = process.env.SENTRY_ISSUE_ID || '1234567890';

  console.log('\n🐛 Sentry Integration Test\n');
  console.log(`Project: ${projectId}`);
  console.log(`Issue ID: ${issueId}\n`);

  try {
    // Connect to Redis
    await redis.connect();

    // 1. Setup TokenResolver
    console.log('🔧 Setting up token resolver...');
    const tokenEncryption = new TokenEncryptionService();
    const tokenStorage = new TokenStorageService(redis);
    const oauthService = new OAuthService(prisma, tokenEncryption, tokenStorage);
    const tokenRefresh = new TokenRefreshService(
      prisma,
      tokenEncryption,
      tokenStorage,
      oauthService,
    );
    console.log('✅ Token resolver ready\n');

    // 2. Check OAuth connection status
    console.log('📡 Checking OAuth connection...');
    const status = await tokenRefresh.getConnectionStatus(projectId, 'SENTRY');

    if (!status.exists) {
      console.error('❌ No Sentry OAuth connection found for this project');
      console.log('\n💡 To connect Sentry:');
      console.log('   1. POST /api/v1/auth/sentry/authorize {"projectId": "..."}');
      console.log('   2. Visit the authorization URL');
      console.log('   3. Approve the connection\n');
      console.log('Note: Sentry OAuth requires an Internal Integration to be created first:');
      console.log('   - Go to Settings > Developer Settings > Internal Integrations');
      console.log('   - Create a new integration with read permissions\n');
      return;
    }

    console.log('✅ OAuth connection found:');
    console.log(`   - Active: ${status.isActive}`);
    console.log(`   - Refresh Failed: ${status.refreshFailed}`);
    console.log(`   - Last Refreshed: ${status.lastRefreshed || 'Never'}`);

    if (!status.isActive || status.refreshFailed) {
      console.error(`❌ Connection is not ready: ${status.failureReason || 'Unknown'}\n`);
      return;
    }
    console.log();

    // 3. Initialize Sentry Integration Service
    console.log('🚀 Initializing Sentry Integration Service...');
    const sentryService = new SentryIntegrationService(tokenRefresh);
    console.log('✅ Service initialized\n');

    // 4. Test: Get Issue Details
    console.log('🐛 Fetching issue details...');
    const issue = await sentryService.getIssue(projectId, issueId);

    console.log('✅ Issue information:');
    console.log(`   - ID: ${issue.id}`);
    console.log(`   - Title: ${issue.title}`);
    console.log(`   - Status: ${issue.status}`);
    console.log(`   - Level: ${issue.level}`);
    console.log(`   - Count: ${issue.count}`);
    console.log(`   - User Count: ${issue.userCount}`);
    console.log(`   - First Seen: ${issue.firstSeen}`);
    console.log(`   - Last Seen: ${issue.lastSeen}`);
    console.log(`   - Permalink: ${issue.permalink}`);
    console.log();

    // 5. Test: Get Latest Event (with stacktrace)
    console.log('📊 Fetching latest event...');
    const event = await sentryService.getLatestEvent(projectId, issueId);

    if (event) {
      console.log('✅ Latest event information:');
      console.log(`   - Event ID: ${event.id}`);
      console.log(`   - Message: ${event.message || 'N/A'}`);
      console.log(`   - Platform: ${event.platform}`);
      console.log(`   - Timestamp: ${event.dateCreated}`);

      if (event.entries && event.entries.length > 0) {
        console.log('   - Entries:');
        event.entries.forEach((entry: any, i: number) => {
          console.log(`     ${i + 1}. Type: ${entry.type}`);
          if (entry.type === 'exception' && entry.data?.values) {
            console.log(`        Exceptions: ${entry.data.values.length}`);
            entry.data.values.slice(0, 2).forEach((exc: any, j: number) => {
              console.log(`        ${j + 1}. ${exc.type}: ${exc.value}`);
              if (exc.stacktrace?.frames) {
                console.log(`           Frames: ${exc.stacktrace.frames.length}`);
                const topFrame = exc.stacktrace.frames[exc.stacktrace.frames.length - 1];
                if (topFrame) {
                  console.log(`           Top: ${topFrame.filename}:${topFrame.lineNo}`);
                }
              }
            });
          }
        });
      }

      if (event.tags && event.tags.length > 0) {
        console.log('   - Tags:');
        event.tags.slice(0, 5).forEach((tag: any) => {
          console.log(`     - ${tag.key}: ${tag.value}`);
        });
      }
    } else {
      console.log('⚠️  No events found for this issue');
    }
    console.log();

    // 6. Test: Get Full Issue Context
    console.log('📦 Fetching full issue context...');
    const issueContext = await sentryService.getIssueContext(projectId, issueId);

    console.log('✅ Full context extracted:');
    console.log('   Issue:');
    console.log(`     - Title: ${issueContext.issue.title}`);
    console.log(`     - Status: ${issueContext.issue.status}`);
    console.log(`     - Level: ${issueContext.issue.level}`);
    console.log(`     - Count: ${issueContext.issue.count}`);

    console.log('   Latest Event:');
    if (issueContext.latestEvent) {
      console.log(`     - Event ID: ${issueContext.latestEvent.id}`);
      console.log(`     - Platform: ${issueContext.latestEvent.platform}`);
      console.log(`     - Has Stacktrace: ${issueContext.latestEvent.entries?.some((e: any) => e.type === 'exception') ? 'Yes' : 'No'}`);
    } else {
      console.log('     - No event data');
    }
    console.log();

    // 7. Summary
    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - OAuth: Connected ✅`);
    console.log(`   - Issue Details: ✅`);
    console.log(`   - Latest Event: ✅`);
    console.log(`   - Full Context: ✅`);
    console.log();

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    logger.error('Full error:', error);
    throw error;
  } finally {
    await redis.disconnect();
    await prisma.$disconnect();
  }
}

testSentryIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
