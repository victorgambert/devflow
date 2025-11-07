/**
 * Notion Integration Activities - Real Implementation
 */

import { createLogger } from '@soma-squad-ai/common';
import { NotionClient, formatSpecAsMarkdown } from '@soma-squad-ai/sdk';

const logger = createLogger('NotionActivities');

export interface SyncNotionTaskInput {
  taskId: string;
  projectId: string;
}

export interface SyncNotionTaskOutput {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignee?: string;
  epic?: string;
  storyPoints?: number;
  labels?: string[];
  acceptanceCriteria?: string[];
}

/**
 * Sync task from Notion
 */
export async function syncNotionTask(input: SyncNotionTaskInput): Promise<SyncNotionTaskOutput> {
  logger.info('Syncing task from Notion', input);

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error('Notion not configured');
  }

  try {
    const client = new NotionClient({
      apiKey: notionApiKey,
      databaseId: notionDatabaseId,
    });

    // Get task from Notion by ID (assuming taskId is the Notion page ID)
    const notionTask = await client.getTask(input.taskId);

    return {
      id: notionTask.id,
      title: notionTask.title,
      description: notionTask.description,
      priority: notionTask.priority,
      status: notionTask.status,
      assignee: notionTask.assignee,
      epic: notionTask.epic,
      storyPoints: notionTask.storyPoints,
      labels: notionTask.labels,
    };
  } catch (error) {
    logger.error('Failed to sync task from Notion', error as Error, input);
    throw error;
  }
}

/**
 * Update task in Notion
 */
export async function updateNotionTask(input: {
  notionId: string;
  updates: Partial<SyncNotionTaskOutput>;
}): Promise<void> {
  logger.info('Updating task in Notion', { notionId: input.notionId });

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error('Notion not configured');
  }

  try {
    const client = new NotionClient({
      apiKey: notionApiKey,
      databaseId: notionDatabaseId,
    });

    await client.updateTask(input.notionId, {
      ...input.updates,
      url: '',
      createdTime: '',
      lastEditedTime: '',
      properties: {},
    } as any);

    logger.info('Task updated in Notion', { notionId: input.notionId });
  } catch (error) {
    logger.error('Failed to update task in Notion', error as Error, { notionId: input.notionId });
    throw error;
  }
}

/**
 * Query tasks from Notion by status
 */
export async function queryNotionTasksByStatus(status: string): Promise<SyncNotionTaskOutput[]> {
  logger.info('Querying Notion tasks by status', { status });

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error('Notion not configured');
  }

  try {
    const client = new NotionClient({
      apiKey: notionApiKey,
      databaseId: notionDatabaseId,
    });

    const tasks = await client.queryTasksByStatus(status);

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      epic: task.epic,
      storyPoints: task.storyPoints,
      labels: task.labels,
    }));
  } catch (error) {
    logger.error('Failed to query Notion tasks', error as Error, { status });
    throw error;
  }
}

/**
 * Append spec content to Notion page body
 */
export async function appendSpecToNotionPage(input: {
  notionId: string;
  spec: any;
}): Promise<void> {
  logger.info('Appending spec to Notion page', { notionId: input.notionId });

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error('Notion not configured');
  }

  try {
    const client = new NotionClient({
      apiKey: notionApiKey,
      databaseId: notionDatabaseId,
    });

    // Format spec as markdown
    const markdown = formatSpecAsMarkdown(input.spec);

    // Append to page content
    await client.appendPageContent(input.notionId, markdown);

    logger.info('Spec appended to Notion page', { notionId: input.notionId });
  } catch (error) {
    logger.error('Failed to append spec to Notion', error as Error, { notionId: input.notionId });
    throw error;
  }
}

/**
 * Append a warning callout to Notion page after spec generation
 */
export async function appendWarningToNotionPage(input: {
  notionId: string;
  message?: string;
}): Promise<void> {
  logger.info('Appending warning callout to Notion page', { notionId: input.notionId });

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error('Notion not configured');
  }

  try {
    const client = new NotionClient({
      apiKey: notionApiKey,
      databaseId: notionDatabaseId,
    });

    // Use custom message or default
    const warningMessage =
      input.message ||
      process.env.NOTION_SPEC_WARNING_MESSAGE ||
      '⚠️ Les spécifications ont été générées automatiquement par DevFlow.\nLes modifications manuelles ne seront pas prises en compte dans le flux de développement.';

    // Append callout to page
    await client.appendCalloutToPage(input.notionId, warningMessage, {
      emoji: '⚠️',
      color: 'yellow_background',
    });

    logger.info('Warning callout appended to Notion page', { notionId: input.notionId });
  } catch (error) {
    logger.error('Failed to append warning to Notion', error as Error, { notionId: input.notionId });
    // Non-critical operation - don't throw
    logger.warn('Continuing despite warning callout failure');
  }
}
