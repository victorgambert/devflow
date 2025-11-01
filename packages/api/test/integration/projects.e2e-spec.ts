/**
 * Projects E2E Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    
    prisma = app.get<PrismaService>(PrismaService);
    
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    if (process.env.NODE_ENV === 'test') {
      await prisma.cleanDatabase();
    }
  });

  describe('/api/v1/projects (POST)', () => {
    it('should create a new project', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects')
        .send({
          name: 'Test Project',
          description: 'Test Description',
          repository: 'https://github.com/test/repo',
          config: {
            version: '1.0',
            project: {
              name: 'test',
              language: 'typescript',
            },
            vcs: {
              provider: 'github',
              base_branch: 'main',
            },
            commands: {
              build: 'npm run build',
              lint: 'npm run lint',
              unit: 'npm test',
              e2e: 'npm run test:e2e',
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
              required: ['lint', 'unit'],
            },
            notifications: {
              events: ['workflow_completed'],
              channels: {},
            },
            files: {
              watch: ['src/**'],
              ignore: ['node_modules/**'],
            },
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Project');
          expect(res.body.isActive).toBe(true);
        });
    });

    it('should reject invalid project data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/projects')
        .send({
          name: '',  // Empty name should fail
        })
        .expect(400);
    });
  });

  describe('/api/v1/projects (GET)', () => {
    it('should return empty array when no projects', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(0);
        });
    });

    it('should return all projects', async () => {
      // Create a project first
      await prisma.project.create({
        data: {
          name: 'Test Project',
          description: 'Test',
          repository: 'https://github.com/test/repo',
          config: {},
        },
      });

      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].name).toBe('Test Project');
        });
    });
  });

  describe('/api/v1/projects/:id (GET)', () => {
    it('should return project by id', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          description: 'Test',
          repository: 'https://github.com/test/repo',
          config: {},
        },
      });

      return request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(project.id);
          expect(res.body.name).toBe('Test Project');
        });
    });

    it('should return 404 for non-existent project', () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects/non-existent-id')
        .expect(404);
    });
  });

  describe('/api/v1/projects/:id/stats (GET)', () => {
    it('should return project statistics', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          description: 'Test',
          repository: 'https://github.com/test/repo',
          config: {},
          tasks: {
            create: [
              {
                title: 'Task 1',
                description: 'Description 1',
                status: 'TODO',
                priority: 'HIGH',
              },
              {
                title: 'Task 2',
                description: 'Description 2',
                status: 'IN_PROGRESS',
                priority: 'MEDIUM',
              },
            ],
          },
        },
      });

      return request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/stats`)
        .expect(200)
        .expect((res) => {
          expect(res.body.tasks.total).toBe(2);
          expect(res.body.tasks.byStatus).toHaveProperty('TODO');
          expect(res.body.tasks.byStatus).toHaveProperty('IN_PROGRESS');
        });
    });
  });
});

