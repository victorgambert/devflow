/**
 * Test script to verify Linear OAuth connection and context extraction
 *
 * Tests:
 * 1. OAuth connection is active and token is valid
 * 2. Can fetch tasks by status
 * 3. Can extract task details (issue + comments)
 *
 * Usage:
 * DATABASE_URL="postgresql://..." LINEAR_ISSUE_ID="..." npx tsx src/__manual_tests__/test-linear-integration.ts
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createClient } from 'redis';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { OAuthService } from '../auth/oauth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { LinearIntegrationService } from '../linear/linear-integration.service';
import { createLogger } from '@devflow/common';

const logger = createLogger('test-linear-integration');

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

async function testLinearIntegration() {
  // Configuration
  const projectId = process.env.PROJECT_ID || 'indy-promocode-prod';
  const testIssueId = process.env.LINEAR_ISSUE_ID || 'DEV-1';
  const testStatus = process.env.LINEAR_STATUS || 'To Refinement';

  console.log('\n📋 Linear Integration Test\n');
  console.log(`Project: ${projectId}`);
  console.log(`Issue ID: ${testIssueId}`);
  console.log(`Test Status: ${testStatus}\n`);

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
    const status = await tokenRefresh.getConnectionStatus(projectId, 'LINEAR');

    if (!status.exists) {
      console.error('❌ No Linear OAuth connection found for this project');
      console.log('\n💡 To connect Linear:');
      console.log('   1. POST /api/v1/auth/linear/authorize {"projectId": "..."}');
      console.log('   2. Visit the authorization URL');
      console.log('   3. Approve the connection\n');
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

    // 3. Initialize Linear Integration Service
    console.log('🚀 Initializing Linear Integration Service...');
    const linearService = new LinearIntegrationService(tokenRefresh);
    console.log('✅ Service initialized\n');

    // 4. Test: Get Task by ID
    console.log('🎫 Fetching task by ID...');
    const task = await linearService.getTask(projectId, testIssueId);

    console.log('✅ Task information:');
    console.log(`   - ID: ${task.id}`);
    console.log(`   - Title: ${task.title}`);
    console.log(`   - Status: ${task.status}`);
    console.log(`   - Priority: ${task.priority || 'N/A'}`);
    console.log(`   - Assignee: ${task.assignee || 'Unassigned'}`);
    console.log(`   - Created: ${task.createdAt}`);
    console.log(`   - Description Preview: ${task.description?.substring(0, 100)}...`);
    console.log();

    // 5. Test: Query Issues by Status
    console.log(`🔍 Querying issues with status "${testStatus}"...`);
    const issues = await linearService.queryIssuesByStatus(projectId, testStatus);

    console.log(`✅ Found ${issues.length} issues`);
    if (issues.length > 0) {
      console.log('   Latest issues:');
      issues.slice(0, 5).forEach((issue, i) => {
        console.log(`   ${i + 1}. [${issue.id}] ${issue.title} (${issue.status})`);
      });
    }
    console.log();

    // 6. Test: Get Task Comments
    console.log('💬 Fetching task comments...');
    const comments = await linearService.getComments(projectId, testIssueId);

    console.log(`✅ Found ${comments.length} comments`);
    if (comments.length > 0) {
      console.log('   Latest comments:');
      comments.slice(0, 3).forEach((comment, i) => {
        console.log(`   ${i + 1}. ${comment.user?.name || 'Unknown'}: ${comment.body?.substring(0, 60)}...`);
        console.log(`      Created: ${comment.createdAt}`);
      });
    }
    console.log();

    // 7. Test: Query Issues with Filters
    console.log('🔍 Querying recent issues...');
    const recentIssues = await linearService.queryIssues(projectId, {
      limit: 10,
      orderBy: 'createdAt',
    });

    console.log(`✅ Found ${recentIssues.length} recent issues`);
    if (recentIssues.length > 0) {
      console.log('   Most recent:');
      recentIssues.slice(0, 3).forEach((issue, i) => {
        console.log(`   ${i + 1}. [${issue.id}] ${issue.title}`);
        console.log(`      Status: ${issue.status}, Created: ${issue.createdAt}`);
      });
    }
    console.log();

    // 8. Summary
    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - OAuth: Connected ✅`);
    console.log(`   - Task Access: ✅`);
    console.log(`   - Query by Status: ✅`);
    console.log(`   - Comments Extraction: ✅`);
    console.log(`   - Query with Filters: ✅`);
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

testLinearIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
