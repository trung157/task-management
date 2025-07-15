/**
 * Integration Test Setup
 * 
 * Global setup for integration tests including database initialization,
 * environment configuration, and test utilities.
 */

import dotenv from 'dotenv';
import { logger } from '../../utils/logger';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Override database configuration for testing
process.env.DB_NAME = process.env.DB_NAME || 'task_management_test_db';
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = process.env.TEST_JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key';

// Set longer timeout for integration tests
jest.setTimeout(60000);

// Global test configuration
beforeAll(async () => {
  logger.info('🧪 Starting integration test suite');
  
  // Additional global setup can be added here
  // For example: warming up external services, cache clearing, etc.
});

afterAll(async () => {
  logger.info('🏁 Integration test suite completed');
  
  // Global cleanup
  // Close any remaining connections, clear caches, etc.
  
  // Force exit to prevent hanging
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in integration test:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in integration test:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Custom matchers for integration tests
expect.extend({
  /**
   * Check if response has API success structure
   */
  toBeApiSuccess(received) {
    const pass = received && 
                 received.success === true && 
                 received.hasOwnProperty('data');
    
    if (pass) {
      return {
        message: () => `expected response not to be API success format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response to be API success format with success: true and data property`,
        pass: false,
      };
    }
  },

  /**
   * Check if response has API error structure
   */
  toBeApiError(received) {
    const pass = received && 
                 received.success === false && 
                 received.hasOwnProperty('error');
    
    if (pass) {
      return {
        message: () => `expected response not to be API error format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response to be API error format with success: false and error property`,
        pass: false,
      };
    }
  },

  /**
   * Check if response time is within acceptable range
   */
  toBeWithinResponseTime(received, expectedMaxTime) {
    const pass = received <= expectedMaxTime;
    
    if (pass) {
      return {
        message: () => `expected response time ${received}ms to be greater than ${expectedMaxTime}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response time ${received}ms to be within ${expectedMaxTime}ms`,
        pass: false,
      };
    }
  },

  /**
   * Check if array contains valid task objects
   */
  toContainValidTasks(received) {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected ${received} to be an array`,
        pass: false,
      };
    }

    const invalidTasks = received.filter(task => 
      !task.id || 
      !task.title || 
      !task.user_id || 
      !['pending', 'in_progress', 'completed', 'archived'].includes(task.status) ||
      !['high', 'medium', 'low', 'none'].includes(task.priority)
    );

    const pass = invalidTasks.length === 0;
    
    if (pass) {
      return {
        message: () => `expected array not to contain only valid tasks`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected all tasks to be valid, but found ${invalidTasks.length} invalid tasks`,
        pass: false,
      };
    }
  }
});

// Extend TypeScript types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeApiSuccess(): R;
      toBeApiError(): R;
      toBeWithinResponseTime(expectedMaxTime: number): R;
      toContainValidTasks(): R;
    }
  }
}

// Export test utilities for use in test files
export const integrationTestUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate a unique test identifier
   */
  generateTestId: (): string => 
    `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Create a test date relative to now
   */
  createTestDate: (daysFromNow: number = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  },

  /**
   * Create multiple test dates
   */
  createTestDates: (daysArray: number[]): Date[] => 
    daysArray.map(days => integrationTestUtils.createTestDate(days)),

  /**
   * Validate API response structure
   */
  validateApiResponse: (response: any, expectedKeys: string[] = []): boolean => {
    if (!response || typeof response !== 'object') return false;
    if (!response.hasOwnProperty('success')) return false;
    
    if (response.success && !response.hasOwnProperty('data')) return false;
    if (!response.success && !response.hasOwnProperty('error')) return false;
    
    // Check for expected keys in data
    if (expectedKeys.length > 0 && response.data) {
      return expectedKeys.every(key => response.data.hasOwnProperty(key));
    }
    
    return true;
  },

  /**
   * Extract error message from API response
   */
  extractErrorMessage: (response: any): string => {
    if (response && response.error) {
      if (typeof response.error === 'string') return response.error;
      if (response.error.message) return response.error.message;
      if (response.error.details) return response.error.details;
    }
    return 'Unknown error';
  },

  /**
   * Check if string is a valid UUID
   */
  isValidUUID: (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  /**
   * Measure execution time of a function
   */
  measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
};

logger.info('🔧 Integration test setup completed');
