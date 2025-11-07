/**
 * Custom errors
 */

export class ConfigurationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

