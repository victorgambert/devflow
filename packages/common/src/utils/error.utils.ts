/**
 * Error handling utilities
 */

export class DevFlowError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = 'DevFlowError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DevFlowError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DevFlowError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'NOT_FOUND', 404, metadata);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends DevFlowError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'UNAUTHORIZED', 401, metadata);
    this.name = 'UnauthorizedError';
  }
}

export class ConfigurationError extends DevFlowError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', 500, metadata);
    this.name = 'ConfigurationError';
  }
}

export class ExternalServiceError extends DevFlowError {
  constructor(message: string, service: string, metadata?: Record<string, any>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { ...metadata, service });
    this.name = 'ExternalServiceError';
  }
}

export function isDevFlowError(error: any): error is DevFlowError {
  return error instanceof DevFlowError;
}

export function serializeError(error: Error): Record<string, any> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(isDevFlowError(error) && {
      code: error.code,
      statusCode: error.statusCode,
      metadata: error.metadata,
    }),
  };
}

