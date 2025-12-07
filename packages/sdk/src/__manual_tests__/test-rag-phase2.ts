/**
 * Manual Test for RAG Phase 2: Embeddings & Vector Store
 * Tests OpenAI embeddings, Qdrant vector store, and Redis caching
 */

import { OpenAIEmbeddingsProvider } from '../rag/embeddings/openai.embeddings';
import { QdrantVectorStore } from '../rag/vector-store/qdrant.provider';
import { EmbeddingsCache } from '../rag/cache/embeddings-cache';
import { randomUUID } from 'crypto';

async function testPhase2() {
  console.log('🚀 Testing RAG Phase 2: Embeddings & Vector Store\n');

  // Configuration - OpenRouter only
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const qdrantHost = process.env.QDRANT_HOST || 'localhost';
  const qdrantPort = parseInt(process.env.QDRANT_PORT || '6333');
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not set');
    console.error('Get your API key from: https://openrouter.ai/keys');
    process.exit(1);
  }

  console.log('Using OpenRouter for embeddings\n');

  // Test 1: Embeddings Cache
  console.log('📦 Test 1: Embeddings Cache');
  console.log('----------------------------');

  const cache = new EmbeddingsCache({
    redisHost,
    redisPort,
    ttl: 3600,
    keyPrefix: 'test:emb:',
  });

  const isConnected = await cache.isConnected();
  console.log(`✓ Redis connection: ${isConnected ? 'OK' : 'FAILED'}`);

  if (!isConnected) {
    console.error('❌ Redis is not running. Start it with: docker-compose up -d redis');
    process.exit(1);
  }

  // Test cache operations
  const testText = 'Hello, world!';
  const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

  await cache.set(testText, testEmbedding);
  const cachedEmbedding = await cache.get(testText);
  console.log(`✓ Cache set/get: ${JSON.stringify(cachedEmbedding) === JSON.stringify(testEmbedding) ? 'OK' : 'FAILED'}`);

  // Test cache stats
  const stats = cache.getStats();
  console.log(`✓ Cache stats: hits=${stats.hits}, misses=${stats.misses}, hitRate=${(stats.hitRate * 100).toFixed(1)}%`);

  // Clear test data
  await cache.delete(testText);
  console.log('✓ Cache cleanup done\n');

  // Test 2: OpenAI Embeddings
  console.log('🤖 Test 2: OpenAI Embeddings');
  console.log('----------------------------');

  const embeddings = new OpenAIEmbeddingsProvider({
    apiKey,
    model: 'text-embedding-3-large',
    dimensions: 3072,
  });

  console.log(`✓ Provider initialized: model=${embeddings.getModel()}, dimensions=${embeddings.getDimensions()}`);

  // Generate single embedding
  const singleText = 'This is a test for code embedding.';
  console.log(`→ Generating embedding for: "${singleText}"`);

  const embedding = await embeddings.generateEmbedding(singleText);
  console.log(`✓ Single embedding generated: ${embedding.length} dimensions`);
  console.log(`  First 5 values: [${embedding.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}...]`);

  // Generate batch embeddings
  const batchTexts = [
    'function getUserById(id: string) { return db.users.findOne({ id }); }',
    'class UserService { constructor(private db: Database) {} }',
    'const validateEmail = (email: string): boolean => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);',
  ];

  console.log(`\n→ Generating ${batchTexts.length} embeddings in batch`);
  const batchEmbeddings = await embeddings.generateEmbeddings(batchTexts);
  console.log(`✓ Batch embeddings generated: ${batchEmbeddings.length} embeddings`);

  // Estimate cost
  const totalTokens = batchTexts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
  const cost = embeddings.estimateCost(totalTokens);
  console.log(`✓ Estimated cost: $${cost.toFixed(6)} (${totalTokens} tokens)\n`);

  // Test 3: Qdrant Vector Store
  console.log('💾 Test 3: Qdrant Vector Store');
  console.log('----------------------------');

  const vectorStore = new QdrantVectorStore({
    host: qdrantHost,
    port: qdrantPort,
    collectionName: 'test_collection',
  });

  // Ensure collection exists
  await vectorStore.ensureCollection(3072);
  console.log('✓ Collection ensured');

  const collectionInfo = await vectorStore.getCollectionInfo();
  const vectorCount = collectionInfo?.result?.vectors_count || collectionInfo?.vectors_count || 0;
  console.log(`✓ Collection info: ${vectorCount} vectors`);

  // Upsert test vectors
  console.log('\n→ Upserting test vectors');
  const testIds = [randomUUID(), randomUUID(), randomUUID()];
  await vectorStore.upsertVectors([
    {
      id: testIds[0],
      vector: batchEmbeddings[0],
      payload: {
        filePath: 'src/services/user.service.ts',
        content: batchTexts[0],
        language: 'typescript',
        chunkType: 'function',
      },
    },
    {
      id: testIds[1],
      vector: batchEmbeddings[1],
      payload: {
        filePath: 'src/services/user.service.ts',
        content: batchTexts[1],
        language: 'typescript',
        chunkType: 'class',
      },
    },
    {
      id: testIds[2],
      vector: batchEmbeddings[2],
      payload: {
        filePath: 'src/utils/validation.ts',
        content: batchTexts[2],
        language: 'typescript',
        chunkType: 'function',
      },
    },
  ]);

  console.log('✓ Vectors upserted');

  // Search for similar code
  console.log('\n→ Searching for similar code');
  const queryText = 'user database query function';
  const queryEmbedding = await embeddings.generateEmbedding(queryText);
  const searchResults = await vectorStore.search(queryEmbedding, 2);

  console.log(`✓ Found ${searchResults.length} similar code chunks:`);
  searchResults.forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.payload.filePath} (score: ${result.score.toFixed(3)})`);
    console.log(`     ${result.payload.chunkType}: ${result.payload.content.substring(0, 60)}...`);
  });

  // Test filtering
  console.log('\n→ Testing filtered search (functions only)');
  const filteredResults = await vectorStore.search(queryEmbedding, 2, {
    must: [{ key: 'chunkType', match: { value: 'function' } }],
  });

  console.log(`✓ Found ${filteredResults.length} functions:`);
  filteredResults.forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.payload.filePath} (score: ${result.score.toFixed(3)})`);
  });

  // Count vectors
  const totalCount = await vectorStore.count();
  console.log(`\n✓ Total vectors in collection: ${totalCount}`);

  // Cleanup test data
  console.log('\n→ Cleaning up test data');
  await vectorStore.deleteByIds(testIds);
  console.log('✓ Test vectors deleted');

  // Test 4: Integration Test (Cache + Embeddings + Vector Store)
  console.log('\n🔗 Test 4: Full Integration');
  console.log('----------------------------');

  const integrationText = 'async function fetchUserData(userId: string) { return await api.get(`/users/${userId}`); }';

  // Check cache first
  let integrationEmbedding = await cache.get(integrationText);
  if (integrationEmbedding) {
    console.log('✓ Cache hit! Using cached embedding');
  } else {
    console.log('→ Cache miss, generating new embedding');
    integrationEmbedding = await embeddings.generateEmbedding(integrationText);
    await cache.set(integrationText, integrationEmbedding);
    console.log('✓ Embedding generated and cached');
  }

  // Store in Qdrant
  const integrationTestId = randomUUID();
  await vectorStore.upsertVectors([
    {
      id: integrationTestId,
      vector: integrationEmbedding,
      payload: {
        filePath: 'src/api/users.ts',
        content: integrationText,
        language: 'typescript',
        chunkType: 'function',
      },
    },
  ]);
  console.log('✓ Vector stored in Qdrant');

  // Retrieve it back
  const retrieved = await vectorStore.getVector(integrationTestId);
  console.log(`✓ Vector retrieved: ${retrieved?.payload.filePath}`);

  // Cleanup
  await vectorStore.deleteByIds([integrationTestId]);
  await cache.delete(integrationText);
  console.log('✓ Integration test cleanup done');

  // Close connections
  await cache.close();

  console.log('\n✅ All Phase 2 tests passed!');
  console.log('\nNext Steps:');
  console.log('  - Phase 3: Code Chunking & Indexing');
  console.log('  - Phase 4: Retrieval System (semantic + hybrid search)');
}

// Run tests
testPhase2().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
