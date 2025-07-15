/**
 * Integration Test Setup Utilities
 * 
 * Provides utilities for setting up integration tests with database,
 * authentication, and test data management.
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import { User } from '../../models/user';
import { Task } from '../../models/task';
import { TestDataFactory } from '../utils/testDataFactory';
import { generateTokenPair } from '../../config/jwt';
import { connectDatabase, closeDatabase } from '../../db';
import { generateTestId } from '../utils/testUtils';

export interface TestUser {
  user: User;
  authToken: string;
  refreshToken: string;
}

export interface TestContext {
  dbClient: PoolClient;
  adminUser: TestUser;
  regularUser: TestUser;
  cleanup: () => Promise<void>;
}

export class IntegrationTestSetup {
  private static dbClient: PoolClient | null = null;
  private static testUsers: TestUser[] = [];
  private static createdTaskIds: string[] = [];

  /**
   * Set up integration test environment
   */
  static async setup(): Promise<TestContext> {
    // Connect to database
    await connectDatabase();
    this.dbClient = await (global as any).pool.connect();

    // Clean up any existing test data
    await this.cleanupTestData();

    // Create test users
    const adminUser = await this.createTestUser({
      email: `admin-${Date.now()}@test.com`,
      role: 'admin' as any,
      first_name: 'Admin',
      last_name: 'User'
    });

    const regularUser = await this.createTestUser({
      email: `user-${Date.now()}@test.com`,
      role: 'user' as any,
      first_name: 'Regular',
      last_name: 'User'
    });

    this.testUsers = [adminUser, regularUser];

    return {
      dbClient: this.dbClient!,
      adminUser,
      regularUser,
      cleanup: this.cleanup.bind(this)
    };
  }

  /**
   * Create a test user with authentication tokens
   */
  static async createTestUser(userData: Partial<User>): Promise<TestUser> {
    if (!this.dbClient) {
      throw new Error('Database client not initialized. Call setup() first.');
    }

    const userId = generateTestId();
    const now = new Date();
    const hashedPassword = await bcrypt.hash('testpassword123!', 12);

    const defaultUserData = {
      id: userId,
      email: `test-${Date.now()}@test.com`,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      language_code: 'en',
      role: 'user' as any,
      status: 'active' as any,
      email_verified: true,
      preferences: {},
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        due_date_reminders: true,
        task_assignments: true
      },
      created_at: now,
      updated_at: now,
      ...userData
    };

    const result = await this.dbClient.query(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, display_name,
        timezone, date_format, time_format, language_code, role, status,
        email_verified, preferences, notification_settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        defaultUserData.id,
        defaultUserData.email,
        hashedPassword,
        defaultUserData.first_name,
        defaultUserData.last_name,
        defaultUserData.display_name,
        defaultUserData.timezone,
        defaultUserData.date_format,
        defaultUserData.time_format,
        defaultUserData.language_code,
        defaultUserData.role,
        defaultUserData.status,
        defaultUserData.email_verified,
        JSON.stringify(defaultUserData.preferences),
        JSON.stringify(defaultUserData.notification_settings),
        defaultUserData.created_at,
        defaultUserData.updated_at
      ]
    );

    const user = result.rows[0];

    // Generate authentication tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user,
      authToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Create test tasks for a user
   */
  static async createTestTasks(userId: string, taskDataArray: Partial<Task>[]): Promise<Task[]> {
    if (!this.dbClient) {
      throw new Error('Database client not initialized. Call setup() first.');
    }

    const tasks: Task[] = [];

    for (const taskData of taskDataArray) {
      const taskId = generateTestId();
      const now = new Date();

      const defaultTaskData = {
        id: taskId,
        user_id: userId,
        title: 'Test Task',
        description: 'Test task description',
        priority: 'medium' as any,
        status: 'pending' as any,
        due_date: null,
        reminder_date: null,
        start_date: null,
        estimated_minutes: null,
        tags: [],
        sort_order: 0,
        metadata: {},
        created_at: now,
        updated_at: now,
        ...taskData
      };

      const result = await this.dbClient.query(
        `INSERT INTO tasks (
          id, user_id, title, description, priority, status, due_date,
          reminder_date, start_date, estimated_minutes, tags, sort_order,
          metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          defaultTaskData.id,
          defaultTaskData.user_id,
          defaultTaskData.title,
          defaultTaskData.description,
          defaultTaskData.priority,
          defaultTaskData.status,
          defaultTaskData.due_date,
          defaultTaskData.reminder_date,
          defaultTaskData.start_date,
          defaultTaskData.estimated_minutes,
          JSON.stringify(defaultTaskData.tags),
          defaultTaskData.sort_order,
          JSON.stringify(defaultTaskData.metadata),
          defaultTaskData.created_at,
          defaultTaskData.updated_at
        ]
      );

      const task = result.rows[0];
      tasks.push(task);
      this.createdTaskIds.push(task.id);
    }

    return tasks;
  }

  /**
   * Delete specific test tasks
   */
  static async deleteTestTasks(taskIds: string[]): Promise<void> {
    if (!this.dbClient || taskIds.length === 0) return;

    const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(', ');
    await this.dbClient.query(
      `DELETE FROM tasks WHERE id IN (${placeholders})`,
      taskIds
    );

    // Remove from tracking
    this.createdTaskIds = this.createdTaskIds.filter(id => !taskIds.includes(id));
  }

  /**
   * Create test categories for a user
   */
  static async createTestCategories(userId: string, categoryDataArray: any[]): Promise<any[]> {
    if (!this.dbClient) {
      throw new Error('Database client not initialized. Call setup() first.');
    }

    const categories: any[] = [];

    for (const categoryData of categoryDataArray) {
      const result = await this.dbClient.query(
        `INSERT INTO categories (id, user_id, name, color, icon, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          generateTestId(),
          userId,
          categoryData.name || 'Test Category',
          categoryData.color || '#007bff',
          categoryData.icon || 'folder',
          new Date(),
          new Date()
        ]
      );

      categories.push(result.rows[0]);
    }

    return categories;
  }

  /**
   * Create test notifications for a user
   */
  static async createTestNotifications(userId: string, notificationDataArray: any[]): Promise<any[]> {
    if (!this.dbClient) {
      throw new Error('Database client not initialized. Call setup() first.');
    }

    const notifications: any[] = [];

    for (const notificationData of notificationDataArray) {
      const result = await this.dbClient.query(
        `INSERT INTO notifications (id, user_id, title, message, type, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          generateTestId(),
          userId,
          notificationData.title || 'Test Notification',
          notificationData.message || 'Test notification message',
          notificationData.type || 'info',
          notificationData.read || false,
          new Date()
        ]
      );

      notifications.push(result.rows[0]);
    }

    return notifications;
  }

  /**
   * Wait for database operations to complete
   */
  static async waitForDatabase(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verify database connection
   */
  static async verifyDatabaseConnection(): Promise<boolean> {
    if (!this.dbClient) return false;

    try {
      const result = await this.dbClient.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  static async getDatabaseStats(): Promise<any> {
    if (!this.dbClient) return null;

    try {
      const result = await this.dbClient.query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE email LIKE '%@test.com') as test_users,
          (SELECT COUNT(*) FROM tasks WHERE user_id LIKE 'test-%') as test_tasks,
          (SELECT COUNT(*) FROM notifications WHERE user_id LIKE 'test-%') as test_notifications
      `);

      return result.rows[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up all test data
   */
  private static async cleanupTestData(): Promise<void> {
    if (!this.dbClient) return;

    try {
      // Delete test tasks (cascade will handle related data)
      await this.dbClient.query(`DELETE FROM tasks WHERE user_id LIKE 'test-%'`);
      
      // Delete test notifications
      await this.dbClient.query(`DELETE FROM notifications WHERE user_id LIKE 'test-%'`);
      
      // Delete test categories
      await this.dbClient.query(`DELETE FROM categories WHERE user_id LIKE 'test-%'`);
      
      // Delete test refresh tokens
      await this.dbClient.query(`DELETE FROM refresh_tokens WHERE user_id LIKE 'test-%'`);
      
      // Delete test users (must be last due to foreign key constraints)
      await this.dbClient.query(`DELETE FROM users WHERE email LIKE '%@test.com'`);
      
      // Clear tracking arrays
      this.createdTaskIds = [];
      this.testUsers = [];
    } catch (error) {
      console.warn('Error during test data cleanup:', error);
    }
  }

  /**
   * Complete cleanup and close connections
   */
  static async cleanup(): Promise<void> {
    await this.cleanupTestData();

    if (this.dbClient) {
      this.dbClient.release();
      this.dbClient = null;
    }

    await closeDatabase();
  }
}

/**
 * Helper function to create authenticated request headers
 */
export function createAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Helper function to expect API success response
 */
export function expectApiSuccess(response: any, expectedData?: any): void {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
  
  if (expectedData) {
    expect(response.body.data).toMatchObject(expectedData);
  }
}

/**
 * Helper function to expect API error response
 */
export function expectApiError(response: any, expectedError?: string): void {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  
  if (expectedError) {
    expect(response.body.error).toContain(expectedError);
  }
}

/**
 * Helper function to create test date ranges
 */
export function createDateRange(daysFromNow: number[]): Date[] {
  return daysFromNow.map(days => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  });
}

/**
 * Mock external services for testing
 */
export class TestMocks {
  static mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    sendTaskReminder: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordReset: jest.fn().mockResolvedValue({ success: true })
  };

  static mockNotificationService = {
    sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
    sendInAppNotification: jest.fn().mockResolvedValue({ success: true })
  };

  static reset(): void {
    Object.values(this.mockEmailService).forEach(mock => {
      if (jest.isMockFunction(mock)) mock.mockClear();
    });
    
    Object.values(this.mockNotificationService).forEach(mock => {
      if (jest.isMockFunction(mock)) mock.mockClear();
    });
  }
}
