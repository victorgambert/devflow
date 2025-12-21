/**
 * Linear Mapper - Maps between Linear issues and internal Task format
 */

import { TaskStatus, TaskPriority } from '@devflow/common';
import { LinearIssue, LinearTask } from '@/linear/linear.types';

export class LinearMapper {
  /**
   * Map Linear issue to internal LinearTask format
   */
  issueToTask(issue: LinearIssue): LinearTask {
    return {
      id: issue.id,
      linearId: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      status: this.mapStatusFromLinear(issue.state?.name),
      priority: this.mapPriorityFromLinear(issue.priority),
      assignee: issue.assignee?.name,
      labels: issue.labels?.map(l => l.name) || [],
      url: issue.url,
      createdAt: new Date(issue.createdAt),
      updatedAt: new Date(issue.updatedAt),
    };
  }

  /**
   * Map Linear priority number (0-4) to internal priority string
   * Linear: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
   */
  mapPriorityFromLinear(priority: number): string {
    switch (priority) {
      case 1:
        return TaskPriority.CRITICAL;
      case 2:
        return TaskPriority.HIGH;
      case 3:
        return TaskPriority.MEDIUM;
      case 4:
        return TaskPriority.LOW;
      default:
        return TaskPriority.MEDIUM;
    }
  }

  /**
   * Map internal priority to Linear priority number
   */
  mapPriorityToLinear(priority: string): number {
    switch (priority.toLowerCase()) {
      case TaskPriority.CRITICAL:
        return 1;
      case TaskPriority.HIGH:
        return 2;
      case TaskPriority.MEDIUM:
        return 3;
      case TaskPriority.LOW:
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Map Linear priority to human-readable label
   */
  mapPriorityToLabel(priority: number): string {
    switch (priority) {
      case 1:
        return 'Urgent';
      case 2:
        return 'High';
      case 3:
        return 'Medium';
      case 4:
        return 'Low';
      default:
        return 'No Priority';
    }
  }

  /**
   * Map Linear state name to internal TaskStatus
   */
  mapStatusFromLinear(stateName?: string): string {
    // Return the actual Linear state name for workflow routing
    // The Three-Phase Agile workflow needs exact status name matching
    // (e.g., "To Refinement" === "To Refinement")
    if (!stateName) return TaskStatus.TODO;

    return stateName;
  }

  /**
   * Map Linear status to normalized internal TaskStatus (for generic processing)
   * Use this when you need a normalized status, not the exact Linear state name
   */
  mapStatusToInternalStatus(stateName?: string): string {
    if (!stateName) return TaskStatus.TODO;

    const normalizedState = stateName.toLowerCase();

    // Common Linear states mapping
    if (normalizedState.includes('backlog') || normalizedState.includes('triage')) {
      return TaskStatus.TODO;
    }
    if (normalizedState.includes('todo') || normalizedState.includes('to do')) {
      return TaskStatus.TODO;
    }
    if (normalizedState.includes('spec') || normalizedState.includes('specification')) {
      return TaskStatus.SPECIFICATION;
    }
    if (normalizedState.includes('progress') || normalizedState.includes('doing')) {
      return TaskStatus.IN_PROGRESS;
    }
    if (normalizedState.includes('review')) {
      return TaskStatus.IN_REVIEW;
    }
    if (normalizedState.includes('test') || normalizedState.includes('qa')) {
      return TaskStatus.TESTING;
    }
    if (normalizedState.includes('done') || normalizedState.includes('complete') || normalizedState.includes('closed')) {
      return TaskStatus.DONE;
    }
    if (normalizedState.includes('block') || normalizedState.includes('cancel')) {
      return TaskStatus.BLOCKED;
    }

    return TaskStatus.TODO;
  }

  /**
   * Map internal TaskStatus to suggested Linear state name
   * Note: Actual state names vary by team, these are suggestions
   */
  mapStatusToLinear(status: string): string {
    switch (status) {
      case TaskStatus.TODO:
        return 'Todo';
      case TaskStatus.SPECIFICATION:
        return 'Spec Ready';
      case TaskStatus.IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.IN_REVIEW:
        return 'In Review';
      case TaskStatus.TESTING:
        return 'Testing';
      case TaskStatus.DONE:
        return 'Done';
      case TaskStatus.BLOCKED:
        return 'Blocked';
      default:
        return 'Todo';
    }
  }
}
