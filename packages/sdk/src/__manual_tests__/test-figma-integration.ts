/**
 * Test script to verify Figma OAuth connection and context extraction
 *
 * Tests:
 * 1. OAuth connection is active and token is valid
 * 2. Can fetch file metadata
 * 3. Can extract design context (metadata + comments + screenshots)
 *
 * Usage:
 * DATABASE_URL="postgresql://..." FIGMA_FILE_KEY="..." npx tsx src/__manual_tests__/test-figma-integration.ts
 */

import { PrismaClient } from '@devflow/common/prisma';
import { createClient } from 'redis';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { OAuthService } from '../auth/oauth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { FigmaIntegrationService } from '../figma/figma-integration.service';
import { createLogger } from '@devflow/common';

const logger = createLogger('test-figma-integration');

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

async function testFigmaIntegration() {
  // Configuration
  const projectId = process.env.PROJECT_ID || 'indy-promocode-prod';
  const fileKey = process.env.FIGMA_FILE_KEY || 'TfJw2zsGB11mbievCt5c3n';
  const nodeId = process.env.FIGMA_NODE_ID || '12252-33902';

  console.log('\n🎨 Figma Integration Test\n');
  console.log(`Project: ${projectId}`);
  console.log(`File Key: ${fileKey}`);
  console.log(`Node ID: ${nodeId}\n`);

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
    const status = await tokenRefresh.getConnectionStatus(projectId, 'FIGMA');

    if (!status.exists) {
      console.error('❌ No Figma OAuth connection found for this project');
      console.log('\n💡 To connect Figma:');
      console.log('   1. POST /api/v1/auth/figma/authorize {"projectId": "..."}');
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

    // 3. Initialize Figma Integration Service
    console.log('🚀 Initializing Figma Integration Service...');
    const figmaService = new FigmaIntegrationService(tokenRefresh);
    console.log('✅ Service initialized\n');

    // 4. Test: Get File Metadata
    console.log('📄 Fetching file metadata...');
    const fileMetadata = await figmaService.getFileMetadata(projectId, fileKey);

    console.log('✅ File information:');
    console.log(`   - Name: ${fileMetadata.name}`);
    console.log(`   - Last Modified: ${fileMetadata.lastModified}`);
    console.log(`   - Version: ${fileMetadata.version}`);
    console.log(`   - Thumbnail URL: ${fileMetadata.thumbnailUrl || 'N/A'}`);
    console.log(`   - Document Pages: ${fileMetadata.document?.children?.length || 0}`);
    console.log();

    // 5. Test: Get File Comments
    console.log('💬 Fetching file comments...');
    const comments = await figmaService.getFileComments(projectId, fileKey);

    console.log(`✅ Found ${comments.length} unresolved comments`);
    if (comments.length > 0) {
      console.log('   Latest comments:');
      comments.slice(0, 3).forEach((comment, i) => {
        console.log(`   ${i + 1}. ${comment.user.handle}: ${comment.message.substring(0, 60)}...`);
        console.log(`      Created: ${comment.created_at}`);
        console.log(`      Client Meta: ${JSON.stringify(comment.client_meta)}`);
      });
    }
    console.log();

    // 6. Test: Get Design Context (with screenshot)
    console.log('🖼️  Fetching full design context (metadata + comments + screenshot)...');
    const designContext = await figmaService.getDesignContext(
      projectId,
      fileKey,
      nodeId,
    );

    console.log('✅ Design context extracted:');
    console.log('   File Information:');
    console.log(`     - Name: ${designContext.fileName}`);
    console.log(`     - Last Modified: ${designContext.lastModified}`);
    console.log(`     - Thumbnail: ${designContext.thumbnailUrl ? 'Available' : 'N/A'}`);

    console.log('   Comments:');
    console.log(`     - Total unresolved: ${designContext.comments.length}`);
    if (designContext.comments.length > 0) {
      designContext.comments.slice(0, 2).forEach((comment: any, i: number) => {
        console.log(`     ${i + 1}. ${comment.user.handle}: ${comment.message.substring(0, 50)}...`);
      });
    }

    console.log('   Screenshots:');
    if (designContext.screenshots.length > 0) {
      designContext.screenshots.forEach((screenshot: any) => {
        console.log(`     - Node: ${screenshot.nodeName || screenshot.nodeId}`);
        console.log(`     - Image URL: ${screenshot.imageUrl}`);
        console.log(`     - Base64 size: ${screenshot.imageBase64?.length || 0} chars`);
      });
    } else {
      console.log('     - No screenshots captured');
    }
    console.log();

    // 7. Test: Get Specific Node Images
    console.log('🖼️  Fetching node images...');
    const nodeImages = await figmaService.getNodeImages(
      projectId,
      fileKey,
      [nodeId],
      2, // scale
      'png', // format
    );

    console.log('✅ Node images:');
    Object.entries(nodeImages.images).forEach(([id, url]) => {
      console.log(`   - Node ${id}: ${url}`);
    });
    console.log();

    // 8. Test: Get Screenshot
    console.log('📸 Fetching screenshot for node...');
    const screenshot = await figmaService.getScreenshot(
      projectId,
      fileKey,
      nodeId,
      'Test Node',
    );

    if (screenshot) {
      console.log('✅ Screenshot extracted:');
      console.log(`   - Node ID: ${screenshot.nodeId}`);
      console.log(`   - Node Name: ${screenshot.nodeName || 'N/A'}`);
      console.log(`   - Image URL: ${screenshot.imageUrl}`);
      console.log(`   - Base64 size: ${screenshot.imageBase64?.length || 0} chars`);
    } else {
      console.log('⚠️  No screenshot available for this node');
    }
    console.log();

    // 9. Summary
    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - OAuth: Connected ✅`);
    console.log(`   - File Metadata: ✅`);
    console.log(`   - Comments Extraction: ✅`);
    console.log(`   - Design Context: ✅`);
    console.log(`   - Node Images: ✅`);
    console.log(`   - Screenshot: ✅`);
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

testFigmaIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
