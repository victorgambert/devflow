/**
 * Manual Test for RAG Phase 4: Retrieval System
 * Tests semantic retrieval, hybrid search, and LLM reranking
 */

import { SemanticRetriever } from '../rag/retrieval/semantic-retriever';
import { HybridRetriever } from '../rag/retrieval/hybrid-retriever';
import { LLMReranker } from '../rag/retrieval/reranker';
import { RepositoryIndexer } from '../rag/indexing/repository-indexer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPhase4() {
  console.log('🚀 Testing RAG Phase 4: Retrieval System\n');

  // Configuration
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const githubToken = process.env.GITHUB_TOKEN || '';
  const qdrantHost = process.env.QDRANT_HOST || 'localhost';
  const qdrantPort = parseInt(process.env.QDRANT_PORT || '6333');
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  if (!openrouterApiKey) {
    console.error('❌ OPENROUTER_API_KEY not set');
    console.error('Get your API key from: https://openrouter.ai/keys');
    process.exit(1);
  }

  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN not set');
    process.exit(1);
  }

  console.log('Using OpenRouter for embeddings and reranking\n');

  // Ensure repository is indexed
  console.log('📚 Step 0: Ensure Repository is Indexed');
  console.log('----------------------------');

  const testProject = await prisma.project.upsert({
    where: { id: 'test-rag-phase4' },
    update: {},
    create: {
      id: 'test-rag-phase4',
      name: 'Test RAG Phase 4',
      description: 'Test project for RAG Phase 4',
      repository: 'https://github.com/victorgambert/indy-promocode',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Check if already indexed
  const existingIndex = await prisma.codebaseIndex.findFirst({
    where: { projectId: testProject.id, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });

  if (!existingIndex) {
    console.log('→ Repository not indexed, indexing now...');

    const indexer = new RepositoryIndexer({
      githubToken,
      embeddingsApiKey: openrouterApiKey,
      qdrantHost,
      qdrantPort,
      collectionName: 'test_phase4_collection',
      redisHost,
      redisPort,
    });

    const indexId = await indexer.indexRepository(
      'victorgambert',
      'indy-promocode',
      testProject.id
    );

    console.log(`✓ Repository indexed! Index ID: ${indexId}\n`);
    await indexer.close();
  } else {
    console.log(`✓ Repository already indexed (ID: ${existingIndex.id})`);
    console.log(`  Total chunks: ${existingIndex.totalChunks}`);
    console.log(`  Total files: ${existingIndex.totalFiles}\n`);
  }

  // Test 1: Semantic Retrieval
  console.log('🔍 Test 1: Semantic Retrieval');
  console.log('----------------------------');

  const semanticRetriever = new SemanticRetriever({
    embeddingsApiKey: openrouterApiKey,
    qdrantHost,
    qdrantPort,
    collectionName: 'test_phase4_collection',
    redisHost,
    redisPort,
  });

  const query1 = 'user authentication and login functionality';
  console.log(`Query: "${query1}"\n`);

  const semanticResults = await semanticRetriever.retrieve(
    query1,
    testProject.id,
    5
  );

  console.log(`✓ Found ${semanticResults.length} results:\n`);
  semanticResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
    console.log(`   Type: ${result.chunkType} | Language: ${result.language}`);
    console.log(`   Lines: ${result.startLine}-${result.endLine}`);
    console.log(`   Preview: ${result.content.substring(0, 80)}...`);
    console.log();
  });

  // Test filtering
  console.log('→ Testing filtered search (functions only)');
  const filteredResults = await semanticRetriever.retrieve(
    query1,
    testProject.id,
    5,
    { chunkType: 'function' }
  );

  console.log(`✓ Found ${filteredResults.length} functions:\n`);
  filteredResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
  });

  console.log();

  // Test statistics
  const stats = await semanticRetriever.getStats(testProject.id, 24);
  console.log('📊 Retrieval Statistics (last 24h):');
  console.log(`  Total retrievals: ${stats.totalRetrievals}`);
  console.log(`  Average results: ${stats.averageResults.toFixed(1)}`);
  console.log(`  Average score: ${stats.averageScore.toFixed(3)}`);
  console.log(`  Average time: ${stats.averageTimeMs.toFixed(0)}ms`);
  console.log(`  Total cost: $${stats.totalCost.toFixed(6)}`);
  console.log();

  // Test 2: Hybrid Retrieval
  console.log('🔀 Test 2: Hybrid Retrieval (Semantic + Keyword)');
  console.log('----------------------------');

  const hybridRetriever = new HybridRetriever(semanticRetriever, {
    semanticWeight: 0.7,
    keywordWeight: 0.3,
  });

  const query2 = 'database query function user table';
  console.log(`Query: "${query2}"\n`);

  const hybridResults = await hybridRetriever.retrieve(
    query2,
    testProject.id,
    5
  );

  console.log(`✓ Found ${hybridResults.length} results:\n`);
  hybridResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
    console.log(`   Type: ${result.chunkType} | Language: ${result.language}`);
    console.log(`   Preview: ${result.content.substring(0, 80)}...`);
    console.log();
  });

  // Compare with semantic-only
  const semanticOnly = await semanticRetriever.retrieve(query2, testProject.id, 5);
  console.log('📊 Comparison:');
  console.log(`  Semantic-only: ${semanticOnly.length} results`);
  console.log(`  Hybrid: ${hybridResults.length} results`);
  console.log(`  Unique to hybrid: ${hybridResults.filter(h => !semanticOnly.find(s => s.chunkId === h.chunkId)).length}`);
  console.log();

  // Test 3: LLM Reranking
  console.log('🤖 Test 3: LLM Reranking');
  console.log('----------------------------');

  const reranker = new LLMReranker({
    apiKey: openrouterApiKey,
    model: 'anthropic/claude-3-haiku',
  });

  const query3 = 'how to create a new user account';
  console.log(`Query: "${query3}"\n`);

  // Get initial results
  const initialResults = await hybridRetriever.retrieve(
    query3,
    testProject.id,
    10 // Fetch more for reranking
  );

  console.log(`→ Initial results: ${initialResults.length}`);
  console.log('Top 3 before reranking:');
  initialResults.slice(0, 3).forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
  });
  console.log();

  // Rerank
  console.log('→ Reranking with Claude 3 Haiku...');
  const rerankedResults = await reranker.rerank(query3, initialResults, 5);

  console.log(`✓ Reranked to ${rerankedResults.length} results:\n`);
  rerankedResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath}`);
    console.log(`   Type: ${result.chunkType} | Language: ${result.language}`);
    console.log(`   Preview: ${result.content.substring(0, 100)}...`);
    console.log();
  });

  // Check if order changed
  const orderChanged = rerankedResults.some((r, idx) => {
    const initialIdx = initialResults.findIndex(i => i.chunkId === r.chunkId);
    return initialIdx !== idx;
  });

  console.log(`📊 Reranking effect: ${orderChanged ? 'Order changed ✓' : 'Order unchanged'}`);
  console.log();

  // Test 4: Multi-Query Retrieval
  console.log('🔍 Test 4: Multi-Query Retrieval');
  console.log('----------------------------');

  const queries = [
    'user authentication',
    'password validation',
    'login endpoint',
  ];

  console.log(`Queries: ${queries.join(', ')}\n`);

  const multiResults = await semanticRetriever.retrieveMultiple(
    queries,
    testProject.id,
    3 // 3 results per query
  );

  console.log(`✓ Found ${multiResults.length} unique results across all queries:\n`);
  multiResults.slice(0, 5).forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
    console.log(`   Type: ${result.chunkType}`);
  });
  console.log();

  // Test 5: Full Pipeline
  console.log('🎯 Test 5: Full Retrieval Pipeline');
  console.log('----------------------------');

  const finalQuery = 'implement user registration with email validation';
  console.log(`Query: "${finalQuery}"\n`);

  console.log('Step 1: Hybrid search...');
  const step1Results = await hybridRetriever.retrieve(finalQuery, testProject.id, 10);
  console.log(`  → ${step1Results.length} results`);

  console.log('Step 2: LLM reranking...');
  const step2Results = await reranker.rerank(finalQuery, step1Results, 5);
  console.log(`  → ${step2Results.length} results`);

  console.log('\n✓ Final results:\n');
  step2Results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.filePath}`);
    console.log(`   ${result.chunkType} (${result.language})`);
    console.log(`   ${result.content.substring(0, 120)}...`);
    console.log();
  });

  // Cleanup
  console.log('🧹 Cleanup');
  console.log('----------------------------');
  await semanticRetriever.close();
  await hybridRetriever.close();
  await prisma.$disconnect();
  console.log('✓ Connections closed');

  console.log('\n✅ All Phase 4 tests passed!');
  console.log('\nNext Steps:');
  console.log('  - Phase 5: Integration with Temporal workflows');
  console.log('  - Phase 6: Testing & validation');
  console.log('  - Phase 7: Monitoring & observability');
}

// Run tests
testPhase4().catch(async (error) => {
  console.error('\n❌ Test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
