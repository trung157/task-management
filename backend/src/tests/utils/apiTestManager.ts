/**
 * Comprehensive API Test Utilities
 * 
 * Provides a complete testing framework for the task management API including:
 * - Database setup and cleanup
 * - Authentication helpers
 * - Test data factories
 * - API client utilities
 * - Assertion helpers
 */

import request from 'supertest';
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { generateTokenPair } from '../../config/jwt';
import { UserRole, UserStatus } from '../../models/user';
import { TaskPriority, TaskStatus } from '../../models/task';

// Load test environment
dotenv.config({ path: '.env.test' });

export interface TestConfig {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  api: {
    baseUrl: string;
    version: string;
  };
  auth: {
    jwtSecret: string;
    bcryptRounds: number;
  };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}

export interface TestTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: Date;
  category_id?: string;
  tags: string[];
}

export interface TestCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: any[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Main API Test Manager class
 */
export class ApiTestManager {
  private pool: Pool | null = null;
  private config: TestConfig;
  private app: any = null;
  private testUsers: Map<string, TestUser> = new Map();
  private testData: {
    users: TestUser[];
    tasks: TestTask[];
    categories: TestCategory[];
  } = {
    users: [],
    tasks: [],
    categories: []
  };

  constructor() {
    this.config = {
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'task_management_test_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      },
      api: {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3002',
        version: process.env.API_VERSION || 'v1'
      },
      auth: {
        jwtSecret: process.env.JWT_SECRET || 'test-secret',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10')
      }
    };
  }

  /**
   * Initialize the test environment
   */
  async initialize(expressApp?: any): Promise<void> {
    try {
      // Initialize database connection
      await this.initializeDatabase();
      
      // Set the Express app for supertest
      if (expressApp) {
        this.app = expressApp;
      }

      console.log('✅ API Test Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize API Test Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    this.pool = new Pool({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      user: this.config.database.user,
      password: this.config.database.password,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  /**
   * Get API client for making requests
   */
  getApiClient(): request.SuperTest<request.Test> {
    if (!this.app) {
      throw new Error('Express app not set. Call initialize() with the app instance.');
    }
    return request(this.app) as any;
  }

  /**
   * Clean up test data and connections
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up test data
      await this.cleanupTestData();
      
      // Close database connections
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }

      // Clear in-memory data
      this.testUsers.clear();
      this.testData = { users: [], tasks: [], categories: [] };

      console.log('✅ API Test Manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up test data from database
   */
  private async cleanupTestData(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete in reverse dependency order
      await client.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.%')");
      await client.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.%')");
      await client.query("DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.%')");
      await client.query("DELETE FROM categories WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.%')");
      await client.query("DELETE FROM users WHERE email LIKE '%@test.%'");
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate unique test identifier
   */
  generateTestId(prefix: string = 'test'): string {
    return uuidv4(); // Use proper UUID instead of custom string
  }

  /**
   * Create test user with authentication tokens
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const userId = this.generateTestId('user');
    const email = userData.email || `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.example.com`;
    const password = userData.password || 'TestPassword123!';
    const passwordHash = await bcrypt.hash(password, this.config.auth.bcryptRounds);

    const user = {
      id: userId,
      email,
      password,
      first_name: userData.first_name || 'Test',
      last_name: userData.last_name || 'User',
      role: userData.role || 'user' as UserRole,
      accessToken: '',
      refreshToken: ''
    };

    // Insert user into database
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, role, status, email_verified,
          preferences, notification_settings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [
        user.id,
        user.email,
        passwordHash,
        user.first_name,
        user.last_name,
        user.role,
        'active',
        true,
        JSON.stringify({}),
        JSON.stringify({})
      ]);

      // Generate tokens
      const tokens = generateTokenPair({ 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      });
      
      user.accessToken = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;

      // Store refresh token in database
      await client.query(`
        INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [user.id, user.refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);

    } finally {
      client.release();
    }

    this.testUsers.set(user.id, user);
    this.testData.users.push(user);

    return user;
  }

  /**
   * Create test task
   */
  async createTestTask(userId: string, taskData: Partial<TestTask> = {}): Promise<TestTask> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const taskId = this.generateTestId('task');
    const task: TestTask = {
      id: taskId,
      user_id: userId,
      title: taskData.title || `Test Task ${taskId}`,
      description: taskData.description || 'Test task description',
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      due_date: taskData.due_date,
      category_id: taskData.category_id,
      tags: taskData.tags || ['test']
    };

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO tasks (
          id, user_id, title, description, priority, status, due_date, 
          category_id, tags, sort_order, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [
        task.id,
        task.user_id,
        task.title,
        task.description,
        task.priority,
        task.status,
        task.due_date,
        task.category_id,
        JSON.stringify(task.tags),
        0,
        JSON.stringify({})
      ]);
    } finally {
      client.release();
    }

    this.testData.tasks.push(task);
    return task;
  }

  /**
   * Create test category
   */
  async createTestCategory(userId: string, categoryData: Partial<TestCategory> = {}): Promise<TestCategory> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const categoryId = this.generateTestId('category');
    const category: TestCategory = {
      id: categoryId,
      user_id: userId,
      name: categoryData.name || `Test Category ${categoryId}`,
      color: categoryData.color || '#007bff',
      icon: categoryData.icon || 'folder',
      description: categoryData.description || 'Test category description'
    };

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO categories (
          id, user_id, name, color, icon, description, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        category.id,
        category.user_id,
        category.name,
        category.color,
        category.icon,
        category.description
      ]);
    } finally {
      client.release();
    }

    this.testData.categories.push(category);
    return category;
  }

  /**
   * Make authenticated API request
   */
  authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, user: TestUser) {
    const client = this.getApiClient();
    return client[method](url).set('Authorization', `Bearer ${user.accessToken}`);
  }

  /**
   * Helper methods for common API operations
   */

  // Auth API helpers
  async register(userData: any): Promise<request.Response> {
    return this.getApiClient()
      .post('/api/v1/auth/register')
      .send(userData);
  }

  async login(email: string, password: string): Promise<request.Response> {
    return this.getApiClient()
      .post('/api/v1/auth/login')
      .send({ email, password });
  }

  async refreshToken(refreshToken: string): Promise<request.Response> {
    return this.getApiClient()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });
  }

  // Task API helpers
  async createTask(user: TestUser, taskData: any): Promise<request.Response> {
    return this.authenticatedRequest('post', '/api/v1/tasks', user)
      .send(taskData);
  }

  async getTasks(user: TestUser, query: any = {}): Promise<request.Response> {
    return this.authenticatedRequest('get', '/api/v1/tasks', user)
      .query(query);
  }

  async getTask(user: TestUser, taskId: string): Promise<request.Response> {
    return this.authenticatedRequest('get', `/api/v1/tasks/${taskId}`, user);
  }

  async updateTask(user: TestUser, taskId: string, updateData: any): Promise<request.Response> {
    return this.authenticatedRequest('put', `/api/v1/tasks/${taskId}`, user)
      .send(updateData);
  }

  async deleteTask(user: TestUser, taskId: string): Promise<request.Response> {
    return this.authenticatedRequest('delete', `/api/v1/tasks/${taskId}`, user);
  }

  // Category API helpers
  async createCategory(user: TestUser, categoryData: any): Promise<request.Response> {
    return this.authenticatedRequest('post', '/api/v1/categories', user)
      .send(categoryData);
  }

  async getCategories(user: TestUser): Promise<request.Response> {
    return this.authenticatedRequest('get', '/api/v1/categories', user);
  }

  // User API helpers
  async getUserProfile(user: TestUser): Promise<request.Response> {
    return this.authenticatedRequest('get', '/api/v1/users/profile', user);
  }

  async updateUserProfile(user: TestUser, updateData: any): Promise<request.Response> {
    return this.authenticatedRequest('put', '/api/v1/users/profile', user)
      .send(updateData);
  }

  /**
   * Assertion helpers
   */
  expectSuccessfulResponse(response: request.Response, expectedData?: any): void {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    if (expectedData) {
      expect(response.body.data).toMatchObject(expectedData);
    }
  }

  expectErrorResponse(response: request.Response, expectedStatus: number, expectedMessage?: string): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  expectValidationError(response: request.Response): void {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(response.body.errors)).toBe(true);
  }

  expectUnauthorizedResponse(response: request.Response): void {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  }

  expectNotFoundResponse(response: request.Response): void {
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
  }

  /**
   * Database query helpers
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getUserById(userId: string): Promise<any> {
    const users = await this.query('SELECT * FROM users WHERE id = $1', [userId]);
    return users[0] || null;
  }

  async getTaskById(taskId: string): Promise<any> {
    const tasks = await this.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    return tasks[0] || null;
  }

  async getCategoryById(categoryId: string): Promise<any> {
    const categories = await this.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    return categories[0] || null;
  }

  /**
   * Get test data
   */
  getTestUsers(): TestUser[] {
    return this.testData.users;
  }

  getTestTasks(): TestTask[] {
    return this.testData.tasks;
  }

  getTestCategories(): TestCategory[] {
    return this.testData.categories;
  }

  getTestUser(userId: string): TestUser | undefined {
    return this.testUsers.get(userId);
  }
}

// Export singleton instance
export const apiTestManager = new ApiTestManager();
