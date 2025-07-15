import request from 'supertest';
import { app } from '../../index';
import { connectDatabase, closeDatabase } from '../../db';
import pool from '../../db';

describe('Task Management API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let testTaskId: string;
  let secondTaskId: string;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
    
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test user and authenticate
    const userData = {
      email: 'integration-test@example.com',
      password: 'TestPassword123!',
      first_name: 'Integration',
      last_name: 'Test',
      timezone: 'UTC',
      language_code: 'en'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await closeDatabase();
  });

  async function cleanupTestData() {
    try {
      // Delete test tasks and users
      await pool.query('DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%integration-test%']);
      await pool.query('DELETE FROM users WHERE email LIKE $1', ['%integration-test%']);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  describe('POST /api/v1/tasks - Create Task', () => {
    it('should create a new task successfully', async () => {
      const taskData = {
        title: 'Integration Test Task',
        description: 'This is a test task for integration testing',
        priority: 'high',
        status: 'pending',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['integration', 'test'],
        estimated_minutes: 120
      };

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
      expect(response.body.data.status).toBe(taskData.status);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.tags).toEqual(expect.arrayContaining(taskData.tags));

      // Store task ID for later tests
      testTaskId = response.body.data.id;
    });

    it('should reject task creation without authentication', async () => {
      const taskData = {
        title: 'Unauthorized Task',
        description: 'This should fail'
      };

      await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(401);
    });

    it('should reject task creation with invalid data', async () => {
      const invalidTaskData = {
        // Missing required title
        description: 'Task without title',
        priority: 'invalid_priority'
      };

      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTaskData)
        .expect(400);
    });

    it('should create a minimal task with defaults', async () => {
      const minimalTaskData = {
        title: 'Minimal Task'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalTaskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(minimalTaskData.title);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.priority).toBe('none');
      
      // Store second task ID for bulk operations tests
      secondTaskId = response.body.data.id;
    });
  });

  describe('GET /api/v1/tasks/:id - Get Single Task', () => {
    it('should retrieve a task by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testTaskId);
      expect(response.body.data.title).toBe('Integration Test Task');
    });

    it('should return 404 for non-existent task', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .get(`/api/v1/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get(`/api/v1/tasks/${testTaskId}`)
        .expect(401);
    });

    it('should reject access with invalid task ID format', async () => {
      await request(app)
        .get('/api/v1/tasks/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/tasks - List Tasks', () => {
    it('should retrieve user tasks with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(response.body.data.tasks.length).toBeGreaterThan(0);
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?status=pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.tasks.forEach((task: any) => {
        expect(task.status).toBe('pending');
      });
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        response.body.data.tasks.forEach((task: any) => {
          expect(task.priority).toBe('high');
        });
      }
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks.length).toBeLessThanOrEqual(1);
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/v1/tasks?search=Integration')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].title).toContain('Integration');
      }
    });
  });

  describe('PUT /api/v1/tasks/:id - Update Task', () => {
    it('should update a task successfully', async () => {
      const updateData = {
        title: 'Updated Integration Test Task',
        description: 'Updated description',
        priority: 'medium',
        status: 'in_progress',
        estimated_minutes: 180
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.priority).toBe(updateData.priority);
      expect(response.body.data.status).toBe(updateData.status);
      expect(response.body.data.estimated_minutes).toBe(updateData.estimated_minutes);
    });

    it('should partially update a task', async () => {
      const partialUpdate = {
        title: 'Partially Updated Task'
      };

      const response = await request(app)
        .put(`/api/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(partialUpdate.title);
      // Other fields should remain unchanged
      expect(response.body.data.priority).toBe('medium');
    });

    it('should reject update with invalid data', async () => {
      const invalidUpdate = {
        priority: 'invalid_priority',
        status: 'invalid_status'
      };

      await request(app)
        .put(`/api/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);
    });

    it('should return 404 for non-existent task update', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        title: 'Update Non-existent Task'
      };

      await request(app)
        .put(`/api/v1/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id/complete - Mark Task Complete', () => {
    it('should mark a task as completed', async () => {
      const response = await request(app)
        .patch(`/api/v1/tasks/${testTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ actual_minutes: 150 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.completed_at).toBeDefined();
      expect(response.body.data.completed_by).toBe(userId);
      expect(response.body.data.actual_minutes).toBe(150);
    });

    it('should mark task complete without actual minutes', async () => {
      const response = await request(app)
        .patch(`/api/v1/tasks/${secondTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.completed_at).toBeDefined();
    });
  });

  describe('PATCH /api/v1/tasks/:id/start - Mark Task In Progress', () => {
    // First create a new task for this test
    let newTaskId: string;

    beforeAll(async () => {
      const taskData = {
        title: 'Task to Start',
        description: 'This task will be marked in progress'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      newTaskId = response.body.data.id;
    });

    it('should mark a task as in progress', async () => {
      const response = await request(app)
        .patch(`/api/v1/tasks/${newTaskId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.start_date).toBeDefined();
    });
  });

  describe('POST /api/v1/tasks/:id/duplicate - Duplicate Task', () => {
    it('should duplicate a task successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/tasks/${testTaskId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Duplicated Task' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Duplicated Task');
      expect(response.body.data.id).not.toBe(testTaskId);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.status).toBe('pending'); // Should reset to pending
    });

    it('should duplicate with default title if not provided', async () => {
      const response = await request(app)
        .post(`/api/v1/tasks/${testTaskId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toContain('Copy of');
    });
  });

  describe('GET /api/v1/tasks/stats - Task Statistics', () => {
    it('should retrieve task statistics', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalTasks');
      expect(response.body.data).toHaveProperty('completedTasks');
      expect(response.body.data).toHaveProperty('pendingTasks');
      expect(response.body.data).toHaveProperty('inProgressTasks');
      expect(response.body.data).toHaveProperty('tasksByPriority');
      expect(response.body.data).toHaveProperty('tasksByStatus');
      expect(typeof response.body.data.totalTasks).toBe('number');
    });
  });

  describe('GET /api/v1/tasks/due-soon - Due Soon Tasks', () => {
    it('should retrieve tasks due soon', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/due-soon')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by days parameter', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/due-soon?days=3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/tasks/overdue - Overdue Tasks', () => {
    it('should retrieve overdue tasks', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/overdue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/tasks/search - Advanced Search', () => {
    it('should perform advanced search', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/search?q=test&priority=high&status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should search by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await request(app)
        .get(`/api/v1/tasks/search?due_start=${startDate}&due_end=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/v1/tasks/bulk/status - Bulk Status Update', () => {
    let bulkTaskIds: string[] = [];

    beforeAll(async () => {
      // Create multiple tasks for bulk operations
      for (let i = 0; i < 3; i++) {
        const taskData = {
          title: `Bulk Task ${i + 1}`,
          description: `Task for bulk operations ${i + 1}`
        };

        const response = await request(app)
          .post('/api/v1/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskData);

        bulkTaskIds.push(response.body.data.id);
      }
    });

    it('should bulk update task status', async () => {
      const bulkUpdateData = {
        task_ids: bulkTaskIds,
        status: 'in_progress'
      };

      const response = await request(app)
        .patch('/api/v1/tasks/bulk/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('updated');
      expect(response.body.data.updated).toBeGreaterThan(0);
    });

    it('should reject bulk update with invalid status', async () => {
      const invalidBulkUpdate = {
        task_ids: bulkTaskIds,
        status: 'invalid_status'
      };

      await request(app)
        .patch('/api/v1/tasks/bulk/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidBulkUpdate)
        .expect(400);
    });

    it('should reject bulk update without task IDs', async () => {
      const invalidBulkUpdate = {
        status: 'completed'
      };

      await request(app)
        .patch('/api/v1/tasks/bulk/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidBulkUpdate)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/tasks/bulk - Bulk Delete', () => {
    let deleteTaskIds: string[] = [];

    beforeAll(async () => {
      // Create tasks specifically for deletion testing
      for (let i = 0; i < 2; i++) {
        const taskData = {
          title: `Delete Task ${i + 1}`,
          description: `Task for deletion ${i + 1}`
        };

        const response = await request(app)
          .post('/api/v1/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskData);

        deleteTaskIds.push(response.body.data.id);
      }
    });

    it('should bulk delete tasks', async () => {
      const bulkDeleteData = {
        task_ids: deleteTaskIds
      };

      const response = await request(app)
        .delete('/api/v1/tasks/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkDeleteData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deleted');
      expect(response.body.data.deleted).toBe(deleteTaskIds.length);
    });

    it('should verify deleted tasks are not accessible', async () => {
      for (const taskId of deleteTaskIds) {
        await request(app)
          .get(`/api/v1/tasks/${taskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      }
    });
  });

  describe('DELETE /api/v1/tasks/:id - Delete Single Task', () => {
    let taskToDeleteId: string;

    beforeAll(async () => {
      // Create a task specifically for deletion
      const taskData = {
        title: 'Task to Delete',
        description: 'This task will be deleted'
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      taskToDeleteId = response.body.data.id;
    });

    it('should delete a single task', async () => {
      const response = await request(app)
        .delete(`/api/v1/tasks/${taskToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 when accessing deleted task', async () => {
      await request(app)
        .get(`/api/v1/tasks/${taskToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent task', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .delete(`/api/v1/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid UUID format gracefully', async () => {
      await request(app)
        .get('/api/v1/tasks/not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle malformed JSON in request body', async () => {
      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"title": "Test", invalid json}')
        .expect(400);
    });

    it('should handle very large request payloads', async () => {
      const largeDescription = 'A'.repeat(10000); // 10KB description
      const taskData = {
        title: 'Large Task',
        description: largeDescription
      };

      // This should either succeed or fail gracefully with appropriate status
      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect([201, 400, 413]).toContain(response.status);
    });

    it('should handle concurrent requests properly', async () => {
      const promises = [];
      
      // Create 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Concurrent Task ${i}`,
              description: `Concurrent test ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests with expired token', async () => {
      // Use an obviously invalid token
      const invalidToken = 'invalid.jwt.token';
      
      await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject requests with malformed Authorization header', async () => {
      await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', 'Invalid Header Format')
        .expect(401);
    });

    it('should reject requests without Authorization header', async () => {
      await request(app)
        .get('/api/v1/tasks')
        .expect(401);
    });
  });
});
