/**
 * Seed project for DevFlow
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = '1ab06631-91da-4e65-bf1d-8d482c693845';

  // Check if project already exists
  const existing = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (existing) {
    console.log('Project already exists:', existing.name);
    return;
  }

  // Create project
  const project = await prisma.project.create({
    data: {
      id: projectId,
      name: 'Indy Promocode',
      description: 'Promo code system for Indy',
      repository: process.env.DEFAULT_REPO_URL,
      config: {
        vcs: {
          provider: 'github',
          owner: process.env.DEFAULT_REPO_OWNER || 'victorgambert',
          repo: process.env.DEFAULT_REPO_NAME || 'indy-promocode',
        },
        ci: {
          provider: 'github-actions',
        },
        ai: {
          provider: 'openrouter',
          model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
        }
      },
      isActive: true,
    }
  });

  console.log('✅ Project created:', project.name);
  console.log('   ID:', project.id);
  console.log('   Repository:', project.repository);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
