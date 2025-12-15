/**
 * Test script to verify GitHub OAuth connection and context extraction
 *
 * Tests:
 * 1. OAuth connection is active and token is valid
 * 2. Can fetch repository information
 * 3. Can extract issue context (issue + comments)
 *
 * Usage:
 * DATABASE_URL="postgresql://..." npx tsx src/__manual_tests__/test-github-integration.ts
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createClient } from 'redis';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { OAuthService } from '../auth/oauth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { GitHubIntegrationService } from '../vcs/github-integration.service';
import { createLogger } from '@devflow/common';

const logger = createLogger('test-github-integration');

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

async function testGitHubIntegration() {
  // Configuration
  const projectId = process.env.PROJECT_ID || 'indy-promocode-prod';
  const testRepo = {
    owner: process.env.GITHUB_OWNER || 'facebook',
    repo: process.env.GITHUB_REPO || 'react',
    issueNumber: parseInt(process.env.GITHUB_ISSUE || '1', 10),
  };

  console.log('\n🔗 GitHub Integration Test\n');
  console.log(`Project: ${projectId}`);
  console.log(`Repository: ${testRepo.owner}/${testRepo.repo}`);
  console.log(`Issue: #${testRepo.issueNumber}\n`);

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
    const status = await tokenRefresh.getConnectionStatus(projectId, 'GITHUB');

    if (!status.exists) {
      console.error('❌ No GitHub OAuth connection found for this project');
      console.log('\n💡 To connect GitHub:');
      console.log('   1. POST /api/v1/auth/github/device/initiate {"projectId": "..."}');
      console.log('   2. Visit the verification URL and enter the code');
      console.log('   3. POST /api/v1/auth/github/device/poll to get tokens\n');
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

    // 3. Initialize GitHub Integration Service
    console.log('🚀 Initializing GitHub Integration Service...');
    const githubService = new GitHubIntegrationService(tokenRefresh);
    console.log('✅ Service initialized\n');

    // 4. Test: Get Repository
    console.log('📦 Fetching repository information...');
    const repository = await githubService.getRepository(
      projectId,
      testRepo.owner,
      testRepo.repo,
    );

    console.log('✅ Repository information:');
    console.log(`   - Name: ${repository.name}`);
    console.log(`   - Full Name: ${repository.fullName}`);
    console.log(`   - Description: ${repository.description || 'N/A'}`);
    console.log(`   - Default Branch: ${repository.defaultBranch}`);
    console.log(`   - Private: ${repository.private}`);
    console.log(`   - Stars: ${repository.stars || 'N/A'}`);
    console.log();

    // 5. Test: Get Issue Context
    console.log('🎫 Fetching issue context...');
    const issueContext = await githubService.getIssueContext(
      projectId,
      testRepo.owner,
      testRepo.repo,
      testRepo.issueNumber,
    );

    console.log('✅ Issue context extracted:');
    console.log(`   - Title: ${issueContext.title}`);
    console.log(`   - State: ${issueContext.state}`);
    console.log(`   - Author: ${issueContext.author}`);
    console.log(`   - Created: ${issueContext.createdAt}`);
    console.log(`   - Body Preview: ${issueContext.body?.substring(0, 100)}...`);
    console.log();

    // 6. Test: Get Issue Comments
    console.log('💬 Fetching issue comments...');
    const comments = await githubService.getIssueComments(
      projectId,
      testRepo.owner,
      testRepo.repo,
      testRepo.issueNumber,
    );

    console.log(`✅ Found ${comments.length} comments`);
    if (comments.length > 0) {
      console.log('   Latest comments:');
      comments.slice(0, 3).forEach((comment, i) => {
        console.log(`   ${i + 1}. ${comment.author}: ${comment.body.substring(0, 60)}...`);
      });
    }
    console.log();

    // 7. Summary
    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - OAuth: Connected ✅`);
    console.log(`   - Repository Access: ✅`);
    console.log(`   - Issue Context Extraction: ✅`);
    console.log(`   - Comments Extraction: ✅`);
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

testGitHubIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
