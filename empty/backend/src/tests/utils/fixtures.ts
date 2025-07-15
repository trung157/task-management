/**
 * Database Fixtures
 * 
 * Pre-defined test data fixtures for consistent testing.
 * Provides reusable test data sets for users, tasks, categories, and other entities.
 */

import bcrypt from 'bcrypt';
import { QueryResult } from 'pg';
import { getTestDatabase } from './databaseTestUtils';
import { UserRole, UserStatus } from '../../models/user';
import { TaskPriority, TaskStatus } from '../../models/task';

// Base fixture interfaces
export interface UserFixture {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string;
  timezone: string;
  date_format: string;
  time_format: string;
  language_code: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  preferences: Record<string, any>;
  notification_settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TaskFixture {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: Date;
  reminder_date?: Date;
  start_date?: Date;
  estimated_minutes?: number;
  actual_minutes?: number;
  completed_at?: Date;
  completed_by?: string;
  tags: string[];
  sort_order: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryFixture {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationFixture {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: Record<string, any>;
  created_at: Date;
}

// Fixture ID generators
export class FixtureIdGenerator {
  private static counters: Map<string, number> = new Map();

  static generateId(prefix: string = 'test'): string {
    const counter = this.counters.get(prefix) || 0;
    this.counters.set(prefix, counter + 1);
    return `${prefix}_${Date.now()}_${counter.toString().padStart(3, '0')}`;
  }

  static generateEmail(prefix: string = 'test'): string {
    return `${this.generateId(prefix)}@test.example.com`;
  }

  static reset(): void {
    this.counters.clear();
  }
}

// User fixtures
export class UserFixtures {
  private static passwordHash: string | null = null;

  private static async getPasswordHash(): Promise<string> {
    if (!this.passwordHash) {
      this.passwordHash = await bcrypt.hash('testpassword123!', 12);
    }
    return this.passwordHash;
  }

  static async createAdminUser(overrides: Partial<UserFixture> = {}): Promise<UserFixture> {
    const now = new Date();
    const passwordHash = await this.getPasswordHash();

    return {
      id: FixtureIdGenerator.generateId('admin'),
      email: FixtureIdGenerator.generateEmail('admin'),
      password_hash: passwordHash,
      first_name: 'Admin',
      last_name: 'User',
      display_name: 'Admin User',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      language_code: 'en',
      role: 'admin' as UserRole,
      status: 'active' as UserStatus,
      email_verified: true,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en',
        timezone: 'UTC'
      },
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        due_date_reminders: true,
        task_assignments: true
      },
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static async createRegularUser(overrides: Partial<UserFixture> = {}): Promise<UserFixture> {
    const now = new Date();
    const passwordHash = await this.getPasswordHash();

    return {
      id: FixtureIdGenerator.generateId('user'),
      email: FixtureIdGenerator.generateEmail('user'),
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      language_code: 'en',
      role: 'user' as UserRole,
      status: 'active' as UserStatus,
      email_verified: true,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en',
        timezone: 'UTC'
      },
      notification_settings: {
        email_notifications: true,
        push_notifications: false,
        due_date_reminders: true,
        task_assignments: true
      },
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static async createPendingUser(overrides: Partial<UserFixture> = {}): Promise<UserFixture> {
    const baseUser = await this.createRegularUser(overrides);
    return {
      ...baseUser,
      status: 'pending_verification' as UserStatus,
      email_verified: false,
      ...overrides
    };
  }

  static async createSuspendedUser(overrides: Partial<UserFixture> = {}): Promise<UserFixture> {
    const baseUser = await this.createRegularUser(overrides);
    return {
      ...baseUser,
      status: 'suspended' as UserStatus,
      ...overrides
    };
  }

  static async createMultipleUsers(count: number, role: UserRole = 'user'): Promise<UserFixture[]> {
    const users: UserFixture[] = [];
    for (let i = 0; i < count; i++) {
      const user = role === 'admin' 
        ? await this.createAdminUser({ 
            first_name: `Admin${i}`, 
            last_name: `User${i}`,
            display_name: `Admin User ${i}`
          })
        : await this.createRegularUser({ 
            first_name: `Test${i}`, 
            last_name: `User${i}`,
            display_name: `Test User ${i}`
          });
      users.push(user);
    }
    return users;
  }
}

// Task fixtures
export class TaskFixtures {
  static createPendingTask(userId: string, overrides: Partial<TaskFixture> = {}): TaskFixture {
    const now = new Date();

    return {
      id: FixtureIdGenerator.generateId('task'),
      user_id: userId,
      title: 'Test Task',
      description: 'This is a test task description',
      priority: 'medium' as TaskPriority,
      status: 'pending' as TaskStatus,
      tags: ['test', 'fixture'],
      sort_order: 0,
      metadata: {
        source: 'test',
        category: 'fixture'
      },
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static createInProgressTask(userId: string, overrides: Partial<TaskFixture> = {}): TaskFixture {
    const baseTask = this.createPendingTask(userId, overrides);
    return {
      ...baseTask,
      status: 'in_progress' as TaskStatus,
      start_date: new Date(),
      ...overrides
    };
  }

  static createCompletedTask(userId: string, overrides: Partial<TaskFixture> = {}): TaskFixture {
    const baseTask = this.createInProgressTask(userId, overrides);
    const completedAt = new Date();
    return {
      ...baseTask,
      status: 'completed' as TaskStatus,
      completed_at: completedAt,
      completed_by: userId,
      actual_minutes: 60,
      ...overrides
    };
  }

  static createHighPriorityTask(userId: string, overrides: Partial<TaskFixture> = {}): TaskFixture {
    return this.createPendingTask(userId, {
      priority: 'high' as TaskPriority,
      title: 'High Priority Task',
      ...overrides
    });
  }

  static createTaskWithDueDate(userId: string, daysFromNow: number, overrides: Partial<TaskFixture> = {}): TaskFixture {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);

    return this.createPendingTask(userId, {
      title: `Task Due in ${daysFromNow} Days`,
      due_date: dueDate,
      reminder_date: new Date(dueDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      ...overrides
    });
  }

  static createTaskWithCategory(userId: string, categoryId: string, overrides: Partial<TaskFixture> = {}): TaskFixture {
    return this.createPendingTask(userId, {
      category_id: categoryId,
      title: 'Categorized Task',
      ...overrides
    });
  }

  static createTaskSet(userId: string): TaskFixture[] {
    return [
      this.createPendingTask(userId, { title: 'Pending Task 1', priority: 'high' as TaskPriority }),
      this.createPendingTask(userId, { title: 'Pending Task 2', priority: 'low' as TaskPriority }),
      this.createInProgressTask(userId, { title: 'In Progress Task', priority: 'medium' as TaskPriority }),
      this.createCompletedTask(userId, { title: 'Completed Task', priority: 'high' as TaskPriority }),
      this.createTaskWithDueDate(userId, 1, { title: 'Due Tomorrow', priority: 'high' as TaskPriority }),
      this.createTaskWithDueDate(userId, 7, { title: 'Due Next Week', priority: 'medium' as TaskPriority }),
      this.createTaskWithDueDate(userId, -1, { title: 'Overdue Task', priority: 'high' as TaskPriority })
    ];
  }

  static createBulkTasks(userId: string, count: number, status: TaskStatus = 'pending'): TaskFixture[] {
    const tasks: TaskFixture[] = [];
    for (let i = 0; i < count; i++) {
      const task = this.createPendingTask(userId, {
        title: `Bulk Task ${i + 1}`,
        status,
        sort_order: i
      });
      tasks.push(task);
    }
    return tasks;
  }
}

// Category fixtures
export class CategoryFixtures {
  static createWorkCategory(userId: string, overrides: Partial<CategoryFixture> = {}): CategoryFixture {
    const now = new Date();

    return {
      id: FixtureIdGenerator.generateId('category'),
      user_id: userId,
      name: 'Work',
      color: '#3498db',
      icon: 'briefcase',
      description: 'Work-related tasks',
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static createPersonalCategory(userId: string, overrides: Partial<CategoryFixture> = {}): CategoryFixture {
    const now = new Date();

    return {
      id: FixtureIdGenerator.generateId('category'),
      user_id: userId,
      name: 'Personal',
      color: '#e74c3c',
      icon: 'home',
      description: 'Personal tasks',
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static createProjectCategory(userId: string, projectName: string, overrides: Partial<CategoryFixture> = {}): CategoryFixture {
    const now = new Date();

    return {
      id: FixtureIdGenerator.generateId('category'),
      user_id: userId,
      name: projectName,
      color: '#9b59b6',
      icon: 'folder',
      description: `${projectName} project tasks`,
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  static createCategorySet(userId: string): CategoryFixture[] {
    return [
      this.createWorkCategory(userId),
      this.createPersonalCategory(userId),
      this.createProjectCategory(userId, 'Project Alpha'),
      this.createProjectCategory(userId, 'Project Beta')
    ];
  }
}

// Notification fixtures
export class NotificationFixtures {
  static createTaskReminderNotification(userId: string, taskId: string, overrides: Partial<NotificationFixture> = {}): NotificationFixture {
    return {
      id: FixtureIdGenerator.generateId('notification'),
      user_id: userId,
      title: 'Task Reminder',
      message: 'You have a task due soon',
      type: 'task_reminder',
      read: false,
      data: {
        task_id: taskId,
        type: 'due_soon'
      },
      created_at: new Date(),
      ...overrides
    };
  }

  static createWelcomeNotification(userId: string, overrides: Partial<NotificationFixture> = {}): NotificationFixture {
    return {
      id: FixtureIdGenerator.generateId('notification'),
      user_id: userId,
      title: 'Welcome!',
      message: 'Welcome to the Task Management System',
      type: 'welcome',
      read: false,
      data: {
        onboarding: true
      },
      created_at: new Date(),
      ...overrides
    };
  }

  static createSystemNotification(userId: string, overrides: Partial<NotificationFixture> = {}): NotificationFixture {
    return {
      id: FixtureIdGenerator.generateId('notification'),
      user_id: userId,
      title: 'System Update',
      message: 'System maintenance scheduled for tonight',
      type: 'system',
      read: false,
      data: {
        maintenance_window: '2023-01-01T02:00:00Z'
      },
      created_at: new Date(),
      ...overrides
    };
  }

  static createNotificationSet(userId: string): NotificationFixture[] {
    return [
      this.createWelcomeNotification(userId),
      this.createTaskReminderNotification(userId, 'task_123'),
      this.createSystemNotification(userId, { read: true }),
      this.createTaskReminderNotification(userId, 'task_456', { 
        title: 'Overdue Task',
        message: 'You have an overdue task',
        data: { task_id: 'task_456', type: 'overdue' }
      })
    ];
  }
}

// Database insertion helpers
export class FixtureLoader {
  private static db = getTestDatabase();

  static async insertUser(user: UserFixture): Promise<QueryResult> {
    return await this.db.query(`
      INSERT INTO users (
        id, email, password_hash, first_name, last_name, display_name,
        timezone, date_format, time_format, language_code, role, status,
        email_verified, preferences, notification_settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      user.id, user.email, user.password_hash, user.first_name, user.last_name,
      user.display_name, user.timezone, user.date_format, user.time_format,
      user.language_code, user.role, user.status, user.email_verified,
      JSON.stringify(user.preferences), JSON.stringify(user.notification_settings),
      user.created_at, user.updated_at
    ]);
  }

  static async insertTask(task: TaskFixture): Promise<QueryResult> {
    return await this.db.query(`
      INSERT INTO tasks (
        id, user_id, category_id, title, description, priority, status,
        due_date, reminder_date, start_date, estimated_minutes, actual_minutes,
        completed_at, completed_by, tags, sort_order, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      task.id, task.user_id, task.category_id, task.title, task.description,
      task.priority, task.status, task.due_date, task.reminder_date, task.start_date,
      task.estimated_minutes, task.actual_minutes, task.completed_at, task.completed_by,
      JSON.stringify(task.tags), task.sort_order, JSON.stringify(task.metadata),
      task.created_at, task.updated_at
    ]);
  }

  static async insertCategory(category: CategoryFixture): Promise<QueryResult> {
    return await this.db.query(`
      INSERT INTO categories (
        id, user_id, name, color, icon, description, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      category.id, category.user_id, category.name, category.color,
      category.icon, category.description, category.created_at, category.updated_at
    ]);
  }

  static async insertNotification(notification: NotificationFixture): Promise<QueryResult> {
    return await this.db.query(`
      INSERT INTO notifications (
        id, user_id, title, message, type, read, data, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      notification.id, notification.user_id, notification.title, notification.message,
      notification.type, notification.read, JSON.stringify(notification.data),
      notification.created_at
    ]);
  }

  static async loadUserWithTasks(userRole: UserRole = 'user'): Promise<{ user: UserFixture; tasks: TaskFixture[] }> {
    const user = userRole === 'admin' 
      ? await UserFixtures.createAdminUser()
      : await UserFixtures.createRegularUser();
    
    await this.insertUser(user);
    
    const tasks = TaskFixtures.createTaskSet(user.id);
    for (const task of tasks) {
      await this.insertTask(task);
    }

    return { user, tasks };
  }

  static async loadCompleteUserSetup(): Promise<{
    user: UserFixture;
    categories: CategoryFixture[];
    tasks: TaskFixture[];
    notifications: NotificationFixture[];
  }> {
    const user = await UserFixtures.createRegularUser();
    await this.insertUser(user);

    const categories = CategoryFixtures.createCategorySet(user.id);
    for (const category of categories) {
      await this.insertCategory(category);
    }

    const tasks = TaskFixtures.createTaskSet(user.id);
    // Assign some tasks to categories
    if (categories.length > 0) {
      tasks[0].category_id = categories[0].id; // Work category
      tasks[1].category_id = categories[1].id; // Personal category
    }
    
    for (const task of tasks) {
      await this.insertTask(task);
    }

    const notifications = NotificationFixtures.createNotificationSet(user.id);
    for (const notification of notifications) {
      await this.insertNotification(notification);
    }

    return { user, categories, tasks, notifications };
  }

  static async cleanupFixtures(): Promise<void> {
    await this.db.cleanupTestData(['test_%']);
    FixtureIdGenerator.reset();
  }
}
