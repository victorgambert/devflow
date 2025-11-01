/**
 * Notion Client Integration Tests
 */

import { NotionClient } from '../notion.client';

describe('NotionClient', () => {
  let client: NotionClient;
  const apiKey = process.env.NOTION_API_KEY || 'test-key';
  const databaseId = process.env.NOTION_DATABASE_ID || 'test-db-id';

  beforeEach(() => {
    client = new NotionClient({ apiKey, databaseId });
  });

  describe('Connection', () => {
    it('should test connection', async () => {
      if (!process.env.NOTION_API_KEY) {
        console.log('Skipping test: NOTION_API_KEY not set');
        return;
      }

      const connected = await client.testConnection();
      expect(connected).toBe(true);
    });
  });

  describe('Task Operations', () => {
    it('should query tasks', async () => {
      if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
        console.log('Skipping test: Notion credentials not set');
        return;
      }

      const tasks = await client.queryTasks();
      
      expect(Array.isArray(tasks)).toBe(true);
      
      if (tasks.length > 0) {
        const task = tasks[0];
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('priority');
      }
    });

    it('should query tasks by status', async () => {
      if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
        console.log('Skipping test: Notion credentials not set');
        return;
      }

      const tasks = await client.queryTasksByStatus('To Do');
      
      expect(Array.isArray(tasks)).toBe(true);
      
      if (tasks.length > 0) {
        expect(tasks[0].status).toBe('To Do');
      }
    });

    it('should get recently updated tasks', async () => {
      if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
        console.log('Skipping test: Notion credentials not set');
        return;
      }

      const tasks = await client.getRecentlyUpdatedTasks(24);
      
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Task CRUD', () => {
    let createdTaskId: string | null = null;

    it('should create a task', async () => {
      if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
        console.log('Skipping test: Notion credentials not set');
        return;
      }

      if (process.env.NODE_ENV === 'production') {
        console.log('Skipping test: production environment');
        return;
      }

      const task = await client.createTask({
        id: '',
        title: `Test Task ${Date.now()}`,
        description: 'Created by integration test',
        status: 'To Do',
        priority: 'Low',
        url: '',
        createdTime: '',
        lastEditedTime: '',
        properties: {},
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toContain('Test Task');
      
      createdTaskId = task.id;
    });

    it('should update a task', async () => {
      if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
        console.log('Skipping test: Notion credentials not set');
        return;
      }

      if (!createdTaskId) {
        console.log('Skipping test: no task created');
        return;
      }

      const updated = await client.updateTask(createdTaskId, {
        id: createdTaskId,
        title: '',
        description: '',
        status: 'In Progress',
        priority: 'High',
        url: '',
        createdTime: '',
        lastEditedTime: '',
        properties: {},
      });

      expect(updated.status).toBe('In Progress');
      expect(updated.priority).toBe('High');
    });

    afterAll(async () => {
      // Cleanup: archive the created task
      if (createdTaskId && process.env.NOTION_API_KEY) {
        try {
          await client.archiveTask(createdTaskId);
        } catch (error) {
          console.log('Failed to cleanup test task:', error);
        }
      }
    });
  });

  describe('Mapper', () => {
    it('should correctly map Notion statuses', async () => {
      // This would test the mapping logic
      // Implementation depends on your specific status values
    });
  });
});

