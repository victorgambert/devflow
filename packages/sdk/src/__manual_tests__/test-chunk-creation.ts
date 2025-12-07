import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testChunkCreation() {
  console.log('🧪 Testing DocumentChunk creation...\n');

  try {
    const chunk = await prisma.documentChunk.create({
      data: {
        codebaseIndexId: 'test-chunk',
        filePath: 'test.php',
        startLine: 1,
        endLine: 10,
        chunkIndex: 0,
        content: 'test content',
        language: 'php',
        chunkType: 'module',
        qdrantPointId: 'test-point',
        metadata: {},
      },
    });

    console.log('✅ Test chunk created successfully:', chunk.id);

    await prisma.documentChunk.delete({ where: { id: chunk.id } });
    console.log('✅ Test chunk deleted\n');

    console.log('✅ DocumentChunk schema is working correctly!');
  } catch (error) {
    console.error('❌ Error creating test chunk:');
    console.error(error);
  }

  await prisma.$disconnect();
}

testChunkCreation().catch(console.error);
