# Task Management API Test Utilities

A comprehensive testing framework for the Task Management API that provides database fixtures, helper functions, and utilities for integration testing with Jest and PostgreSQL.

## Overview

The integration tests are designed to test the entire API stack including:
- HTTP endpoints and routing
- Authentication and authorization
- Database operations
- Request/response handling
- Error handling and validation
- Performance and concurrency

## Test Structure

### Files and Directories

```
src/tests/integration/
├── setup.integration.ts              # Global test setup and utilities
├── integrationTestSetup.ts           # Database and auth setup utilities
├── simple.integration.test.ts        # Demonstrates test patterns (working)
├── taskApiCleaner.integration.test.ts # Full task API tests
├── authApi.integration.test.ts       # Authentication API tests
└── integration-test-runner.ts        # Custom test runner
```

### Configuration Files

```
backend/
├── jest.integration.config.js        # Jest config for integration tests
├── .env.test                         # Test environment variables
└── package.json                     # Test scripts
```

## Running Integration Tests

### Prerequisites

1. **Test Database**: Ensure test database exists and is accessible
2. **Environment Variables**: Configure `.env.test` with test database credentials
3. **Dependencies**: All npm packages installed (`npm install`)

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run integration tests with coverage
npm run test:integration:coverage

# Run integration tests in watch mode
npm run test:integration:watch

# Run specific test file
npx jest src/tests/integration/simple.integration.test.ts

# Run custom test runner
npm run test:integration:runner

# Run unit tests only (excluding integration)
npm run test:unit

# Run all tests (unit + integration)
npm run test:all
```

## Test Categories

### 1. Task Management API Tests

**File**: `taskApiCleaner.integration.test.ts`

Tests all task-related endpoints:
- `POST /api/v1/tasks` - Create tasks
- `GET /api/v1/tasks` - List tasks with filtering and pagination
- `GET /api/v1/tasks/:id` - Get specific task
- `PUT /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task
- `PATCH /api/v1/tasks/:id/complete` - Mark task complete
- `GET /api/v1/tasks/stats` - Task statistics
- `GET /api/v1/tasks/due-soon` - Tasks due soon
- `PATCH /api/v1/tasks/bulk/status` - Bulk status updates
- `DELETE /api/v1/tasks/bulk` - Bulk delete

### 2. Authentication API Tests

**File**: `authApi.integration.test.ts`

Tests authentication endpoints:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh-token` - Token refresh
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/check-password-strength` - Password validation

### 3. Demo/Pattern Tests

**File**: `simple.integration.test.ts`

Demonstrates test patterns without external dependencies:
- CRUD operations simulation
- Authentication patterns
- Error handling
- Performance testing patterns
- Test utilities

## Test Utilities

### IntegrationTestSetup Class

Provides utilities for integration test setup:

```typescript
import { IntegrationTestSetup, TestContext } from '../utils/integrationTestSetup';

// Setup test environment
const testContext = await IntegrationTestSetup.setup();

// Create test users with authentication
const adminUser = testContext.adminUser;
const regularUser = testContext.regularUser;

// Create test tasks
const tasks = await IntegrationTestSetup.createTestTasks(userId, taskDataArray);

// Cleanup
await testContext.cleanup();
```

### Helper Functions

```typescript
import { 
  createAuthHeaders, 
  expectApiSuccess, 
  expectApiError,
  createDateRange 
} from '../utils/integrationTestSetup';

// Create authentication headers
const headers = createAuthHeaders(authToken);

// Validate API responses
expectApiSuccess(response);
expectApiError(response, 'validation error');

// Create test dates
const [tomorrow, nextWeek] = createDateRange([1, 7]);
```

### Custom Matchers

```typescript
// Check API response structure
expect(response.body).toBeApiSuccess();
expect(response.body).toBeApiError();

// Check response time
expect(responseTime).toBeWithinResponseTime(1000);

// Validate task arrays
expect(tasks).toContainValidTasks();
```

## Database Setup

### Test Database Configuration

1. **Environment Variables** (`.env.test`):
```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskflow_test
DB_USER=test_user
DB_PASS=test_password
JWT_SECRET=test-jwt-secret
JWT_REFRESH_SECRET=test-jwt-refresh-secret
```

