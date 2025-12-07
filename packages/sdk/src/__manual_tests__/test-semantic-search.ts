/**
 * Test Semantic Search on Indexed Repository
 */

import { SemanticRetriever } from '../rag/retrieval/semantic-retriever';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testSemanticSearch() {
  console.log('🔍 Testing Semantic Search on indy-promocode\n');

  // Get the latest completed index
  const index = await prisma.codebaseIndex.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });

  if (!index) {
    console.error('❌ No completed index found');
    process.exit(1);
  }

  console.log(`📊 Using index: ${index.id}`);
  console.log(`📦 Project: ${index.projectId}`);
  console.log(`📈 ${index.totalChunks} chunks indexed\n`);

  // Initialize retriever
  const retriever = new SemanticRetriever({
    embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
    embeddingsBaseURL: 'https://openrouter.ai/api/v1',
    qdrantHost: process.env.QDRANT_HOST || 'localhost',
    qdrantPort: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'devflow_codebase',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  });

  // Test queries
  const queries = [
    {
      query: 'Comment valider un code promo et vérifier sa date d\'expiration ?',
      description: 'Validation de promocode avec dates',
    },
    {
      query: 'Authentication avec Sanctum et gestion des tokens',
      description: 'Système d\'authentification',
    },
    {
      query: 'Restrictions météo pour les codes promos',
      description: 'Intégration API météo',
    },
    {
      query: 'Tests unitaires de validation des promocodes',
      description: 'Tests automatisés',
    },
  ];

  for (const { query, description } of queries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 Query: ${description}`);
    console.log(`📝 "${query}"`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();
    // Use lower score threshold (0.3 = 30% relevance) instead of default 0.7
    const results = await retriever.retrieve(query, index.projectId, 5, undefined, 0.3);
    const duration = Date.now() - startTime;

    console.log(`⏱️  Retrieval time: ${duration}ms`);
    console.log(`📊 Found ${results.length} relevant chunks:\n`);

    results.forEach((result, idx) => {
      console.log(`${idx + 1}. 📄 ${result.filePath}`);
      console.log(`   🎯 Relevance: ${(result.score * 100).toFixed(1)}%`);
      console.log(`   📍 Lines ${result.startLine}-${result.endLine} (${result.language})`);
      console.log(`   📋 Preview: ${result.content.substring(0, 120).replace(/\n/g, ' ')}...`);
      console.log('');
    });
  }

  await retriever.close();
  await prisma.$disconnect();

  console.log('\n✅ Semantic search test completed!');
  console.log('\n💡 Next steps:');
  console.log('  - Use this in spec generation workflow');
  console.log('  - Add hybrid search (semantic + keyword)');
  console.log('  - Implement LLM reranking for better precision');
}

testSemanticSearch().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
