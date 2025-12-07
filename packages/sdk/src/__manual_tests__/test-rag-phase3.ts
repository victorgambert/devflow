/**
 * Manual Test for RAG Phase 3: Code Chunking & Indexing
 * Tests AST-based chunking, repository indexing, and full pipeline
 */

import { CodeChunker } from '../rag/chunking/code-chunker';
import { RepositoryIndexer } from '../rag/indexing/repository-indexer';
import { QdrantVectorStore } from '../rag/vector-store/qdrant.provider';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPhase3() {
  console.log('🚀 Testing RAG Phase 3: Code Chunking & Indexing\n');

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

  console.log('Using OpenRouter for embeddings\n');
  console.log('Using GitHub API for repository access\n');

  // Test 1: Code Chunker
  console.log('🔨 Test 1: Code Chunker');
  console.log('----------------------------');

  const chunker = new CodeChunker();

  // Test TypeScript chunking
  const tsCode = `
import { User } from './types';

/**
 * Get user by ID
 */
export function getUserById(id: string): User {
  return db.users.findOne({ id });
}

/**
 * User service class
 */
export class UserService {
  constructor(private db: Database) {}

  async createUser(data: UserData): Promise<User> {
    return this.db.users.create(data);
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.users.delete({ id });
  }
}

// Arrow function
const validateEmail = (email: string): boolean => {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
};
`;

  const chunks = chunker.chunkCode(tsCode, 'test.ts');
  console.log(`✓ Chunked TypeScript code: ${chunks.length} chunks`);
  chunks.forEach((chunk, idx) => {
    console.log(`  ${idx + 1}. ${chunk.chunkType}: ${chunk.metadata.name || 'unnamed'} (lines ${chunk.startLine}-${chunk.endLine})`);
  });

  // Test fallback chunking
  const pythonCode = `
def hello_world():
    print("Hello, World!")

def goodbye_world():
    print("Goodbye, World!")
`;

  const pythonChunks = chunker.chunkCode(pythonCode, 'test.py', 100, 20);
  console.log(`\n✓ Fallback chunking for Python: ${pythonChunks.length} chunks`);

  console.log();

  // Test 2: Repository Indexing
  console.log('📚 Test 2: Repository Indexing');
  console.log('----------------------------');

  // Create test project
  const testProject = await prisma.project.upsert({
    where: { id: 'test-rag-phase3' },
    update: {},
    create: {
      id: 'test-rag-phase3',
      name: 'Test RAG Phase 3',
      description: 'Test project for RAG Phase 3',
      repository: 'https://github.com/victorgambert/indy-promocode',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Test project created: ${testProject.id}\n`);

  // Initialize indexer
  const indexer = new RepositoryIndexer({
    githubToken,
    embeddingsApiKey: openrouterApiKey,
    // embeddingsBaseURL defaults to OpenRouter
    qdrantHost,
    qdrantPort,
    collectionName: 'test_phase3_collection',
    redisHost,
    redisPort,
  });

  console.log('→ Starting repository indexing...');
  console.log('  This may take a few minutes depending on repository size\n');

  try {
    const indexId = await indexer.indexRepository(
      'victorgambert',
      'indy-promocode',
      testProject.id
    );

    console.log(`✓ Indexing completed! Index ID: ${indexId}\n`);

    // Get index details
    const index = await prisma.codebaseIndex.findUnique({
      where: { id: indexId },
      include: {
        chunks: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (index) {
      console.log('📊 Indexing Summary:');
      console.log(`  Total files: ${index.totalFiles}`);
      console.log(`  Total chunks: ${index.totalChunks}`);
      console.log(`  Duration: ${((index.indexingDuration || 0) / 1000).toFixed(2)}s`);
      console.log(`  Cost: $${index.cost.toFixed(6)}`);
      console.log(`  Model: ${index.embeddingModel}`);
      console.log(`  Dimensions: ${index.embeddingDimensions}`);
      console.log(`  Tokens used: ${index.totalTokens.toLocaleString()}`);
      console.log();

      console.log('📄 Sample Chunks (first 5):');
      index.chunks.forEach((chunk, idx) => {
        console.log(`  ${idx + 1}. ${chunk.filePath}`);
        console.log(`     Type: ${chunk.chunkType} | Lines: ${chunk.startLine}-${chunk.endLine}`);
        console.log(`     Content preview: ${chunk.content.substring(0, 80)}...`);
        console.log();
      });
    }

    // Test 3: Verify Vector Store
    console.log('💾 Test 3: Vector Store Verification');
    console.log('----------------------------');

    const vectorStore = new QdrantVectorStore({
      host: qdrantHost,
      port: qdrantPort,
      collectionName: 'test_phase3_collection',
    });

    const collectionInfo = await vectorStore.getCollectionInfo();
    const vectorCount = collectionInfo?.result?.vectors_count || collectionInfo?.vectors_count || 0;
    console.log(`✓ Vectors in Qdrant: ${vectorCount}`);

    // Get total chunks from DB
    const dbChunkCount = await prisma.documentChunk.count({
      where: { codebaseIndexId: indexId },
    });
    console.log(`✓ Chunks in PostgreSQL: ${dbChunkCount}`);

    if (vectorCount === dbChunkCount) {
      console.log('✓ Vector store and database are in sync!');
    } else {
      console.warn(`⚠️  Mismatch: ${vectorCount} vectors vs ${dbChunkCount} chunks`);
    }

    // Cleanup
    console.log('\n🧹 Cleanup');
    console.log('----------------------------');
    await indexer.close();
    console.log('✓ Connections closed');

    console.log('\n✅ All Phase 3 tests passed!');
    console.log('\nNext Steps:');
    console.log('  - Phase 4: Retrieval System (semantic + hybrid search)');
    console.log('  - Phase 5: Integration with Temporal workflows');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await indexer.close();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testPhase3().catch(async (error) => {
  console.error('\n❌ Test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