2. **Database Initialization**:
```bash
# Setup test database
npm run db:test

# Run migrations
npm run db:migrate

# Validate schema
npm run db:validate
```

### Data Management

- **Before Each Test**: Clean slate with fresh test data
- **After Each Test**: Cleanup created test data
- **Test Isolation**: Each test creates and cleans its own data
- **Transactions**: Tests run in isolation to prevent interference

## Authentication Setup

### Test Users

Integration tests automatically create:
- **Admin User**: Full permissions for admin endpoint testing
- **Regular User**: Standard user permissions

### Token Management

- JWT tokens generated automatically
- Refresh tokens handled for token renewal tests
- Token expiration and validation tested

## Error Handling

### Database Errors
- Connection failures
- Query errors
- Transaction rollbacks

### Validation Errors
- Request validation
- Authentication failures
- Authorization denials

### HTTP Errors
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

## Performance Testing

### Concurrent Requests
```typescript
it('should handle concurrent task creation', async () => {
  const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
    request(app)
      .post('/api/v1/tasks')
      .set(createAuthHeaders(authToken))
      .send({ title: `Concurrent Task ${i}` })
  );

  const responses = await Promise.all(concurrentRequests);
  // Validate all responses
});
```

### Load Testing
- Large dataset pagination
- Bulk operations
- Memory usage monitoring

## Best Practices

### Test Structure
1. **Arrange**: Setup test data and environment
2. **Act**: Execute the operation being tested
3. **Assert**: Verify the results and side effects
4. **Cleanup**: Remove test data and reset state

### Data Management
- Use unique identifiers for test data
- Clean up after each test
- Use transactions when possible
- Avoid hardcoded IDs or timestamps

### Authentication
- Generate fresh tokens for each test suite
- Test both valid and invalid tokens
- Verify permission-based access

### Error Cases
- Test both happy path and error scenarios
- Verify proper error messages and status codes
- Test edge cases and boundary conditions

## Common Issues and Solutions

### Database Connection Issues
```
Error: database "taskflow_test" does not exist
```
**Solution**: Create test database using `npm run db:test`

### TypeScript Compilation Errors
```
Property 'methodName' does not exist on type
```
**Solution**: Update service interfaces or use proper mocking

### Jest Configuration Warnings
```
Define `ts-jest` config under `globals` is deprecated
```
**Solution**: Update Jest configuration to use newer syntax

### Port Conflicts
```
EADDRINUSE: address already in use
```
**Solution**: Use different ports for test environment or ensure cleanup

## Extending Tests

### Adding New Endpoint Tests

1. **Create test file**: `newFeature.integration.test.ts`
2. **Import utilities**: Use `IntegrationTestSetup`
3. **Setup test data**: Create relevant test data
4. **Write test cases**: Cover all scenarios
5. **Add cleanup**: Ensure proper cleanup

### Adding Custom Matchers

```typescript
expect.extend({
  toHaveValidStructure(received) {
    // Custom validation logic
    return {
      message: () => `Expected valid structure`,
      pass: isValid
    };
  }
});
```

### Performance Benchmarks

```typescript
import { integrationTestUtils } from '../setup.integration';

const { result, duration } = await integrationTestUtils.measureTime(async () => {
  return await request(app).get('/api/v1/tasks');
});

expect(duration).toBeLessThan(500); // 500ms threshold
```

## Continuous Integration

### CI Pipeline Integration

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    npm run db:test
    npm run test:integration:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/integration/lcov.info
```

### Test Reporting

- Jest generates detailed test reports
- Coverage reports available in `coverage/integration/`
- Custom test runner provides summary statistics

## Troubleshooting

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm run test:integration

# Run specific test with verbose output
npx jest src/tests/integration/simple.integration.test.ts --verbose --no-cache
```

### Logging
- Integration test setup includes logging
- Database operations are logged
- HTTP requests/responses can be logged

### Memory Leaks
- Use `--detectOpenHandles` flag
- Ensure all database connections are closed
- Clear timers and intervals in cleanup

---

For more information about the Task Management API, see the main [README.md](../../../README.md) file.
