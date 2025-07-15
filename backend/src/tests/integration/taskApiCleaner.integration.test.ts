/**
 * Task Management API Integration Tests
 * 
 * Comprehensive integration tests for task management endpoints using supertest.
 * Uses the IntegrationTestSetup utility for database setup, authentication, and cleanup.
 */

import request from 'supertest';
import { app } from '../../index';
import { 
  IntegrationTestSetup, 
  TestContext, 
  createAuthHeaders, 
  expectApiSuccess, 
  expectApiError,
  createDateRange 
} from '../utils/integrationTestSetup';
import { TaskPriority, TaskStatus } from '../../models/task';

describe('Task Management API Integration Tests', () => {
  let testContext: TestContext;
  let createdTaskIds: string[] = [];

  beforeAll(async () => {
    testContext = await IntegrationTestSetup.setup();
  });

  afterAll(async () => {
    await testContext.cleanup();
  });

  beforeEach(async () => {
    createdTaskIds = [];
  });

  afterEach(async () => {
    if (createdTaskIds.length > 0) {
      await IntegrationTestSetup.deleteTestTasks(createdTaskIds);
    }
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'Integration Test Task',
        description: 'Task created during integration testing',
        priority: 'high' as TaskPriority,
        due_date: new Date(Date.now() + 86400000) // 1 day from now
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(taskData)
        .expect(201);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.description).toBe(taskData.description);
      expect(response.body.data.priority).toBe(taskData.priority);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.user_id).toBe(testContext.regularUser.user.id);

      createdTaskIds.push(response.body.data.id);
    });

    it('should return 400 for invalid task data', async () => {
      const invalidTaskData = {
        // Missing required title field
        description: 'Task without title',
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(invalidTaskData)
        .expect(400);

      expectApiError(response, 'validation');
    });

    it('should return 401 without authentication token', async () => {
      const taskData = {
        title: 'Unauthorized Task'
      };

      await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(401);
    });

    it('should return 401 with invalid authentication token', async () => {
      const taskData = {
        title: 'Invalid Token Task'
      };

      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', 'Bearer invalid-token')
        .send(taskData)
        .expect(401);
    });
  });

  describe('GET /api/v1/tasks', () => {
    beforeEach(async () => {
      // Create test tasks
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Task 2', priority: 'medium' as TaskPriority, status: 'in_progress' as TaskStatus },
        { title: 'Task 3', priority: 'low' as TaskPriority, status: 'completed' as TaskStatus }
      ]);
      createdTaskIds = tasks.map(task => task.id);
    });

    it('should return all user tasks', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('tasks');
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(3);
      
      // Verify all tasks belong to the test user
      response.body.data.tasks.forEach((task: any) => {
        expect(task.user_id).toBe(testContext.regularUser.user.id);
      });
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?status=completed')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      response.body.data.tasks.forEach((task: any) => {
        expect(task.status).toBe('completed');
      });
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?priority=high')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      response.body.data.tasks.forEach((task: any) => {
        expect(task.priority).toBe('high');
      });
    });

    it('should paginate tasks correctly', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?page=1&limit=2')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.tasks.length).toBeLessThanOrEqual(2);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/v1/tasks')
        .expect(401);
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Single Task Test', priority: 'medium' as TaskPriority }
      ]);
      testTask = tasks[0];
      createdTaskIds.push(testTask.id);
    });

    it('should return a specific task by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.id).toBe(testTask.id);
      expect(response.body.data.title).toBe(testTask.title);
      expect(response.body.data.user_id).toBe(testContext.regularUser.user.id);
    });

    it('should return 404 for non-existent task', async () => {
      const nonExistentId = 'non-existent-id';
      
      await request(app)
        .get(`/api/v1/tasks/${nonExistentId}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(404);
    });
  });

  describe('PUT /api/v1/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Task to Update', priority: 'low' as TaskPriority }
      ]);
      testTask = tasks[0];
      createdTaskIds.push(testTask.id);
    });

    it('should update a task with valid data', async () => {
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated description',
        priority: 'high' as TaskPriority,
        status: 'in_progress' as TaskStatus
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${testTask.id}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(updateData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.priority).toBe(updateData.priority);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidUpdateData = {
        priority: 'invalid_priority',
        status: 'invalid_status'
      };

      await request(app)
        .put(`/api/v1/tasks/${testTask.id}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(invalidUpdateData)
        .expect(400);
    });

    it('should return 404 for non-existent task', async () => {
      const updateData = { title: 'Updated Title' };
      
      await request(app)
        .put('/api/v1/tasks/non-existent-id')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Task to Delete', priority: 'medium' as TaskPriority }
      ]);
      testTask = tasks[0];
      // Don't add to createdTaskIds since we're testing deletion
    });

    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`/api/v1/tasks/${testTask.id}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);

      // Verify task is deleted
      await request(app)
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(404);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .delete('/api/v1/tasks/non-existent-id')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id/complete', () => {
    let testTask: any;

    beforeEach(async () => {
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Task to Complete', priority: 'high' as TaskPriority, status: 'in_progress' as TaskStatus }
      ]);
      testTask = tasks[0];
      createdTaskIds.push(testTask.id);
    });

    it('should mark a task as completed', async () => {
      const response = await request(app)
        .patch(`/api/v1/tasks/${testTask.id}/complete`)
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.completed_at).toBeTruthy();
      expect(response.body.data.completed_by).toBe(testContext.regularUser.user.id);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .patch('/api/v1/tasks/non-existent-id/complete')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(404);
    });
  });

  describe('GET /api/v1/tasks/stats', () => {
    beforeEach(async () => {
      // Create diverse test tasks for statistics
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Pending Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Pending Task 2', priority: 'medium' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'In Progress Task', priority: 'high' as TaskPriority, status: 'in_progress' as TaskStatus },
        { title: 'Completed Task 1', priority: 'low' as TaskPriority, status: 'completed' as TaskStatus },
        { title: 'Completed Task 2', priority: 'medium' as TaskPriority, status: 'completed' as TaskStatus }
      ]);
      createdTaskIds = tasks.map(task => task.id);
    });

    it('should return task statistics', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/stats')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('byPriority');
      expect(response.body.data.byStatus).toHaveProperty('pending');
      expect(response.body.data.byStatus).toHaveProperty('in_progress');
      expect(response.body.data.byStatus).toHaveProperty('completed');
    });
  });

  describe('GET /api/v1/tasks/due-soon', () => {
    beforeEach(async () => {
      // Create tasks with different due dates
      const [tomorrow, nextWeek] = createDateRange([1, 7]);
      
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { 
          title: 'Due Tomorrow', 
          priority: 'high' as TaskPriority, 
          due_date: tomorrow 
        },
        { 
          title: 'Due Next Week', 
          priority: 'medium' as TaskPriority, 
          due_date: nextWeek 
        }
      ]);
      createdTaskIds = tasks.map(task => task.id);
    });

    it('should return tasks due soon', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/due-soon?days=7')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      const tasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'Bulk Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Bulk Task 2', priority: 'medium' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Bulk Task 3', priority: 'low' as TaskPriority, status: 'pending' as TaskStatus }
      ]);
      createdTaskIds = tasks.map(task => task.id);
    });

    it('should update multiple task statuses', async () => {
      const bulkUpdateData = {
        taskIds: createdTaskIds,
        status: 'completed' as TaskStatus
      };

      const response = await request(app)
        .patch('/api/v1/tasks/bulk/status')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(bulkUpdateData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.updated).toBe(createdTaskIds.length);
    });

    it('should delete multiple tasks', async () => {
      const bulkDeleteData = {
        taskIds: createdTaskIds
      };

      const response = await request(app)
        .delete('/api/v1/tasks/bulk')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .send(bulkDeleteData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.deleted).toBe(createdTaskIds.length);

      // Clear createdTaskIds since tasks are deleted
      createdTaskIds = [];
    });
  });

  describe('Admin Operations', () => {
    it('should allow admin to view all tasks', async () => {
      // Create tasks for regular user
      const userTasks = await IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [
        { title: 'User Task', priority: 'medium' as TaskPriority }
      ]);
      
      // Create tasks for admin user
      const adminTasks = await IntegrationTestSetup.createTestTasks(testContext.adminUser.user.id, [
        { title: 'Admin Task', priority: 'high' as TaskPriority }
      ]);
      
      createdTaskIds = [...userTasks.map(t => t.id), ...adminTasks.map(t => t.id)];

      const response = await request(app)
        .get('/api/v1/admin/tasks')
        .set(createAuthHeaders(testContext.adminUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('should deny regular user access to admin endpoints', async () => {
      await request(app)
        .get('/api/v1/admin/tasks')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(403);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent task creation', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/v1/tasks')
          .set(createAuthHeaders(testContext.regularUser.authToken))
          .send({
            title: `Concurrent Task ${i}`,
            priority: 'medium' as TaskPriority
          })
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expectApiSuccess(response);
        createdTaskIds.push(response.body.data.id);
      });

      expect(responses.length).toBe(10);
    });

    it('should handle pagination with large datasets', async () => {
      // Create many tasks
      const taskPromises = Array.from({ length: 50 }, (_, i) => 
        IntegrationTestSetup.createTestTasks(testContext.regularUser.user.id, [{
          title: `Large Dataset Task ${i}`,
          priority: 'low' as TaskPriority
        }])
      );

      const taskArrays = await Promise.all(taskPromises);
      createdTaskIds = taskArrays.flat().map(task => task.id);

      const response = await request(app)
        .get('/api/v1/tasks?page=1&limit=20')
        .set(createAuthHeaders(testContext.regularUser.authToken))
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data.tasks.length).toBe(20);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(50);
    });
  });
});
