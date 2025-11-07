/**
 * Structured Logger - Phase 5: Observability
 * Pino-based logger with secret redaction and context enrichment
 */

import pino, { Logger as PinoLogger } from 'pino';
import { getCorrelationId } from '../tracing/opentelemetry';

// ============================================
// Redaction Patterns
// ============================================

const REDACTION_PATHS = [
  // API Keys and Tokens
  '*_KEY',
  '*_TOKEN',
  '*_SECRET',
  '*_PASSWORD',
  '*_CREDENTIAL',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'secretKey',
  'secret_key',
  'password',
  'passwd',
  'authorization',
  'Authorization',
  
  // Notion
  'notion.apiKey',
  'notion.*.apiKey',
  
  // GitHub
  'github.token',
  'github.*.token',
  'vcs.token',
  
  // Anthropic/OpenAI
  'anthropic.apiKey',
  'openai.apiKey',
  'agent.apiKey',
  
  // Database
  'database.password',
  'db.password',
  'connectionString',
  
  // Redis
  'redis.password',
];

// ============================================
// Logger Configuration
// ============================================

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');

const baseConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  redact: {
    paths: REDACTION_PATHS,
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'soma-squad-ai',
    env: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.5.0',
  },
};

// Development: Pretty print
const devTransport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'HH:MM:ss.l',
    messageFormat: '{correlation_id} [{context}] {msg}',
  },
});

// Production: JSON
const prodTransport = undefined; // Use default JSON output

// ============================================
// Root Logger
// ============================================

export const rootLogger: PinoLogger = pino(
  baseConfig,
  IS_PRODUCTION ? prodTransport : devTransport,
);

// ============================================
// Logger Factory
// ============================================

export interface LogContext {
  ticketId?: string;
  workflowId?: string;
  projectId?: string;
  state?: string;
  actor?: string;
  provider?: string;
  requestId?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private logger: PinoLogger;
  private context: LogContext;

  constructor(context: string | LogContext = {}) {
    const baseContext = typeof context === 'string'
      ? { context }
      : { context: context.context || 'default', ...context };
    
    this.context = baseContext;
    this.logger = rootLogger.child(baseContext);
  }

  /**
   * Add context to logger
   */
  withContext(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Add correlation ID from OpenTelemetry
   */
  private enrichWithCorrelationId(obj: any = {}): any {
    const correlationId = getCorrelationId();
    return correlationId ? { ...obj, correlation_id: correlationId } : obj;
  }

  /**
   * Debug log
   */
  debug(message: string, data?: any): void {
    this.logger.debug(this.enrichWithCorrelationId(data), message);
  }

  /**
   * Info log
   */
  info(message: string, data?: any): void {
    this.logger.info(this.enrichWithCorrelationId(data), message);
  }

  /**
   * Warn log
   */
  warn(message: string, data?: any): void {
    this.logger.warn(this.enrichWithCorrelationId(data), message);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error | any, data?: any): void {
    const errorData = error instanceof Error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...data,
        }
      : { error, ...data };

    this.logger.error(this.enrichWithCorrelationId(errorData), message);
  }

  /**
   * Fatal log
   */
  fatal(message: string, error?: Error | any, data?: any): void {
    const errorData = error instanceof Error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...data,
        }
      : { error, ...data };

    this.logger.fatal(this.enrichWithCorrelationId(errorData), message);
  }

  /**
   * Log workflow event
   */
  workflow(event: string, data?: any): void {
    this.info(`Workflow: ${event}`, {
      event_type: 'workflow',
      event,
      ...data,
    });
  }

  /**
   * Log state transition
   */
  stateTransition(fromState: string, toState: string, data?: any): void {
    this.info(`State transition: ${fromState} → ${toState}`, {
      event_type: 'state_transition',
      from_state: fromState,
      to_state: toState,
      ...data,
    });
  }

  /**
   * Log agent operation
   */
  agentOperation(
    operation: string,
    provider: string,
    data?: any,
  ): void {
    this.info(`Agent operation: ${operation}`, {
      event_type: 'agent_operation',
      operation,
      provider,
      ...data,
    });
  }

  /**
   * Log policy check
   */
  policyCheck(policyType: string, allowed: boolean, data?: any): void {
    this.info(`Policy check: ${policyType}`, {
      event_type: 'policy_check',
      policy_type: policyType,
      allowed,
      ...data,
    });
  }

  /**
   * Log security event
   */
  securityEvent(eventType: string, severity: string, data?: any): void {
    this.warn(`Security event: ${eventType}`, {
      event_type: 'security',
      security_event_type: eventType,
      severity,
      ...data,
    });
  }

  /**
   * Log SLA violation
   */
  slaViolation(slaName: string, actual: number, threshold: number, data?: any): void {
    this.warn(`SLA violation: ${slaName}`, {
      event_type: 'sla_violation',
      sla_name: slaName,
      actual,
      threshold,
      exceeded_by: actual - threshold,
      ...data,
    });
  }

  /**
   * Log metric
   */
  metric(metricName: string, value: number, unit?: string, data?: any): void {
    this.debug(`Metric: ${metricName} = ${value}${unit || ''}`, {
      event_type: 'metric',
      metric_name: metricName,
      value,
      unit,
      ...data,
    });
  }
}

// ============================================
// Factory Function
// ============================================

export function createLogger(context: string | LogContext): StructuredLogger {
  return new StructuredLogger(context);
}

// ============================================
// Default Export
// ============================================

export const logger = new StructuredLogger('default');



