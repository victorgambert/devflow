/**
 * Notion Integration Types
 */

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  fieldMapping?: NotionFieldMapping;
}

export interface NotionFieldMapping {
  title: string;
  status: string;
  priority: string;
  assignee: string;
  description?: string;
  epic?: string;
  storyPoints?: string;
  labels?: string;
}

export interface NotionTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee?: string;
  epic?: string;
  storyPoints?: number;
  labels?: string[];
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, any>;
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  properties: Record<string, any>;
}

export interface NotionDatabaseQuery {
  database_id: string;
  filter?: any;
  sorts?: any[];
  page_size?: number;
  start_cursor?: string;
}

