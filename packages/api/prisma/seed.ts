/**
 * Prisma Seed Script
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: 'sample-project-1' },
    update: {},
    create: {
      id: 'sample-project-1',
      name: 'Sample DevFlow Project',
      description: 'A sample project to demonstrate DevFlow capabilities',
      repository: 'https://github.com/devflow/sample-project',
      workspacePath: '/tmp/sample-project',
      config: {
        version: '1.0',
        project: {
          name: 'sample-project',
          language: 'typescript',
          framework: 'nextjs',
        },
        vcs: {
          provider: 'github',
          base_branch: 'main',
        },
        commands: {
          build: 'pnpm build',
          lint: 'pnpm lint',
          unit: 'pnpm test',
          e2e: 'pnpm test:e2e',
        },
        ci: {
          provider: 'github-actions',
          config_path: '.github/workflows/main.yml',
        },
        code_agent: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
        },
        quality_gates: {
          required: ['lint', 'unit', 'build'],
        },
      },
    },
  });

  console.log(`✓ Created project: ${project.name}`);

  // Create sample tasks
  const task1 = await prisma.task.upsert({
    where: { id: 'sample-task-1' },
    update: {},
    create: {
      id: 'sample-task-1',
      projectId: project.id,
      title: 'Add user authentication',
      description: 'Implement JWT-based authentication with email/password login',
      status: 'TODO',
      priority: 'HIGH',
      labels: ['feature', 'security'],
    },
  });

  const task2 = await prisma.task.upsert({
    where: { id: 'sample-task-2' },
    update: {},
    create: {
      id: 'sample-task-2',
      projectId: project.id,
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      labels: ['infrastructure', 'devops'],
    },
  });

  console.log(`✓ Created ${2} sample tasks`);

  // Create sample API key
  const apiKey = await prisma.apiKey.upsert({
    where: { id: 'sample-api-key-1' },
    update: {},
    create: {
      id: 'sample-api-key-1',
      name: 'Development Key',
      key: 'dev_key_' + Math.random().toString(36).substring(7),
      scopes: ['projects:read', 'workflows:write'],
      isActive: true,
    },
  });

  console.log(`✓ Created API key: ${apiKey.name} (${apiKey.key})`);

  console.log('\n✅ Seeding completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

