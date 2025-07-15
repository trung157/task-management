/**
 * Simple API Test Utilities Demo
 * 
 * Demonstrates the usage of API test utilities and validates
 * that everything works correctly.
 */

import { apiTestManager, TestUser } from '../utils/apiTestManager';

describe('API Test Utilities Demo', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    console.log('🚀 Initializing API test manager...');
    
    // Initialize without express app for now (database-only tests)
    await apiTestManager.initialize();
    
    console.log('✅ API test manager initialized');
  });

  afterAll(async () => {
    await apiTestManager.cleanup();
    console.log('🧹 API test manager cleanup completed');
  });

  beforeEach(async () => {
    testUser = await apiTestManager.createTestUser({
      email: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.example.com`,
      first_name: 'Demo',
      last_name: 'User',
      role: 'user'
    });
  });

  describe('Database Test Utilities', () => {
    test('should create test user with authentication tokens', async () => {
      expect(testUser).toBeDefined();
      expect(testUser.id).toBeDefined();
      expect(testUser.email).toMatch(/^demo-\d+-[a-z0-9]+@test\.example\.com$/);
      expect(testUser.accessToken).toBeDefined();
      expect(testUser.refreshToken).toBeDefined();
      
      // Verify user exists in database
      const dbUser = await apiTestManager.getUserById(testUser.id);
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe(testUser.email);
      expect(dbUser.first_name).toBe('Demo');
      expect(dbUser.last_name).toBe('User');
    });

    test('should create test task with all properties', async () => {
      const task = await apiTestManager.createTestTask(testUser.id, {
        title: 'Demo Task',
        description: 'This is a demo task for testing',
        priority: 'high',
        status: 'pending',
        tags: ['demo', 'test']
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.user_id).toBe(testUser.id);
      expect(task.title).toBe('Demo Task');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
      expect(task.tags).toEqual(['demo', 'test']);

      // Verify task exists in database
      const dbTask = await apiTestManager.getTaskById(task.id);
      expect(dbTask).toBeDefined();
      expect(dbTask.title).toBe('Demo Task');
      expect(dbTask.user_id).toBe(testUser.id);
    });

    test('should create test category with properties', async () => {
      const category = await apiTestManager.createTestCategory(testUser.id, {
        name: 'Demo Category',
        color: '#ff6b6b',
        icon: 'demo',
        description: 'This is a demo category'
      });

      expect(category).toBeDefined();
      expect(category.id).toBeDefined();
      expect(category.user_id).toBe(testUser.id);
      expect(category.name).toBe('Demo Category');
      expect(category.color).toBe('#ff6b6b');
      expect(category.icon).toBe('demo');

      // Verify category exists in database
      const dbCategory = await apiTestManager.getCategoryById(category.id);
      expect(dbCategory).toBeDefined();
      expect(dbCategory.name).toBe('Demo Category');
      expect(dbCategory.user_id).toBe(testUser.id);
    });

    test('should execute custom database queries', async () => {
      const result = await apiTestManager.query('SELECT NOW() as current_time');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('current_time');
    });

    test('should generate unique test IDs', async () => {
      const id1 = apiTestManager.generateTestId('demo');
      const id2 = apiTestManager.generateTestId('demo');
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      // UUIDs should match UUID v4 pattern
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Test Data Management', () => {
    test('should track created test data', async () => {
      const task1 = await apiTestManager.createTestTask(testUser.id, { title: 'Task 1' });
      const task2 = await apiTestManager.createTestTask(testUser.id, { title: 'Task 2' });
      const category1 = await apiTestManager.createTestCategory(testUser.id, { name: 'Category 1' });

      const testUsers = apiTestManager.getTestUsers();
      const testTasks = apiTestManager.getTestTasks();
      const testCategories = apiTestManager.getTestCategories();

      expect(testUsers.length).toBeGreaterThanOrEqual(1);
      expect(testTasks.length).toBeGreaterThanOrEqual(2);
      expect(testCategories.length).toBeGreaterThanOrEqual(1);

      expect(testTasks.some(t => t.title === 'Task 1')).toBe(true);
      expect(testTasks.some(t => t.title === 'Task 2')).toBe(true);
      expect(testCategories.some(c => c.name === 'Category 1')).toBe(true);
    });

    test('should retrieve specific test user', async () => {
      const retrievedUser = apiTestManager.getTestUser(testUser.id);
      
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.id).toBe(testUser.id);
      expect(retrievedUser?.email).toBe(testUser.email);
    });
  });

  describe('Data Isolation and Cleanup', () => {
    test('should isolate test data between different test users', async () => {
      const user1 = await apiTestManager.createTestUser({ email: 'user1@test.com' });
      const user2 = await apiTestManager.createTestUser({ email: 'user2@test.com' });

      const task1 = await apiTestManager.createTestTask(user1.id, { title: 'User 1 Task' });
      const task2 = await apiTestManager.createTestTask(user2.id, { title: 'User 2 Task' });

      // Verify tasks belong to correct users
      const dbTask1 = await apiTestManager.getTaskById(task1.id);
      const dbTask2 = await apiTestManager.getTaskById(task2.id);

      expect(dbTask1.user_id).toBe(user1.id);
      expect(dbTask2.user_id).toBe(user2.id);
      expect(dbTask1.user_id).not.toBe(dbTask2.user_id);
    });

    test('should clean up test data automatically', async () => {
      // Create some test data
      const tempUser = await apiTestManager.createTestUser({ email: 'temp@test.com' });
      const tempTask = await apiTestManager.createTestTask(tempUser.id, { title: 'Temp Task' });
      
      // Verify data exists
      let dbUser = await apiTestManager.getUserById(tempUser.id);
      let dbTask = await apiTestManager.getTaskById(tempTask.id);
      
      expect(dbUser).toBeDefined();
      expect(dbTask).toBeDefined();

      // Note: Actual cleanup happens in afterAll/afterEach hooks
      // This test just verifies the data tracking works
      expect(apiTestManager.getTestUsers().length).toBeGreaterThan(0);
      expect(apiTestManager.getTestTasks().length).toBeGreaterThan(0);
    });
  });

  describe('Assertion Helpers Demo', () => {
    test('should provide useful assertion helpers', () => {
      // Mock responses for testing assertion helpers
      const mockSuccessResponse = {
        status: 200,
        body: {
          success: true,
          message: 'Operation successful',
          data: { id: '123', name: 'Test' }
        }
      } as any;

      const mockErrorResponse = {
        status: 400,
        body: {
          success: false,
          message: 'Validation failed',
          errors: ['Field is required']
        }
      } as any;

      const mockNotFoundResponse = {
        status: 404,
        body: {
          success: false,
          message: 'Resource not found'
        }
      } as any;

      // Test assertion helpers
      expect(() => apiTestManager.expectSuccessfulResponse(mockSuccessResponse)).not.toThrow();
      expect(() => apiTestManager.expectErrorResponse(mockErrorResponse, 400)).not.toThrow();
      expect(() => apiTestManager.expectValidationError(mockErrorResponse)).not.toThrow();
      expect(() => apiTestManager.expectNotFoundResponse(mockNotFoundResponse)).not.toThrow();
    });
  });

  describe('Configuration and Environment', () => {
    test('should load test configuration correctly', async () => {
      // Test environment variables should be loaded
      expect(process.env.NODE_ENV).toBeDefined();
      expect(process.env.DB_NAME).toBe('task_management_test_db');
      expect(process.env.DB_HOST).toBeDefined();
      expect(process.env.DB_PORT).toBeDefined();
      expect(process.env.JWT_SECRET).toBeDefined();
    });

    test('should use test database configuration', async () => {
      const result = await apiTestManager.query(`
        SELECT current_database() as db_name, 
               current_user as db_user
      `);
      
      expect(result[0].db_name).toBe('task_management_test_db');
      expect(result[0].db_user).toBe('postgres');
    });
  });
});
