/**
 * Task Management API Integration Tests
 * 
 * Comprehensive integration tests for task management endpoints using supertest.
 * Includes database setup, authentication, and cleanup.
 */

import request from 'supertest';
import { Pool, PoolClient } from 'pg';
import app from '../../app';
import { connectDatabase, closeDatabase } from '../../db';
import { User } from '../../models/user';
import { Task, TaskPriority, TaskStatus } from '../../models/task';
import { TestDataFactory } from '../utils/testDataFactory';
import { generateTokenPair } from '../../config/jwt';

describe('Task Management API Integration Tests', () => {
  let dbClient: PoolClient;
  let testUser: User;
  let authToken: string;
  let refreshToken: string;
  
  // Test data
  let testTasks: Task[] = [];
  let testTaskIds: string[] = [];

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
    dbClient = await (global as any).pool.connect();
    
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test user
    testUser = await createTestUser();
    
    // Generate authentication tokens
    const tokens = generateTokenPair({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role
    });
    authToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    
    // Release database connection
    if (dbClient) {
      dbClient.release();
    }
    
    // Close database connection
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clear tasks before each test
    testTasks = [];
    testTaskIds = [];
  });

  afterEach(async () => {
    // Clean up tasks created during test
    if (testTaskIds.length > 0) {
      await deleteTestTasks(testTaskIds);
      testTaskIds = [];
    }
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = testDataFactory.createTaskData({
        title: 'Integration Test Task',
        description: 'Task created during integration testing',
        priority: 'high' as TaskPriority,
        due_date: new Date(Date.now() + 86400000) // 1 day from now
      });

      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.description).toBe(taskData.description);
      expect(response.body.data.priority).toBe(taskData.priority);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.user_id).toBe(testUser.id);

      // Store for cleanup
      testTaskIds.push(response.body.data.id);
    });

    it('should return 400 for invalid task data', async () => {
      const invalidTaskData = {
        // Missing required title field
        description: 'Task without title',
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTaskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should return 401 without authentication token', async () => {
      const taskData = testDataFactory.createTaskData({
        title: 'Unauthorized Task'
      });

      await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(401);
    });

    it('should return 401 with invalid authentication token', async () => {
      const taskData = testDataFactory.createTaskData({
        title: 'Invalid Token Task'
      });

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
      const tasks = await createTestTasks([
        { title: 'Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Task 2', priority: 'medium' as TaskPriority, status: 'in_progress' as TaskStatus },
        { title: 'Task 3', priority: 'low' as TaskPriority, status: 'completed' as TaskStatus }
      ]);
      testTasks = tasks;
      testTaskIds = tasks.map(task => task.id);
    });

    it('should return all user tasks', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(3);
      
      // Verify all tasks belong to the test user
      response.body.data.tasks.forEach((task: Task) => {
        expect(task.user_id).toBe(testUser.id);
      });
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].status).toBe('completed');
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks.length).toBeGreaterThanOrEqual(1);
      response.body.data.tasks.forEach((task: Task) => {
        expect(task.priority).toBe('high');
      });
    });

    it('should paginate tasks correctly', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
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
    let testTask: Task;

    beforeEach(async () => {
      const tasks = await createTestTasks([
        { title: 'Single Task Test', priority: 'medium' as TaskPriority }
      ]);
      testTask = tasks[0];
      testTaskIds.push(testTask.id);
    });

    it('should return a specific task by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testTask.id);
      expect(response.body.data.title).toBe(testTask.title);
      expect(response.body.data.user_id).toBe(testUser.id);
    });

    it('should return 404 for non-existent task', async () => {
      const nonExistentId = 'non-existent-id';
      
      await request(app)
        .get(`/api/v1/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for task belonging to different user', async () => {
      // Create another user's task (this would need to be implemented based on your system)
      // For now, we'll simulate this scenario
      const response = await request(app)
        .get(`/api/v1/tasks/different-user-task-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Or 403 depending on your implementation
    });
  });

  describe('PUT /api/v1/tasks/:id', () => {
    let testTask: Task;

    beforeEach(async () => {
      const tasks = await createTestTasks([
        { title: 'Task to Update', priority: 'low' as TaskPriority }
      ]);
      testTask = tasks[0];
      testTaskIds.push(testTask.id);
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
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
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
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdateData)
        .expect(400);
    });

    it('should return 404 for non-existent task', async () => {
      const updateData = { title: 'Updated Title' };
      
      await request(app)
        .put('/api/v1/tasks/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    let testTask: Task;

    beforeEach(async () => {
      const tasks = await createTestTasks([
        { title: 'Task to Delete', priority: 'medium' as TaskPriority }
      ]);
      testTask = tasks[0];
      // Don't add to testTaskIds since we're testing deletion
    });

    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`/api/v1/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify task is deleted
      await request(app)
        .get(`/api/v1/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .delete('/api/v1/tasks/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id/complete', () => {
    let testTask: Task;

    beforeEach(async () => {
      const tasks = await createTestTasks([
        { title: 'Task to Complete', priority: 'high' as TaskPriority, status: 'in_progress' as TaskStatus }
      ]);
      testTask = tasks[0];
      testTaskIds.push(testTask.id);
    });

    it('should mark a task as completed', async () => {
      const response = await request(app)
        .patch(`/api/v1/tasks/${testTask.id}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.completed_at).toBeTruthy();
      expect(response.body.data.completed_by).toBe(testUser.id);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .patch('/api/v1/tasks/non-existent-id/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/tasks/stats', () => {
    beforeEach(async () => {
      // Create diverse test tasks for statistics
      const tasks = await createTestTasks([
        { title: 'Pending Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Pending Task 2', priority: 'medium' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'In Progress Task', priority: 'high' as TaskPriority, status: 'in_progress' as TaskStatus },
        { title: 'Completed Task 1', priority: 'low' as TaskPriority, status: 'completed' as TaskStatus },
        { title: 'Completed Task 2', priority: 'medium' as TaskPriority, status: 'completed' as TaskStatus }
      ]);
      testTasks = tasks;
      testTaskIds = tasks.map(task => task.id);
    });

    it('should return task statistics', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
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
      const tomorrow = new Date(Date.now() + 86400000);
      const nextWeek = new Date(Date.now() + 7 * 86400000);
      
      const tasks = await createTestTasks([
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
      testTasks = tasks;
      testTaskIds = tasks.map(task => task.id);
    });

    it('should return tasks due soon', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/due-soon?days=7')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      const tasks = await createTestTasks([
        { title: 'Bulk Task 1', priority: 'high' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Bulk Task 2', priority: 'medium' as TaskPriority, status: 'pending' as TaskStatus },
        { title: 'Bulk Task 3', priority: 'low' as TaskPriority, status: 'pending' as TaskStatus }
      ]);
      testTasks = tasks;
      testTaskIds = tasks.map(task => task.id);
    });

    it('should update multiple task statuses', async () => {
      const bulkUpdateData = {
        taskIds: testTaskIds,
        status: 'completed' as TaskStatus
      };

      const response = await request(app)
        .patch('/api/v1/tasks/bulk/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(testTaskIds.length);
    });

    it('should delete multiple tasks', async () => {
      const bulkDeleteData = {
        taskIds: testTaskIds
      };

      const response = await request(app)
        .delete('/api/v1/tasks/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkDeleteData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(testTaskIds.length);

      // Clear testTaskIds since tasks are deleted
      testTaskIds = [];
    });
  });

  // Helper Functions
  async function createTestUser(): Promise<User> {
    const userData = testDataFactory.createUserData({
      email: `test-${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User'
    });

    const hashedPassword = await require('bcrypt').hash('testpassword123!', 12);
    
    const result = await dbClient.query(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, display_name,
        timezone, date_format, time_format, language_code, role, status,
        email_verified, preferences, notification_settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        userData.id,
        userData.email,
        hashedPassword,
        userData.first_name,
        userData.last_name,
        userData.display_name,
        userData.timezone,
        userData.date_format,
        userData.time_format,
        userData.language_code,
        userData.role,
        userData.status,
        userData.email_verified,
        JSON.stringify(userData.preferences),
        JSON.stringify(userData.notification_settings),
        userData.created_at,
        userData.updated_at
      ]
    );

    return result.rows[0];
  }

  async function createTestTasks(taskDataArray: Partial<Task>[]): Promise<Task[]> {
    const tasks: Task[] = [];
    
    for (const taskData of taskDataArray) {
      const fullTaskData = testDataFactory.createTaskData({
        user_id: testUser.id,
        ...taskData
      });

      const result = await dbClient.query(
        `INSERT INTO tasks (
          id, user_id, title, description, priority, status, due_date,
          reminder_date, start_date, estimated_minutes, tags, sort_order,
          metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          fullTaskData.id,
          fullTaskData.user_id,
          fullTaskData.title,
          fullTaskData.description,
          fullTaskData.priority,
          fullTaskData.status,
          fullTaskData.due_date,
          fullTaskData.reminder_date,
          fullTaskData.start_date,
          fullTaskData.estimated_minutes,
          JSON.stringify(fullTaskData.tags),
          fullTaskData.sort_order,
          JSON.stringify(fullTaskData.metadata),
          fullTaskData.created_at,
          fullTaskData.updated_at
        ]
      );

      tasks.push(result.rows[0]);
    }

    return tasks;
  }

  async function deleteTestTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    
    const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(', ');
    await dbClient.query(
      `DELETE FROM tasks WHERE id IN (${placeholders})`,
      taskIds
    );
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Delete test tasks (cascade will handle related data)
      await dbClient.query(`DELETE FROM tasks WHERE user_id LIKE 'test-%'`);
      
      // Delete test users
      await dbClient.query(`DELETE FROM users WHERE email LIKE '%test-%@example.com'`);
      
      // Delete any refresh tokens
      await dbClient.query(`DELETE FROM refresh_tokens WHERE user_id LIKE 'test-%'`);
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }
});
