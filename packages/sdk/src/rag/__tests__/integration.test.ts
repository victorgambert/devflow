// DEPRECATED: This test uses old token auth. Update to OAuth in Phase 5.

/**
 * Integration Tests for RAG Pipeline
 *
 * These tests require:
 * - OPENROUTER_API_KEY environment variable
 * - GITHUB_TOKEN environment variable
 * - Running Qdrant instance (localhost:6333)
 * - Running Redis instance (localhost:6379)
 * - Running PostgreSQL with migrated schema
 *
 * To run: npm test -- integration.test.ts
 */

import { RepositoryIndexer } from '@/rag/indexing/repository-indexer';
import { SemanticRetriever } from '@/rag/retrieval/semantic-retriever';
import { HybridRetriever } from '@/rag/retrieval/hybrid-retriever';
import { LLMReranker } from '@/rag/retrieval/reranker';
import { IncrementalIndexer } from '@/rag/indexing/incremental-indexer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Skip tests if required env vars are not set or RUN_INTEGRATION_TESTS is not set
const skipIfMissingEnv = () => {
  // Require explicit opt-in for integration tests
  if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
    console.log('⏭️  Skipping integration tests: RUN_INTEGRATION_TESTS not set to true');
    return true;
  }
  if (!process.env.OPENROUTER_API_KEY || !process.env.GITHUB_TOKEN) {
    console.log('⏭️  Skipping integration tests: API keys not set');
    return true;
  }
  if (!process.env.DATABASE_URL) {
    console.log('⏭️  Skipping integration tests: DATABASE_URL not set');
    return true;
  }
  return false;
};

// Skip the entire suite if env vars not set
const shouldSkip = skipIfMissingEnv();

