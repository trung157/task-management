import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/config';
import pool from '../../db';

/**
 * Test utility functions for creating test data, tokens, and database operations
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TestTask {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export interface CreateTaskData {
  user_id: string;
  title: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  due_date?: Date;
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(userData: Partial<TestUser> = {}): string {
  const defaultUser = {
    id: uuidv4(),
    email: 'test@example.com',
    role: 'user' as const,
  };

  const user = { ...defaultUser, ...userData };

  return jwt.sign(user, config.jwt.secret, { expiresIn: '1h' });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(userData: Partial<TestUser> = {}): string {
  const defaultUser = {
    id: uuidv4(),
    email: 'test@example.com',
    role: 'user' as const,
  };

  const user = { ...defaultUser, ...userData };

  return jwt.sign(user, config.jwt.secret, { expiresIn: '-1h' });
}

/**
 * Generate an invalid JWT token for testing
 */
export function generateInvalidToken(): string {
  return 'invalid.jwt.token';
}

/**
 * Hash a password for testing
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate a UUID for testing
 */
export function generateTestId(): string {
  return uuidv4();
}

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: Partial<CreateUserData> = {}): Promise<TestUser> {
  const defaultData: CreateUserData = {
    email: generateTestEmail(),
    password: 'TestPassword123!',
    first_name: 'Test',
    last_name: 'User',
    role: 'user',
    is_active: true,
  };

  const data = { ...defaultData, ...userData };
  const hashedPassword = await hashPassword(data.password);
  const userId = generateTestId();

  const query = `
    INSERT INTO users (
      id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    userId,
    data.email,
    hashedPassword,
    data.first_name,
    data.last_name,
    data.role,
    data.is_active,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Create a test task in the database
 */
export async function createTestTask(taskData: CreateTaskData): Promise<TestTask> {
  const defaultData = {
    description: 'Test task description',
    status: 'pending' as const,
    priority: 'medium' as const,
  };

  const data = { ...defaultData, ...taskData };
  const taskId = generateTestId();

  const query = `
    INSERT INTO tasks (
      id, user_id, title, description, status, priority, due_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    taskId,
    data.user_id,
    data.title,
    data.description,
    data.status,
    data.priority,
    data.due_date || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number, baseData: Partial<CreateUserData> = {}): Promise<TestUser[]> {
  const users: TestUser[] = [];
  
  for (let i = 0; i < count; i++) {
    const userData = {
      ...baseData,
      email: generateTestEmail(`user${i}`),
      first_name: `User${i}`,
      last_name: `Test${i}`,
    };
    
    const user = await createTestUser(userData);
    users.push(user);
  }
  
  return users;
}

/**
 * Create multiple test tasks for a user
 */
export async function createTestTasks(userId: string, count: number, baseData: Partial<CreateTaskData> = {}): Promise<TestTask[]> {
  const tasks: TestTask[] = [];
  
  for (let i = 0; i < count; i++) {
    const taskData = {
      user_id: userId,
      title: `Test Task ${i + 1}`,
      ...baseData,
    };
    
    const task = await createTestTask(taskData);
    tasks.push(task);
  }
  
  return tasks;
}

/**
 * Clean up test data by deleting users and their associated tasks
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete tasks first (foreign key constraint)
    await client.query('DELETE FROM tasks WHERE user_id = ANY($1)', [userIds]);
    
    // Delete users
    await client.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clean up test data by deleting specific tasks
 */
export async function cleanupTestTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;

  await pool.query('DELETE FROM tasks WHERE id = ANY($1)', [taskIds]);
}

/**
 * Clean up all test data (use with caution)
 */
export async function cleanupAllTestData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete all test data (identify by email pattern)
    await client.query('DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%-test-%@example.com']);
    await client.query('DELETE FROM users WHERE email LIKE $1', ['%-test-%@example.com']);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Wait for a specified amount of time (useful for testing timeouts)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random test data
 */
export const testDataGenerators = {
  randomString: (length: number = 10) => Math.random().toString(36).substring(2, length + 2),
  randomEmail: () => `${testDataGenerators.randomString(8)}@example.com`,
  randomPassword: () => `Pass${testDataGenerators.randomString(8)}123!`,
  randomTitle: () => `Task ${testDataGenerators.randomString(6)}`,
  randomDescription: () => `Description for ${testDataGenerators.randomString(10)}`,
  randomPriority: () => ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
  randomStatus: () => ['pending', 'in_progress', 'completed', 'cancelled'][Math.floor(Math.random() * 4)] as 'pending' | 'in_progress' | 'completed' | 'cancelled',
  randomDate: (daysFromNow: number = 30) => new Date(Date.now() + Math.random() * daysFromNow * 24 * 60 * 60 * 1000),
};

/**
 * Assert that a date is approximately equal to another date (within tolerance)
 */
export function assertDateApproximatelyEqual(actual: Date, expected: Date, toleranceMs: number = 1000): void {
  const diff = Math.abs(actual.getTime() - expected.getTime());
  if (diff > toleranceMs) {
    throw new Error(`Dates are not approximately equal. Difference: ${diff}ms, Tolerance: ${toleranceMs}ms`);
  }
}

/**
 * Create a complete test scenario with user and tasks
 */
export async function createTestScenario(options: {
  userCount?: number;
  tasksPerUser?: number;
  userRole?: 'admin' | 'user';
} = {}): Promise<{
  users: TestUser[];
  tasks: TestTask[];
  tokens: string[];
}> {
  const { userCount = 1, tasksPerUser = 3, userRole = 'user' } = options;
  
  const users = await createTestUsers(userCount, { role: userRole });
  const tasks: TestTask[] = [];
  const tokens: string[] = [];
  
  for (const user of users) {
    const userTasks = await createTestTasks(user.id, tasksPerUser);
    tasks.push(...userTasks);
    
    const token = generateTestToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    tokens.push(token);
  }
  
  return { users, tasks, tokens };
}
