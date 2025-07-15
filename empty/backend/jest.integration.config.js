/**
 * Jest Configuration for Integration Tests
 * 
 * Specialized Jest configuration for running integration tests with
 * proper database setup, timeouts, and cleanup.
 */

module.exports = {
  // Use the same preset as main Jest config
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns - only integration tests
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.spec.ts'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts',
    '<rootDir>/src/tests/integration/setup.integration.ts'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/tests/**/*',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],

  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Timeout settings for integration tests
  testTimeout: 60000, // 60 seconds for integration tests

  // Force exit to prevent hanging
  forceExit: true,
  detectOpenHandles: true,

  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs'
      }
    }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // Run tests in sequence for integration tests
  maxWorkers: 1
};
