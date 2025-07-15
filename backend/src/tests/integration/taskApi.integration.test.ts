/**
 * Task Management API Integration Tests
 * 
 * Simple integration tests for task management endpoints
 */

import request from 'supertest';

// Mock database and utilities to avoid connection issues
jest.mock('../../db', () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/database-health', () => ({
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  getMetrics: jest.fn().mockReturnValue({ connections: 0, errors: { connectionErrors: 0 } }),
}));

import { app } from '../../index';

describe('Task Management API Integration Tests', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Mock authentication token for testing
    authToken = 'Bearer test-token';
  });

  describe('GET /api/v1/tasks', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/tasks', () => {
    it('should return 401 without authentication', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'medium',
        due_date: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/tasks/test-id')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});