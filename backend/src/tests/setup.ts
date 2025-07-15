import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
// Use the database configuration from .env.test instead of hardcoded values
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Helper to create mock functions with specific return values
  createMockWithReturn: (returnValue: any) => jest.fn().mockResolvedValue(returnValue),
  
  // Helper to create mock functions that throw errors
  createMockWithError: (error: Error) => jest.fn().mockRejectedValue(error),
  
  // Helper to wait for promises in tests
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test IDs
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Helper to create test dates
  createTestDate: (daysFromNow: number = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }
};

// Extend global types for TypeScript
declare global {
  var testUtils: {
    createMockWithReturn: (returnValue: any) => jest.Mock;
    createMockWithError: (error: Error) => jest.Mock;
    waitFor: (ms: number) => Promise<void>;
    generateTestId: () => string;
    createTestDate: (daysFromNow?: number) => Date;
  };
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
});

// Setup and teardown for each test
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mock console methods to reduce noise in tests (optional)
if (process.env.JEST_SILENT === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
