/**
 * Sentry Integration Module
 *
 * Exports Sentry client and types for context extraction.
 */

export { SentryClient, createSentryClient } from './sentry.client';
export type {
  SentryIssue,
  SentryEvent,
  SentryIssueContext,
  SentryStacktrace,
  SentryStackFrame,
  SentryTag,
  SentryProject,
} from './sentry.types';
