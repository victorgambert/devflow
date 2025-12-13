/**
 * Sentry API Client
 *
 * Provides methods to fetch issue details and events from Sentry.
 * Used to extract error context for the refinement workflow.
 */

import axios, { AxiosInstance } from 'axios';
import {
  SentryIssue,
  SentryEvent,
  SentryIssueContext,
  SentryStacktrace,
  SentryStackFrame,
} from './sentry.types';

export class SentryClient {
  private readonly client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://sentry.io/api/0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get issue details by issue ID
   * @param issueId - Sentry issue ID (numeric string)
   */
  async getIssue(issueId: string): Promise<SentryIssue> {
    const response = await this.client.get<SentryIssue>(`/issues/${issueId}/`);
    return response.data;
  }

  /**
   * Get the latest event for an issue (includes full stacktrace)
   * @param issueId - Sentry issue ID
   */
  async getLatestEvent(issueId: string): Promise<SentryEvent | null> {
    const response = await this.client.get<SentryEvent[]>(
      `/issues/${issueId}/events/`,
      {
        params: {
          full: true,
          limit: 1,
        },
      },
    );

    return response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * Extract stacktrace from event entries
   */
  private extractStacktrace(event: SentryEvent): SentryStacktrace | undefined {
    const exceptionEntry = event.entries.find((e) => e.type === 'exception');

    if (!exceptionEntry || !exceptionEntry.data) {
      return undefined;
    }

    const exceptionData = exceptionEntry.data as {
      values?: Array<{
        type?: string;
        value?: string;
        stacktrace?: {
          frames?: Array<{
            filename?: string;
            function?: string;
            lineNo?: number;
            colNo?: number;
            context?: string[];
            absPath?: string;
            module?: string;
            inApp?: boolean;
          }>;
        };
      }>;
    };

    if (!exceptionData.values || exceptionData.values.length === 0) {
      return undefined;
    }

    const exception = exceptionData.values[0];
    const stacktrace = exception.stacktrace;

    if (!stacktrace || !stacktrace.frames) {
      return undefined;
    }

    // Filter to only in-app frames and limit to 10 most relevant
    const frames: SentryStackFrame[] = stacktrace.frames
      .filter((f) => f.inApp !== false)
      .slice(-10) // Get the 10 most recent frames
      .map((f) => ({
        filename: f.filename || 'unknown',
        function: f.function || 'unknown',
        lineNo: f.lineNo || 0,
        colNo: f.colNo,
        context: f.context,
        absPath: f.absPath,
        module: f.module,
        inApp: f.inApp,
      }));

    return { frames };
  }

  /**
   * Get full issue context for refinement
   * Combines issue details with latest event stacktrace
   */
  async getIssueContext(issueId: string): Promise<SentryIssueContext> {
    // Fetch issue and latest event in parallel
    const [issue, event] = await Promise.all([
      this.getIssue(issueId),
      this.getLatestEvent(issueId),
    ]);

    const context: SentryIssueContext = {
      issueId: issue.id,
      title: issue.title,
      shortId: issue.shortId,
      culprit: issue.culprit,
      count: parseInt(issue.count, 10),
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      status: issue.status,
      level: issue.level,
      platform: issue.platform,
      project: {
        id: issue.project.id,
        name: issue.project.name,
        slug: issue.project.slug,
      },
      tags: issue.tags.map((t) => ({ key: t.key, value: t.value })),
    };

    // Add error type and message from metadata
    if (issue.metadata) {
      context.errorType = issue.metadata.type;
      context.errorMessage = issue.metadata.value;
    }

    // Add stacktrace from latest event
    if (event) {
      context.stacktrace = this.extractStacktrace(event);
    }

    return context;
  }
}

/**
 * Create a Sentry client instance
 */
export function createSentryClient(accessToken: string): SentryClient {
  return new SentryClient(accessToken);
}
