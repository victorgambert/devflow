import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIndexes() {
  const indexes = await prisma.codebaseIndex.findMany({
    where: { projectId: { startsWith: 'test-' } },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });

  console.log(`\n📊 Found ${indexes.length} test indexes:\n`);

  for (const index of indexes) {
    console.log(`Index ID: ${index.id}`);
    console.log(`  Project ID: ${index.projectId}`);
    console.log(`  Status: ${index.status}`);
    console.log(`  Files: ${index.totalFiles}`);
    console.log(`  Chunks: ${index.totalChunks}`);
    console.log(`  Commit: ${index.commitSha}`);
    console.log(`  Started: ${index.startedAt}`);
    console.log(`  Completed: ${index.completedAt || 'N/A'}`);
    if (index.indexingDuration) {
      console.log(`  Duration: ${(index.indexingDuration / 1000).toFixed(2)}s`);
    }
    if (index.cost) {
      console.log(`  Cost: $${index.cost.toFixed(6)}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

checkIndexes().catch(console.error);
