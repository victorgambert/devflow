/**
 * Test Real Repository Indexing
 *
 * Index a real GitHub repository with the RAG system
 *
 * Usage:
 *   GITHUB_TOKEN=xxx OPENROUTER_API_KEY=xxx npx ts-node src/__manual_tests__/test-real-indexing.ts
 */

import { RepositoryIndexer } from '../rag/indexing/repository-indexer';
import { SemanticRetriever } from '../rag/retrieval/semantic-retriever';
import { PrometheusExporter } from '../rag/metrics/prometheus-exporter';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testRealIndexing() {
  console.log('🚀 Starting Real Repository Indexing Test\n');

  // Check environment variables
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is not set');
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY is not set');
    process.exit(1);
  }

  // Get repository from command line or use default
  const args = process.argv.slice(2);
  const owner = args[0] || 'victorgambert';
  const repo = args[1] || 'DevFlow';
  const projectId = `test-${Date.now()}`;

  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log(`🆔 Project ID: ${projectId}\n`);

  // Create test project in database (or use existing)
  console.log('📝 Creating or finding test project...');
  const project = await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      name: `Test ${repo}`,
      description: `Test indexing for ${owner}/${repo}`,
      repository: `https://github.com/${owner}/${repo}`,
      isActive: true,
      config: {},
    },
  });
  console.log('✅ Project ready\n');

  // Initialize indexer
  console.log('🔧 Initializing indexer...');
  const indexer = new RepositoryIndexer({
    githubToken: process.env.GITHUB_TOKEN,
    embeddingsApiKey: process.env.OPENROUTER_API_KEY,
    embeddingsBaseURL: 'https://openrouter.ai/api/v1',
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });
  console.log('✅ Indexer initialized\n');

  // Start indexing
  console.log('⏳ Starting indexing (this may take several minutes)...\n');
  const startTime = Date.now();

  try {
    const indexId = await indexer.indexRepository(
      owner,
      repo,
      projectId
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Indexing completed in ${duration}s`);
    console.log(`📊 Index ID: ${indexId}\n`);

    // Get index details
    const index = await prisma.codebaseIndex.findUnique({
      where: { id: indexId },
    });

    if (index) {
      console.log('📈 Indexing Results:');
      console.log(`  - Status: ${index.status}`);
      console.log(`  - Total files: ${index.totalFiles}`);
      console.log(`  - Total chunks: ${index.totalChunks}`);
      console.log(`  - Duration: ${(index.indexingDuration! / 1000).toFixed(2)}s`);
      console.log(`  - Cost: $${index.cost.toFixed(6)}`);
      console.log(`  - Tokens used: ${index.totalTokens.toLocaleString()}`);
      console.log(`  - Commit SHA: ${index.commitSha}\n`);
    }

    // Test retrieval
    console.log('🔍 Testing semantic retrieval...');
    const retriever = new SemanticRetriever({
      embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
      embeddingsBaseURL: 'https://openrouter.ai/api/v1',
      qdrantHost: process.env.QDRANT_HOST || 'localhost',
      qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
      collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379'),
    });

    const testQueries = [
      'authentication and user login',
      'database connection and queries',
      'API endpoints and routes',
    ];

    for (const query of testQueries) {
      console.log(`\n  Query: "${query}"`);
      const results = await retriever.retrieve(query, projectId, 5);

      console.log(`  Found ${results.length} results:`);
      results.forEach((result, idx) => {
        console.log(`    ${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
      });
    }

    await retriever.close();

    // Show metrics
    console.log('\n📊 Metrics Summary:');
    const summary = PrometheusExporter.getSummary();
    console.log(`  Indexing:`);
    console.log(`    - Total: ${summary.indexing.total}`);
    console.log(`    - Failed: ${summary.indexing.failed}`);
    console.log(`    - Avg Duration: ${summary.indexing.avgDuration}`);
    console.log(`    - Cost: ${summary.indexing.cost}`);
    console.log(`  Retrieval:`);
    console.log(`    - Total: ${summary.retrieval.total}`);
    console.log(`    - Avg Latency: ${summary.retrieval.avgLatency}`);
    console.log(`    - Avg Score: ${summary.retrieval.avgScore}`);
    console.log(`  Cache:`);
    console.log(`    - Hit Rate: ${summary.cache.hitRate}`);
    console.log(`    - Avg Hit Latency: ${summary.cache.avgHitLatency}`);
    console.log(`  Health:`);
    console.log(`    - Qdrant: ${summary.health.qdrant}`);
    console.log(`    - Redis: ${summary.health.redis}`);
    console.log(`    - Database: ${summary.health.database}`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('  - View metrics: http://localhost:3000/metrics/rag/summary');
    console.log('  - View Grafana: http://localhost:3001');
    console.log('  - Try more queries with the retriever');

  } catch (error) {
    console.error('\n❌ Indexing failed:', error);
    throw error;
  } finally {
    await indexer.close();
    await prisma.$disconnect();
  }
}

// Run test
testRealIndexing()
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
