/**
 * OpenTelemetry Tracing - Phase 5: Observability
 * Distributed tracing setup for API and Worker
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

// ============================================
// Configuration
// ============================================

const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL || 'http://localhost:4318';
const SERVICE_NAME = process.env.SERVICE_NAME || 'devflow';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.5.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// ============================================
// SDK Setup
// ============================================

let sdk: NodeSDK | null = null;

export function initializeTracing(serviceName?: string): NodeSDK {
  const finalServiceName = serviceName || SERVICE_NAME;

  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_COLLECTOR_URL}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${OTEL_COLLECTOR_URL}/v1/metrics`,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: finalServiceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    }),
    traceExporter,
    metricReader: metricExporter as any,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable specific instrumentations if needed
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Too verbose
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    try {
      await sdk?.shutdown();
      console.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry SDK', error);
    }
  });

  return sdk;
}

export function shutdownTracing(): Promise<void> {
  return sdk?.shutdown() || Promise.resolve();
}

// ============================================
// Tracer
// ============================================

const tracer = trace.getTracer('devflow', SERVICE_VERSION);

// ============================================
// Span Helpers
// ============================================

/**
 * Start a span with common attributes
 */
export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): Span {
  return tracer.startSpan(name, {
    attributes: {
      ...attributes,
      'service.version': SERVICE_VERSION,
      'deployment.environment': ENVIRONMENT,
    },
  });
}

/**
 * Run a function within a span
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> = {},
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = startSpan(name, attributes);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add workflow-specific attributes to a span
 */
export function addWorkflowAttributes(
  span: Span,
  attrs: {
    ticketId: string;
    projectId: string;
    workflowId: string;
    state?: string;
  },
): void {
  span.setAttributes({
    'ticket.id': attrs.ticketId,
    'project.id': attrs.projectId,
    'workflow.id': attrs.workflowId,
    ...(attrs.state && { 'workflow.state': attrs.state }),
  });
}

/**
 * Add agent-specific attributes to a span
 */
export function addAgentAttributes(
  span: Span,
  attrs: {
    provider: string;
    model: string;
    operation: string;
    inputTokens?: number;
    outputTokens?: number;
  },
): void {
  span.setAttributes({
    'agent.provider': attrs.provider,
    'agent.model': attrs.model,
    'agent.operation': attrs.operation,
    ...(attrs.inputTokens !== undefined && { 'agent.input_tokens': attrs.inputTokens }),
    ...(attrs.outputTokens !== undefined && { 'agent.output_tokens': attrs.outputTokens }),
  });
}

/**
 * Add VCS-specific attributes to a span
 */
export function addVcsAttributes(
  span: Span,
  attrs: {
    provider: string;
    repo: string;
    branch?: string;
    prNumber?: number;
  },
): void {
  span.setAttributes({
    'vcs.provider': attrs.provider,
    'vcs.repository': attrs.repo,
    ...(attrs.branch && { 'vcs.branch': attrs.branch }),
    ...(attrs.prNumber !== undefined && { 'vcs.pr_number': attrs.prNumber }),
  });
}

/**
 * Add CI-specific attributes to a span
 */
export function addCiAttributes(
  span: Span,
  attrs: {
    provider: string;
    runId: string;
    status?: string;
  },
): void {
  span.setAttributes({
    'ci.provider': attrs.provider,
    'ci.run_id': attrs.runId,
    ...(attrs.status && { 'ci.status': attrs.status }),
  });
}

/**
 * Add policy-specific attributes to a span
 */
export function addPolicyAttributes(
  span: Span,
  attrs: {
    policyType: string;
    allowed: boolean;
    violations?: number;
  },
): void {
  span.setAttributes({
    'policy.type': attrs.policyType,
    'policy.allowed': attrs.allowed,
    ...(attrs.violations !== undefined && { 'policy.violations': attrs.violations }),
  });
}

/**
 * Create a child span from current context
 */
export function createChildSpan(name: string, attributes?: Record<string, any>): Span {
  return tracer.startSpan(name, {
    attributes,
  }, context.active());
}

/**
 * Get current span from context
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Add event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set error on current span
 */
export function setSpanError(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}

// ============================================
// Correlation ID Management
// ============================================

const CORRELATION_ID_HEADER = 'x-request-id';
const CORRELATION_ID_CONTEXT_KEY = Symbol('correlationId');

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Extract correlation ID from headers
 */
export function extractCorrelationId(headers: Record<string, string | undefined>): string {
  return headers[CORRELATION_ID_HEADER] || headers['x-correlation-id'] || generateCorrelationId();
}

/**
 * Set correlation ID in context
 */
export function setCorrelationId(correlationId: string): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute('correlation.id', correlationId);
  }
}

/**
 * Get correlation ID from context
 */
export function getCorrelationId(): string | undefined {
  const span = getCurrentSpan();
  return span?.attributes['correlation.id'] as string | undefined;
}

// ============================================
// Workflow Tracing Helpers
// ============================================

/**
 * Create workflow span
 */
export async function traceWorkflow<T>(
  workflowId: string,
  ticketId: string,
  projectId: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    'workflow.execute',
    {
      'workflow.id': workflowId,
      'ticket.id': ticketId,
      'project.id': projectId,
    },
    fn,
  );
}

/**
 * Create state transition span
 */
export async function traceStateTransition<T>(
  fromState: string,
  toState: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    'workflow.state_transition',
    {
      'state.from': fromState,
      'state.to': toState,
    },
    fn,
  );
}

/**
 * Create agent operation span
 */
export async function traceAgentOperation<T>(
  provider: string,
  model: string,
  operation: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `agent.${operation}`,
    {
      'agent.provider': provider,
      'agent.model': model,
      'agent.operation': operation,
    },
    fn,
  );
}

/**
 * Create VCS operation span
 */
export async function traceVcsOperation<T>(
  operation: string,
  repo: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `vcs.${operation}`,
    {
      'vcs.operation': operation,
      'vcs.repository': repo,
    },
    fn,
  );
}

/**
 * Create CI operation span
 */
export async function traceCiOperation<T>(
  operation: string,
  runId: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `ci.${operation}`,
    {
      'ci.operation': operation,
      'ci.run_id': runId,
    },
    fn,
  );
}

