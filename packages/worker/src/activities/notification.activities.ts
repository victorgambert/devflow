/**
 * Notification Activities
 */

import { createLogger } from '@soma-squad-ai/common';

const logger = createLogger('NotificationActivities');

export interface SendNotificationInput {
  projectId: string;
  event: string;
  data: Record<string, any>;
}

/**
 * Send notification via configured channels
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  logger.info('Sending notification', input);

  // TODO: Implement notification sending (Slack, Discord, Email)
  // For now, just log
  logger.info('Notification sent', { event: input.event, data: input.data });
}

