/**
 * Task Type Detector - Analyzes task metadata to determine its type
 *
 * This helper analyzes the title, description, and labels of a task to classify it
 * into one of four categories: feature, bug, enhancement, or chore.
 */

export type TaskType = 'feature' | 'bug' | 'enhancement' | 'chore';

export interface TaskInput {
  title: string;
  description: string;
  labels?: string[];
}

/**
 * Détecte le type de tâche en analysant le titre, la description et les labels
 *
 * Priority order:
 * 1. Bug indicators (errors, crashes, fixes)
 * 2. Feature indicators (new functionality)
 * 3. Enhancement indicators (improvements to existing features)
 * 4. Chore (default fallback)
 */
export function detectTaskType(task: TaskInput): TaskType {
  const title = task.title.toLowerCase();
  const desc = task.description.toLowerCase();
  const labels = task.labels?.map((l) => l.toLowerCase()) || [];

  // Priority 1: Detect bugs
  if (
    labels.includes('bug') ||
    labels.includes('error') ||
    title.includes('fix') ||
    title.includes('bug') ||
    title.includes('error') ||
    desc.includes('error') ||
    desc.includes('crash') ||
    desc.includes('broken') ||
    desc.includes('not working') ||
    desc.includes('fails')
  ) {
    return 'bug';
  }

  // Priority 2: Detect features
  if (
    labels.includes('feature') ||
    labels.includes('new feature') ||
    title.includes('add') ||
    title.includes('implement') ||
    title.includes('create') ||
    title.includes('new') ||
    desc.includes('add new') ||
    desc.includes('implement')
  ) {
    return 'feature';
  }

  // Priority 3: Detect enhancements
  if (
    labels.includes('enhancement') ||
    labels.includes('improvement') ||
    title.includes('improve') ||
    title.includes('update') ||
    title.includes('enhance') ||
    title.includes('optimize') ||
    title.includes('refactor') ||
    desc.includes('improve') ||
    desc.includes('better') ||
    desc.includes('enhance')
  ) {
    return 'enhancement';
  }

  // Default: chore
  return 'chore';
}
