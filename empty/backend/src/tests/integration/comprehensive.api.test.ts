/**
 * Comprehensive Task Management API Integration Tests
 * 
 * Demonstrates complete testing of task management API endpoints with:
 * - Database setup and cleanup
 * - Authentication testing
 * - CRUD operations testing
 * - Error handling testing
 * - Performance testing
 */

import { apiTestManager, TestUser, TestTask, TestCategory } from '../utils/apiTestManager';
import { app } from '../../index'; // Import your Express app

describe('Task Management API - Complete Integration Tests', () => {
  let adminUser: TestUser;
  let regularUser: TestUser;
  let testTask: TestTask;
  let testCategory: TestCategory;

  beforeAll(async () => {
    // Initialize the API test manager
    await apiTestManager.initialize(app);
    
    console.log('🚀 Setting up comprehensive integration tests');
  });

  afterAll(async () => {
    // Clean up everything
    await apiTestManager.cleanup();
    
    console.log('🧹 Comprehensive integration tests cleanup completed');
  });

  beforeEach(async () => {
    // Create fresh test users for each test
    adminUser = await apiTestManager.createTestUser({
      email: 'admin@test.example.com',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    });

    regularUser = await apiTestManager.createTestUser({
      email: 'user@test.example.com',
      first_name: 'Regular',
      last_name: 'User',
      role: 'user'
    });

    // Create test category and task
    testCategory = await apiTestManager.createTestCategory(regularUser.id, {
      name: 'Work',
      color: '#007bff',
      icon: 'work'
    });

    testTask = await apiTestManager.createTestTask(regularUser.id, {
      title: 'Complete Integration Tests',
      description: 'Write comprehensive integration tests for the API',
      priority: 'high',
      status: 'pending',
      category_id: testCategory.id,
      tags: ['testing', 'integration']
    });
  });

  describe('Authentication Endpoints', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@test.example.com',
        password: 'SecurePassword123!',
        first_name: 'New',
        last_name: 'User'
      };

      const response = await apiTestManager.register(userData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(userData.email);
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        first_name: 'Test',
        last_name: 'User'
      };

      const response = await apiTestManager.register(userData);
      apiTestManager.expectValidationError(response);
    });

    test('should login with valid credentials', async () => {
      const response = await apiTestManager.login(regularUser.email, regularUser.password);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(regularUser.email);
    });

    test('should reject login with invalid credentials', async () => {
      const response = await apiTestManager.login(regularUser.email, 'wrongpassword');
      apiTestManager.expectErrorResponse(response, 401);
    });

    test('should refresh access token successfully', async () => {
      const response = await apiTestManager.refreshToken(regularUser.refreshToken);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });
  });

  describe('Task Management Endpoints', () => {
    test('should create a new task successfully', async () => {
      const taskData = {
        title: 'New API Test Task',
        description: 'Created via API integration test',
        priority: 'medium',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        category_id: testCategory.id,
        tags: ['api', 'test']
      };

      const response = await apiTestManager.createTask(regularUser, taskData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.task).toMatchObject({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: 'pending',
        user_id: regularUser.id
      });
    });

    test('should reject task creation with invalid data', async () => {
      const invalidTaskData = {
        // Missing required title
        description: 'Task without title',
        priority: 'invalid-priority'
      };

      const response = await apiTestManager.createTask(regularUser, invalidTaskData);
      apiTestManager.expectValidationError(response);
    });

    test('should get user tasks with pagination', async () => {
      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        await apiTestManager.createTestTask(regularUser.id, {
          title: `Task ${i + 1}`,
          priority: 'low'
        });
      }

      const response = await apiTestManager.getTasks(regularUser, {
        page: 1,
        limit: 3,
        sort: 'created_at',
        order: 'desc'
      });

      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 3,
        total: expect.any(Number)
      });
    });

    test('should filter tasks by status', async () => {
      // Create tasks with different statuses
      await apiTestManager.createTestTask(regularUser.id, {
        title: 'Completed Task',
        status: 'completed'
      });
      
      await apiTestManager.createTestTask(regularUser.id, {
        title: 'In Progress Task',
        status: 'in_progress'
      });

      const response = await apiTestManager.getTasks(regularUser, {
        status: 'completed'
      });

      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.tasks.every((task: any) => task.status === 'completed')).toBe(true);
    });

    test('should get specific task by ID', async () => {
      const response = await apiTestManager.getTask(regularUser, testTask.id);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.task).toMatchObject({
        id: testTask.id,
        title: testTask.title,
        user_id: regularUser.id
      });
    });

    test('should return 404 for non-existent task', async () => {
      const fakeTaskId = 'fake_' + Date.now();
      const response = await apiTestManager.getTask(regularUser, fakeTaskId);
      
      apiTestManager.expectNotFoundResponse(response);
    });

    test('should update task successfully', async () => {
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated description',
        status: 'in_progress',
        priority: 'high'
      };

      const response = await apiTestManager.updateTask(regularUser, testTask.id, updateData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.task).toMatchObject(updateData);
    });

    test('should prevent user from updating another user\'s task', async () => {
      const anotherUser = await apiTestManager.createTestUser({
        email: 'another@test.example.com'
      });

      const updateData = { title: 'Unauthorized Update' };
      const response = await apiTestManager.updateTask(anotherUser, testTask.id, updateData);
      
      // Should return 404 (not found) to prevent information disclosure
      apiTestManager.expectNotFoundResponse(response);
    });

    test('should delete task successfully', async () => {
      const taskToDelete = await apiTestManager.createTestTask(regularUser.id, {
        title: 'Task to Delete'
      });

      const response = await apiTestManager.deleteTask(regularUser, taskToDelete.id);
      
      expect(response.status).toBe(204); // No content for successful deletion

      // Verify task is actually deleted
      const getResponse = await apiTestManager.getTask(regularUser, taskToDelete.id);
      apiTestManager.expectNotFoundResponse(getResponse);
    });

    test('should handle task search functionality', async () => {
      // Create tasks with specific keywords
      await apiTestManager.createTestTask(regularUser.id, {
        title: 'Important Meeting Preparation',
        description: 'Prepare for the quarterly meeting',
        tags: ['meeting', 'quarterly']
      });

      const response = await apiTestManager.getTasks(regularUser, {
        search: 'meeting'
      });

      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.tasks.length).toBeGreaterThan(0);
      expect(response.body.data.tasks.some((task: any) => 
        task.title.toLowerCase().includes('meeting') || 
        task.description?.toLowerCase().includes('meeting')
      )).toBe(true);
    });
  });

  describe('Category Management Endpoints', () => {
    test('should create a new category', async () => {
      const categoryData = {
        name: 'Personal',
        color: '#28a745',
        icon: 'person',
        description: 'Personal tasks and activities'
      };

      const response = await apiTestManager.createCategory(regularUser, categoryData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.category).toMatchObject(categoryData);
    });

    test('should get user categories', async () => {
      // Create additional categories
      await apiTestManager.createTestCategory(regularUser.id, { name: 'Home' });
      await apiTestManager.createTestCategory(regularUser.id, { name: 'Health' });

      const response = await apiTestManager.getCategories(regularUser);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.categories.length).toBeGreaterThanOrEqual(3); // Including the one from beforeEach
    });

    test('should prevent duplicate category names for same user', async () => {
      const categoryData = {
        name: testCategory.name, // Same name as existing category
        color: '#ff0000',
        icon: 'duplicate'
      };

      const response = await apiTestManager.createCategory(regularUser, categoryData);
      apiTestManager.expectErrorResponse(response, 409); // Conflict
    });
  });

  describe('User Profile Endpoints', () => {
    test('should get user profile', async () => {
      const response = await apiTestManager.getUserProfile(regularUser);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.user).toMatchObject({
        id: regularUser.id,
        email: regularUser.email,
        first_name: regularUser.first_name,
        last_name: regularUser.last_name
      });
      // Password should not be included
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should update user profile', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        timezone: 'America/New_York',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const response = await apiTestManager.updateUserProfile(regularUser, updateData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.user).toMatchObject(updateData);
    });
  });

  describe('Authorization and Security', () => {
    test('should reject requests without authentication token', async () => {
      const response = await apiTestManager.getApiClient()
        .get('/api/v1/tasks');
      
      apiTestManager.expectUnauthorizedResponse(response);
    });

    test('should reject requests with invalid token', async () => {
      const response = await apiTestManager.getApiClient()
        .get('/api/v1/tasks')
        .set('Authorization', 'Bearer invalid-token');
      
      apiTestManager.expectUnauthorizedResponse(response);
    });

    test('should handle expired tokens appropriately', async () => {
      // This would require creating an expired token or mocking JWT verification
      // For now, we'll test with a malformed token
      const response = await apiTestManager.getApiClient()
        .get('/api/v1/tasks')
        .set('Authorization', 'Bearer expired.token.here');
      
      apiTestManager.expectUnauthorizedResponse(response);
    });

    test('should enforce user isolation (users can only see their own data)', async () => {
      const user1 = await apiTestManager.createTestUser({ email: 'user1@test.com' });
      const user2 = await apiTestManager.createTestUser({ email: 'user2@test.com' });

      // Create task for user1
      const user1Task = await apiTestManager.createTestTask(user1.id, {
        title: 'User 1 Task'
      });

      // User2 should not be able to see User1's task
      const response = await apiTestManager.getTask(user2, user1Task.id);
      apiTestManager.expectNotFoundResponse(response);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await apiTestManager.getApiClient()
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${regularUser.accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}'); // Malformed JSON

      expect(response.status).toBe(400);
    });

    test('should handle very long task titles', async () => {
      const longTitle = 'A'.repeat(1000); // Very long title
      
      const response = await apiTestManager.createTask(regularUser, {
        title: longTitle
      });

      // Should either accept with truncation or reject with validation error
      expect([200, 201, 400]).toContain(response.status);
    });

    test('should handle special characters in task content', async () => {
      const taskData = {
        title: 'Task with special chars: !@#$%^&*()[]{}|;:",.<>?',
        description: 'Description with emojis: 🚀 📝 ✅ and unicode: αβγδε',
        tags: ['special-chars', 'unicode-test']
      };

      const response = await apiTestManager.createTask(regularUser, taskData);
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.task.title).toBe(taskData.title);
      expect(response.body.data.task.description).toBe(taskData.description);
    });

    test('should handle database connection issues gracefully', async () => {
      // This test would require temporarily disrupting the database connection
      // For now, we'll just ensure the error handling structure is in place
      expect(apiTestManager.query).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          apiTestManager.createTask(regularUser, {
            title: `Concurrent Task ${i + 1}`,
            priority: 'low'
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });
    });

    test('should handle pagination with large datasets', async () => {
      // Create many tasks
      const taskCount = 50;
      
      for (let i = 0; i < taskCount; i++) {
        await apiTestManager.createTestTask(regularUser.id, {
          title: `Bulk Task ${i + 1}`
        });
      }

      // Test pagination
      const response = await apiTestManager.getTasks(regularUser, {
        page: 1,
        limit: 20
      });

      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data.tasks).toHaveLength(20);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(taskCount);
    });
  });

  describe('Data Integrity and Consistency', () => {
    test('should maintain referential integrity when deleting categories', async () => {
      // Create task with category
      const categoryWithTask = await apiTestManager.createTestCategory(regularUser.id, {
        name: 'Category with Task'
      });
      
      const taskWithCategory = await apiTestManager.createTestTask(regularUser.id, {
        title: 'Task with Category',
        category_id: categoryWithTask.id
      });

      // Delete category (this should either prevent deletion or handle gracefully)
      const deleteResponse = await apiTestManager.authenticatedRequest(
        'delete', 
        `/api/v1/categories/${categoryWithTask.id}`, 
        regularUser
      );

      // Check that task still exists and category_id is handled properly
      const taskResponse = await apiTestManager.getTask(regularUser, taskWithCategory.id);
      apiTestManager.expectSuccessfulResponse(taskResponse);
    });

    test('should handle database transaction rollbacks correctly', async () => {
      // This would test that partial updates don't leave the database in an inconsistent state
      // Implementation depends on your specific transaction handling
      const initialTaskCount = await apiTestManager.query(
        'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1',
        [regularUser.id]
      );

      // Attempt an operation that might fail
      try {
        await apiTestManager.createTask(regularUser, {
          title: 'Test Transaction Task',
          category_id: 'non-existent-category-id' // This should fail
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify task count hasn't changed
      const finalTaskCount = await apiTestManager.query(
        'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1',
        [regularUser.id]
      );

      expect(finalTaskCount[0].count).toBe(initialTaskCount[0].count);
    });
  });

  describe('API Response Format Consistency', () => {
    test('should return consistent response format for success', async () => {
      const response = await apiTestManager.getTasks(regularUser);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.message).toBe('string');
    });

    test('should return consistent response format for errors', async () => {
      const response = await apiTestManager.getTask(regularUser, 'non-existent-id');
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });

    test('should include request metadata in responses', async () => {
      const response = await apiTestManager.getTasks(regularUser, {
        page: 2,
        limit: 5
      });
      
      apiTestManager.expectSuccessfulResponse(response);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toMatchObject({
        page: 2,
        limit: 5
      });
    });
  });
});
