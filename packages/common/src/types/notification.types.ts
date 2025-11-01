/**
 * Notification Types
 */

export enum NotificationChannel {
  SLACK = 'slack',
  DISCORD = 'discord',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
}

export enum NotificationEvent {
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  SPEC_GENERATED = 'spec_generated',
  PR_CREATED = 'pr_created',
  PR_MERGED = 'pr_merged',
  CI_FAILED = 'ci_failed',
  CI_PASSED = 'ci_passed',
  TESTS_FAILED = 'tests_failed',
  QA_COMPLETED = 'qa_completed',
}

export interface Notification {
  id: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, any>;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface SlackNotification {
  channel?: string;
  username?: string;
  icon_emoji?: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
}

export interface DiscordNotification {
  content: string;
  embeds?: any[];
  username?: string;
  avatar_url?: string;
}

export interface EmailNotification {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
}

