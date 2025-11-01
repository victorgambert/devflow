/**
 * String utility functions
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function camelToSnake(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(text: string): string {
  return text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function generateBranchName(pattern: string, taskId: string, taskTitle: string): string {
  const slug = slugify(taskTitle);
  return pattern.replace('{task-id}', taskId).replace('{task-slug}', slug);
}

export function maskSecret(secret: string, visibleChars = 4): string {
  if (!secret || secret.length <= visibleChars) return '***';
  return secret.slice(0, visibleChars) + '*'.repeat(secret.length - visibleChars);
}

