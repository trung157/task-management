/**
 * Test Data Factory
 * Provides factory methods for creating test data objects
 */

import { UserRole, UserStatus } from '../../models/user';
import * as testUtils from './testUtils';

export interface TestUser {
  id: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
  preferences?: Record<string, any>;
  profile?: {
    bio?: string;
    avatar_url?: string;
    timezone?: string;
    language_code?: string;
  };
}

export interface TestUserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  timezone: string;
  date_format: string;
  time_format: string;
  language_code: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  email_verified_at?: Date;
  password_changed_at?: Date;
  failed_login_attempts: number;
  locked_until?: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  preferences: Record<string, any>;
  notification_settings: {
    email_notifications: boolean;
    push_notifications: boolean;
    due_date_reminders: boolean;
    task_assignments: boolean;
  };
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TestRegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  language_code?: string;
  terms_accepted?: boolean;
}

/**
 * Factory class for creating test data
 */
export class TestDataFactory {
  
  /**
   * Create a test user with optional overrides
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const baseUser: TestUser = {
      id: testUtils.generateTestId(),
      email: `test.user.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'user' as UserRole,
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
      preferences: {
        timezone: 'UTC',
        language: 'en',
        notifications: true
      },
      profile: {
        bio: 'Test user bio',
        timezone: 'UTC',
        language_code: 'en'
      }
    };

    return { ...baseUser, ...overrides };
  }

  /**
   * Create multiple test users
   */
  static createUsers(count: number, baseOverrides: Partial<TestUser> = {}): TestUser[] {
    return Array.from({ length: count }, (_, index) =>
      this.createUser({
        ...baseOverrides,
        email: `test.user.${index}.${Date.now()}@example.com`,
        first_name: `Test${index}`,
        last_name: `User${index}`
      })
    );
  }

  /**
   * Create an admin user
   */
  static createAdminUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'admin',
      email: `admin.${Date.now()}@example.com`,
      first_name: 'Admin',
      last_name: 'User',
      ...overrides
    });
  }

  /**
   * Create test task data for API requests
   */
  static createTaskData(overrides: Partial<any> = {}) {
    return {
      title: `Test Task ${Date.now()}`,
      description: 'This is a test task description',
      status: 'pending',
      priority: 'medium',
      due_date: testUtils.testDataGenerators.randomDate(7), // 7 days from now
      tags: ['test', 'sample'],
      metadata: {
        source: 'test',
        category: 'development'
      },
      ...overrides
    };
  }

  /**
   * Create multiple test task data objects
   */
  static createTaskDataList(count: number, baseOverrides: Partial<any> = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.createTaskData({
        ...baseOverrides,
        title: `Test Task ${index + 1} - ${Date.now()}`,
        priority: ['low', 'medium', 'high'][index % 3],
        status: ['pending', 'in_progress', 'completed'][index % 3]
      })
    );
  }

  /**
   * Create test registration data
   */
  static createRegistrationData(overrides: Partial<TestRegistrationData> = {}) {
    return {
      email: `new.user.${Date.now()}@example.com`,
      password: 'NewPassword123!',
      first_name: 'New',
      last_name: 'User',
      terms_accepted: true,
      timezone: 'UTC',
      language_code: 'en',
      ...overrides
    };
  }

  /**
   * Create test login data
   */
  static createLoginData(user: TestUser, overrides: Partial<any> = {}) {
    return {
      email: user.email,
      password: user.password || 'TestPassword123!',
      remember_me: false,
      ...overrides
    };
  }

  /**
   * Create test task update data
   */
  static createTaskUpdateData(overrides: Partial<any> = {}) {
    return {
      title: `Updated Task ${Date.now()}`,
      description: 'Updated task description',
      priority: 'high',
      status: 'in_progress',
      ...overrides
    };
  }

  /**
   * Create test filter options
   */
  static createFilterOptions(overrides: Partial<any> = {}) {
    return {
      page: 1,
      limit: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
      ...overrides
    };
  }

  /**
   * Create mock database response
   */
  static createMockDbResponse<T>(data: T[], total?: number) {
    return {
      rows: data,
      rowCount: total || data.length,
      command: 'SELECT',
      fields: [],
      oid: 0
    };
  }

  /**
   * Create mock pagination response
   */
  static createMockPaginationResponse<T>(
    data: T[], 
    page: number = 1, 
    limit: number = 20, 
    total?: number
  ) {
    const totalCount = total || data.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Create a test user profile with optional overrides
   */
  static createUserProfile(overrides: Partial<TestUserProfile> = {}): TestUserProfile {
    const baseUserProfile: TestUserProfile = {
      id: testUtils.generateTestId(),
      email: `test.user.${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      bio: 'Test user bio',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      time_format: '24h',
      language_code: 'en',
      role: 'user' as UserRole,
      status: 'active' as UserStatus,
      email_verified: true,
      failed_login_attempts: 0,
      password_changed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      preferences: {
        theme: 'light',
        notifications: true
      },
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        due_date_reminders: true,
        task_assignments: true
      }
    };

    return { ...baseUserProfile, ...overrides };
  }
}

export default TestDataFactory;
