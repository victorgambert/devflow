/**
 * Notion Client - Real implementation using @notionhq/client
 */

import { Client } from '@notionhq/client';
import { createLogger } from '@soma-squad-ai/common';
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
            timestamp: 'last_edited_time',
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
        timestamp: 'last_edited_time',
        last_edited_time: {
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

  /**
   * Append content blocks to a page
   */
  async appendPageContent(pageId: string, markdown: string): Promise<void> {
    this.logger.info('Appending content to page', { pageId });

    try {
      // Convert markdown to Notion blocks
      const blocks = this.markdownToNotionBlocks(markdown);

      await this.client.blocks.children.append({
        block_id: pageId,
        children: blocks as any,
      });

      this.logger.info('Content appended', { pageId, blockCount: blocks.length });
    } catch (error) {
      this.logger.error('Failed to append content', error as Error, { pageId });
      throw error;
    }
  }

  /**
   * Append a callout warning block to a page
   */
  async appendCalloutToPage(
    pageId: string,
    text: string,
    options: {
      emoji?: string;
      color?: string;
    } = {},
  ): Promise<void> {
    this.logger.info('Appending callout to page', { pageId });

    const emoji = options.emoji || '⚠️';
    const color = options.color || 'yellow_background';

    try {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'callout',
            callout: {
              icon: { type: 'emoji', emoji },
              rich_text: [
                {
                  type: 'text',
                  text: { content: text },
                },
              ],
              color,
            },
          },
        ] as any,
      });

      this.logger.info('Callout appended to page', { pageId });
    } catch (error) {
      this.logger.error('Failed to append callout', error as Error, { pageId });
      // Don't throw - this is a non-critical operation
      this.logger.warn('Continuing despite callout failure');
    }
  }

  /**
   * Add a new option to a select property in the database
   */
  async addStatusOption(statusName: string, color?: string): Promise<void> {
    this.logger.info('Adding status option to database', { statusName, color });

    try {
      // Get current database schema
      const database = await this.getDatabaseSchema();
      const properties = (database as any).properties;

      // Find the Status property
      const statusPropertyName = this.mapper.getFieldMapping().status;
      const statusProperty = properties[statusPropertyName];

      if (!statusProperty || statusProperty.type !== 'select') {
        throw new Error(`Status property '${statusPropertyName}' not found or is not a select type`);
      }

      // Check if the option already exists
      const existingOptions = statusProperty.select.options || [];
      const exists = existingOptions.some((opt: any) => opt.name === statusName);

      if (exists) {
        this.logger.info('Status option already exists', { statusName });
        return;
      }

      // Add the new option
      const newOptions = [
        ...existingOptions,
        {
          name: statusName,
          color: color || 'blue',
        },
      ];

      // Update the database schema
      await this.client.databases.update({
        database_id: this.databaseId,
        properties: {
          [statusPropertyName]: {
            select: {
              options: newOptions,
            },
          },
        },
      });

      this.logger.info('Status option added successfully', { statusName });
    } catch (error) {
      this.logger.error('Failed to add status option', error as Error, { statusName });
      throw error;
    }
  }

  /**
   * Convert markdown to Notion blocks (basic implementation)
   */
  private markdownToNotionBlocks(markdown: string): any[] {
    const blocks: any[] = [];
    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        i++;
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.substring(2) } }],
          },
        });
      } else if (line.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.substring(3) } }],
          },
        });
      } else if (line.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: line.substring(4) } }],
          },
        });
      }
      // Bullet list
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.substring(2) } }],
          },
        });
      }
      // Numbered list
      else if (/^\d+\.\s/.test(line)) {
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }],
          },
        });
      }
      // Code block
      else if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
            language: 'plain text',
          },
        });
      }
      // Regular paragraph
      else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
          },
        });
      }

      i++;
    }

    return blocks;
  }
}