// Use conditional describe to skip entire test suite
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('RAG Integration Tests', () => {
  const testProjectId = 'test-rag-integration';
  const testOwner = 'victorgambert';
  const testRepo = 'indy-promocode';
  let testIndexId: string;

  beforeAll(async () => {
    // Create test project
    await prisma.project.upsert({
      where: { id: testProjectId },
      update: {},
      create: {
        id: testProjectId,
        name: 'Test RAG Integration',
        description: 'Integration test project',
        repository: `https://github.com/${testOwner}/${testRepo}`,
        config: {},  // Required field
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup: Delete test project and related data
    if (testIndexId) {
      await prisma.documentChunk.deleteMany({
        where: { codebaseIndexId: testIndexId },
      });
      await prisma.codebaseIndex.deleteMany({
        where: { id: testIndexId },
      });
    }
    await prisma.project.delete({
      where: { id: testProjectId },
    }).catch(() => {});
    await prisma.$disconnect();
  }, 30000);

  describe('Full Indexing Pipeline', () => {
    it('should index a small repository successfully', async () => {
      const indexer = new RepositoryIndexer({
        githubToken: process.env.GITHUB_TOKEN!,
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      try {
        testIndexId = await indexer.indexRepository(
          testOwner,
          testRepo,
          testProjectId
        );

        expect(testIndexId).toBeDefined();

        // Verify index in database
        const index = await prisma.codebaseIndex.findUnique({
          where: { id: testIndexId },
        });

        expect(index).not.toBeNull();
        expect(index?.status).toBe('COMPLETED');
        expect(index?.totalChunks).toBeGreaterThan(0);
        expect(index?.totalFiles).toBeGreaterThan(0);
        expect(index?.cost).toBeGreaterThan(0);
      } finally {
        await indexer.close();
      }
    }, 300000); // 5 minute timeout

    it('should create document chunks in database', async () => {
      expect(testIndexId).toBeDefined();

      const chunks = await prisma.documentChunk.findMany({
        where: { codebaseIndexId: testIndexId },
        take: 10,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.filePath).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.language).toBeDefined();
        expect(chunk.chunkType).toBeDefined();
        expect(chunk.qdrantPointId).toBeDefined();
      });
    });
  });

  describe('Semantic Retrieval', () => {
    it('should retrieve relevant code chunks', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const retriever = new SemanticRetriever({
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      try {
        const results = await retriever.retrieve(
          'user authentication and login',
          testProjectId,
          5
        );

        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(5);

        results.forEach(result => {
          expect(result.chunkId).toBeDefined();
          expect(result.filePath).toBeDefined();
          expect(result.content).toBeDefined();
          expect(result.score).toBeGreaterThan(0);
          expect(result.score).toBeLessThanOrEqual(1);
          expect(result.language).toBeDefined();
        });
      } finally {
        await retriever.close();
      }
    }, 60000);

    it('should respect score threshold', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const retriever = new SemanticRetriever({
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      try {
        const results = await retriever.retrieve(
          'completely unrelated query about quantum physics',
          testProjectId,
          10,
          undefined,
          0.9 // Very high threshold
        );

        // Might return empty results if no chunks score above 0.9
        results.forEach(result => {
          expect(result.score).toBeGreaterThanOrEqual(0.9);
        });
      } finally {
        await retriever.close();
      }
    }, 60000);
  });

  describe('Hybrid Retrieval', () => {
    it('should combine semantic and keyword search', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const semanticRetriever = new SemanticRetriever({
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      const hybridRetriever = new HybridRetriever(semanticRetriever);

      try {
        const results = await hybridRetriever.retrieve(
          'function database query',
          testProjectId,
          5
        );

        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0);
        });
      } finally {
        await semanticRetriever.close();
        await hybridRetriever.close();
      }
    }, 60000);
  });

  describe('LLM Reranking', () => {
    it('should rerank results intelligently', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const semanticRetriever = new SemanticRetriever({
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      const reranker = new LLMReranker({
        apiKey: process.env.OPENROUTER_API_KEY!,
        model: 'anthropic/claude-3-haiku',
      });

      try {
        // Get initial results
        const initialResults = await semanticRetriever.retrieve(
          'how to validate user input',
          testProjectId,
          10
        );

        if (initialResults.length === 0) {
          console.log('Skipping reranking: No results to rerank');
          return;
        }

        // Rerank
        const rerankedResults = await reranker.rerank(
          'how to validate user input',
          initialResults,
          5
        );

        expect(rerankedResults.length).toBeGreaterThan(0);
        expect(rerankedResults.length).toBeLessThanOrEqual(5);
      } finally {
        await semanticRetriever.close();
      }
    }, 90000);
  });

  describe('Incremental Indexing', () => {
    it('should handle file additions incrementally', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const indexer = new IncrementalIndexer({
        githubToken: process.env.GITHUB_TOKEN!,
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      try {
        // Get current chunk count
        const beforeIndex = await prisma.codebaseIndex.findUnique({
          where: { id: testIndexId },
        });

        const beforeChunkCount = beforeIndex?.totalChunks || 0;

        // Simulate adding a file (use a real file from the repo)
        const result = await indexer.updateIndex(
          testOwner,
          testRepo,
          testIndexId,
          {
            added: ['README.md'],
            modified: [],
            removed: [],
          },
          'HEAD'
        );

        expect(result.chunksAdded).toBeGreaterThanOrEqual(0);
        expect(result.chunksModified).toBe(0);
        expect(result.chunksRemoved).toBe(0);

        // Verify index was updated
        const afterIndex = await prisma.codebaseIndex.findUnique({
          where: { id: testIndexId },
        });

        expect(afterIndex?.status).toBe('COMPLETED');
      } finally {
        await indexer.close();
      }
    }, 120000);
  });

  describe('Cache Effectiveness', () => {
    it('should cache query embeddings', async () => {
      if (!testIndexId) {
        console.log('Skipping: No index available');
        return;
      }

      const retriever = new SemanticRetriever({
        embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
        qdrantHost: 'localhost',
        qdrantPort: 6333,
        collectionName: 'test_integration',
        redisHost: 'localhost',
        redisPort: 6379,
      });

      try {
        const query = 'unique test query ' + Date.now();

        // First retrieval (cache miss)
        const start1 = Date.now();
        await retriever.retrieve(query, testProjectId, 5);
        const duration1 = Date.now() - start1;

        // Second retrieval (cache hit)
        const start2 = Date.now();
        await retriever.retrieve(query, testProjectId, 5);
        const duration2 = Date.now() - start2;

        // Cache hit should be significantly faster
        expect(duration2).toBeLessThan(duration1);
      } finally {
        await retriever.close();
      }
    }, 60000);
  });
});
