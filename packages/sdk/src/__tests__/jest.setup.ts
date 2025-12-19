/**
 * Jest Setup for Integration Tests
 */

import * as dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config({ path: '../../.env' });
dotenv.config({ path: '../../.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Mock console in tests to reduce noise
if (process.env.JEST_SILENT === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

