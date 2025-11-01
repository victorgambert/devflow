/**
 * Notion Client - Real implementation using @notionhq/client
 */

import { Client } from '@notionhq/client';
import { createLogger } from '@devflow/common';
import { NotionConfig, NotionTask, NotionPage, NotionDatabaseQuery } from './notion.types';
import { NotionMapper } from './notion.mapper';

export class NotionClient {
  private client: Client;
  private mapper: NotionMapper;
  private logger = createLogger('NotionClient');
  private databaseId: string;

  constructor(config: NotionConfig) {
    this.client = new Client({ auth: config.apiKey });
    this.databaseId = config.databaseId;
    this.mapper = new NotionMapper(config.fieldMapping);
  }

  /**
   * Query tasks from Notion database
   */
  async queryTasks(options?: {
    filter?: any;
    sorts?: any[];
    pageSize?: number;
  }): Promise<NotionTask[]> {
    this.logger.info('Querying tasks from Notion', { databaseId: this.databaseId });

    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: options?.filter,
        sorts: options?.sorts || [
          {
            property: 'Last edited time',
            direction: 'descending',
          },
        ],
        page_size: options?.pageSize || 100,
      });

      const tasks = response.results.map((page: any) => this.mapper.pageToTask(page));

      this.logger.info('Tasks retrieved', { count: tasks.length });
      return tasks;
    } catch (error) {
      this.logger.error('Failed to query tasks', error as Error);
      throw error;
    }
  }

  /**
   * Get a single task by Notion page ID
   */
  async getTask(pageId: string): Promise<NotionTask> {
    this.logger.info('Getting task', { pageId });

    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });
      return this.mapper.pageToTask(page as any);
    } catch (error) {
      this.logger.error('Failed to get task', error as Error, { pageId });
      throw error;
    }
  }

  /**
   * Create a new task in Notion
   */
  async createTask(task: Partial<NotionTask>): Promise<NotionTask> {
    this.logger.info('Creating task in Notion', { title: task.title });

    try {
      const properties = this.mapper.taskToProperties(task as NotionTask);

      const response = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      const created = this.mapper.pageToTask(response as any);
      this.logger.info('Task created', { id: created.id, title: created.title });
      return created;
    } catch (error) {
      this.logger.error('Failed to create task', error as Error);
      throw error;
    }
  }

  /**
   * Update a task in Notion
   */
  async updateTask(pageId: string, updates: Partial<NotionTask>): Promise<NotionTask> {
    this.logger.info('Updating task in Notion', { pageId });

    try {
      const properties = this.mapper.taskToProperties(updates as NotionTask);

      const response = await this.client.pages.update({
        page_id: pageId,
        properties,
      });

      const updated = this.mapper.pageToTask(response as any);
      this.logger.info('Task updated', { id: updated.id });
      return updated;
    } catch (error) {
      this.logger.error('Failed to update task', error as Error, { pageId });
      throw error;
    }
  }

  /**
   * Archive (delete) a task in Notion
   */
  async archiveTask(pageId: string): Promise<void> {
    this.logger.info('Archiving task', { pageId });

    try {
      await this.client.pages.update({
        page_id: pageId,
        archived: true,
      });
      this.logger.info('Task archived', { pageId });
    } catch (error) {
      this.logger.error('Failed to archive task', error as Error, { pageId });
      throw error;
    }
  }

  /**
   * Query tasks with status filter
   */
  async queryTasksByStatus(status: string): Promise<NotionTask[]> {
    return this.queryTasks({
      filter: {
        property: this.mapper.getFieldMapping().status,
        select: {
          equals: status,
        },
      },
    });
  }

  /**
   * Query tasks with priority filter
   */
  async queryTasksByPriority(priority: string): Promise<NotionTask[]> {
    return this.queryTasks({
      filter: {
        property: this.mapper.getFieldMapping().priority,
        select: {
          equals: priority,
        },
      },
    });
  }

  /**
   * Query tasks assigned to a person
   */
  async queryTasksByAssignee(assignee: string): Promise<NotionTask[]> {
    return this.queryTasks({
      filter: {
        property: this.mapper.getFieldMapping().assignee,
        people: {
          contains: assignee,
        },
      },
    });
  }

  /**
   * Get recently updated tasks
   */
  async getRecentlyUpdatedTasks(hours: number = 24): Promise<NotionTask[]> {
    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return this.queryTasks({
      filter: {
        property: 'Last edited time',
        date: {
          after: sinceDate,
        },
      },
    });
  }

  /**
   * Search pages across workspace
   */
  async search(query: string): Promise<NotionPage[]> {
    this.logger.info('Searching Notion', { query });

    try {
      const response = await this.client.search({
        query,
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 100,
      });

      return response.results as NotionPage[];
    } catch (error) {
      this.logger.error('Search failed', error as Error, { query });
      throw error;
    }
  }

  /**
   * Get database schema
   */
  async getDatabaseSchema() {
    this.logger.info('Getting database schema', { databaseId: this.databaseId });

    try {
      const database = await this.client.databases.retrieve({
        database_id: this.databaseId,
      });

      return database;
    } catch (error) {
      this.logger.error('Failed to get database schema', error as Error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getDatabaseSchema();
      return true;
    } catch (error) {
      return false;
    }
  }
}

