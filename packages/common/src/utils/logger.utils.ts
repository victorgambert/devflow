/**
 * Logger utility functions
 */

import { LogLevel } from '../enums';

export interface LoggerOptions {
  level: LogLevel;
  context?: string;
  timestamp?: boolean;
}

export class Logger {
  private level: LogLevel;
  private context?: string;
  private timestamp: boolean;

  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.context = options.context;
    this.timestamp = options.timestamp ?? true;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: string, metadata?: Record<string, any>): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level.toUpperCase()}]`);

    if (this.context) {
      parts.push(`[${this.context}]`);
    }

    parts.push(message);

    if (metadata) {
      parts.push(JSON.stringify(metadata));
    }

    return parts.join(' ');
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.format(LogLevel.DEBUG, message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.format(LogLevel.INFO, message, metadata));
    }
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format(LogLevel.WARN, message, metadata));
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorData = error
        ? {
            ...metadata,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : metadata;
      console.error(this.format(LogLevel.ERROR, message, errorData));
    }
  }
}

export function createLogger(context: string, level: LogLevel = LogLevel.INFO): Logger {
  return new Logger({ level, context, timestamp: true });
}

