/**
 * Notion Mapper - Convert between Notion and DevFlow formats
 */

import { NotionTask, NotionFieldMapping } from './notion.types';

export class NotionMapper {
  private fieldMapping: NotionFieldMapping;

  constructor(fieldMapping?: NotionFieldMapping) {
    this.fieldMapping = fieldMapping || {
      title: 'Name',
      status: 'Status',
      priority: 'Priority',
      assignee: 'Assignee',
      description: 'Description',
      epic: 'Epic',
      storyPoints: 'Story Points',
      labels: 'Labels',
    };
  }

  getFieldMapping(): NotionFieldMapping {
    return this.fieldMapping;
  }

  /**
   * Convert Notion page to DevFlow task
   */
  pageToTask(page: any): NotionTask {
    const props = page.properties;

    return {
      id: page.id,
      title: this.extractTitle(props[this.fieldMapping.title]),
      description: this.extractRichText(props[this.fieldMapping.description || 'Description']),
      status: this.extractSelect(props[this.fieldMapping.status]),
      priority: this.extractSelect(props[this.fieldMapping.priority]),
      assignee: this.extractPeople(props[this.fieldMapping.assignee])?.[0],
      epic: this.extractSelect(props[this.fieldMapping.epic || 'Epic']),
      storyPoints: this.extractNumber(props[this.fieldMapping.storyPoints || 'Story Points']),
      labels: this.extractMultiSelect(props[this.fieldMapping.labels || 'Labels']),
      url: page.url,
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
      properties: props,
    };
  }

  /**
   * Convert DevFlow task to Notion properties
   */
  taskToProperties(task: NotionTask): Record<string, any> {
    const properties: Record<string, any> = {};

    if (task.title) {
      properties[this.fieldMapping.title] = {
        title: [{ text: { content: task.title } }],
      };
    }

    if (task.description) {
      properties[this.fieldMapping.description || 'Description'] = {
        rich_text: [{ text: { content: task.description } }],
      };
    }

    if (task.status) {
      properties[this.fieldMapping.status] = {
        select: { name: task.status },
      };
    }

    if (task.priority) {
      properties[this.fieldMapping.priority] = {
        select: { name: task.priority },
      };
    }

    if (task.epic) {
      properties[this.fieldMapping.epic || 'Epic'] = {
        select: { name: task.epic },
      };
    }

    if (task.storyPoints !== undefined) {
      properties[this.fieldMapping.storyPoints || 'Story Points'] = {
        number: task.storyPoints,
      };
    }

    if (task.labels && task.labels.length > 0) {
      properties[this.fieldMapping.labels || 'Labels'] = {
        multi_select: task.labels.map((label) => ({ name: label })),
      };
    }

    return properties;
  }

  /**
   * Map Notion status to DevFlow status
   */
  mapStatus(notionStatus: string): string {
    const statusMap: Record<string, string> = {
      'To Do': 'TODO',
      'In Progress': 'IN_PROGRESS',
      'In Review': 'IN_REVIEW',
      Testing: 'TESTING',
      Done: 'DONE',
      Blocked: 'BLOCKED',
      Cancelled: 'CANCELLED',
    };

    return statusMap[notionStatus] || notionStatus.toUpperCase().replace(/ /g, '_');
  }

  /**
   * Map DevFlow status to Notion status
   */
  mapStatusToNotion(somaSquadAIStatus: string): string {
    const statusMap: Record<string, string> = {
      TODO: 'To Do',
      IN_PROGRESS: 'In Progress',
      IN_REVIEW: 'In Review',
      TESTING: 'Testing',
      DONE: 'Done',
      BLOCKED: 'Blocked',
      CANCELLED: 'Cancelled',
    };

    return statusMap[somaSquadAIStatus] || somaSquadAIStatus;
  }

  /**
   * Map Notion priority to DevFlow priority
   */
  mapPriority(notionPriority: string): string {
    const priorityMap: Record<string, string> = {
      Low: 'LOW',
      Medium: 'MEDIUM',
      High: 'HIGH',
      Critical: 'CRITICAL',
    };

    return priorityMap[notionPriority] || notionPriority.toUpperCase();
  }

  /**
   * Map DevFlow priority to Notion priority
   */
  mapPriorityToNotion(somaSquadAIPriority: string): string {
    const priorityMap: Record<string, string> = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
      CRITICAL: 'Critical',
    };

    return priorityMap[somaSquadAIPriority] || somaSquadAIPriority;
  }

  // Private helper methods
  private extractTitle(property: any): string {
    if (!property || !property.title) return '';
    return property.title.map((t: any) => t.plain_text).join('');
  }

  private extractRichText(property: any): string {
    if (!property || !property.rich_text) return '';
    return property.rich_text.map((t: any) => t.plain_text).join('');
  }

  private extractSelect(property: any): string {
    if (!property || !property.select) return '';
    return property.select.name || '';
  }

  private extractMultiSelect(property: any): string[] {
    if (!property || !property.multi_select) return [];
    return property.multi_select.map((s: any) => s.name);
  }

  private extractNumber(property: any): number | undefined {
    if (!property || property.number === null || property.number === undefined) return undefined;
    return property.number;
  }

  private extractPeople(property: any): string[] | undefined {
    if (!property || !property.people) return undefined;
    return property.people.map((p: any) => p.name || p.email || p.id);
  }
}

