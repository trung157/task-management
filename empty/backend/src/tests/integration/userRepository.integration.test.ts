/**
 * User Repository Integration Tests
 * 
 * Integration tests that run against a real PostgreSQL database to test
 * the complete User repository functionality end-to-end.
 */

import { UserRepository, IUserRepository } from '../../repositories/userRepository';
import { CreateUserData, UpdateUserData } from '../../models/user';
import { connectDatabase, closeDatabase } from '../../db';
import pool from '../../db';

describe('UserRepository Integration Tests', () => {
  let userRepository: IUserRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
    userRepository = new UserRepository();
  });

  afterAll(async () => {
    // Clean up and close database connection
    if (testUserId) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      } catch (error) {
        console.warn('Failed to cleanup test user:', error);
      }
    }
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
  });

  describe('Complete User Lifecycle', () => {
    it('should handle complete user CRUD operations', async () => {
      // 1. Create User
      const userData: CreateUserData = {
        email: 'test-integration@example.com',
        password: 'SecurePassword123!',
        first_name: 'Integration',
        last_name: 'Test',
        timezone: 'America/New_York',
        language_code: 'en'
      };

      const createdUser = await userRepository.create(userData);
      testUserId = createdUser.id;

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.first_name).toBe(userData.first_name);
      expect(createdUser.last_name).toBe(userData.last_name);
      expect(createdUser.timezone).toBe(userData.timezone);
      expect(createdUser.role).toBe('user');
      expect(createdUser.status).toBe('pending_verification');
      expect(createdUser.email_verified).toBe(false);

      // 2. Find User by ID
      const foundUser = await userRepository.findById(testUserId);
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUserId);
      expect(foundUser!.email).toBe(userData.email);

      // 3. Find User by Email
      const foundByEmail = await userRepository.findByEmail(userData.email);
      expect(foundByEmail).toBeDefined();
      expect(foundByEmail!.id).toBe(testUserId);
      expect(foundByEmail!.email).toBe(userData.email);

      // 4. Update User
      const updateData: UpdateUserData = {
        first_name: 'Updated',
        bio: 'This is an updated bio',
        status: 'active',
        email_verified: true
      };

      const updatedUser = await userRepository.update(testUserId, updateData);
      expect(updatedUser.first_name).toBe('Updated');
      expect(updatedUser.bio).toBe('This is an updated bio');
      expect(updatedUser.status).toBe('active');
      expect(updatedUser.email_verified).toBe(true);

      // 5. Password Operations
      const passwordValid = await userRepository.verifyPassword(testUserId, 'SecurePassword123!');
      expect(passwordValid).toBe(true);

      const passwordInvalid = await userRepository.verifyPassword(testUserId, 'WrongPassword');
      expect(passwordInvalid).toBe(false);

      // Change password
      await userRepository.changePassword(testUserId, {
        current_password: 'SecurePassword123!',
        new_password: 'NewSecurePassword123!'
      });

      const newPasswordValid = await userRepository.verifyPassword(testUserId, 'NewSecurePassword123!');
      expect(newPasswordValid).toBe(true);

      const oldPasswordInvalid = await userRepository.verifyPassword(testUserId, 'SecurePassword123!');
      expect(oldPasswordInvalid).toBe(false);

      // 6. Account Management
      await userRepository.updateLoginInfo(testUserId, '192.168.1.100');

      // Verify user exists
      const exists = await userRepository.exists(testUserId);
      expect(exists).toBe(true);

      const existsByEmail = await userRepository.existsByEmail(userData.email);
      expect(existsByEmail).toBe(true);

      // 7. Soft Delete User
      await userRepository.delete(testUserId);

      // User should not be found after soft delete
      const deletedUser = await userRepository.findById(testUserId);
      expect(deletedUser).toBeNull();

      const existsAfterDelete = await userRepository.exists(testUserId);
      expect(existsAfterDelete).toBe(false);
    }, 30000);
  });

  describe('User Search and Filtering', () => {
    let testUserIds: string[] = [];

    beforeEach(async () => {
      // Create test users
      const testUsers: CreateUserData[] = [
        {
          email: 'test-search1@example.com',
          password: 'Password123!',
          first_name: 'Alice',
          last_name: 'Smith'
        },
        {
          email: 'test-search2@example.com',
          password: 'Password123!',
          first_name: 'Bob',
          last_name: 'Johnson'
        },
        {
          email: 'test-search3@example.com',
          password: 'Password123!',
          first_name: 'Charlie',
          last_name: 'Wilson'
        }
      ];

      for (const userData of testUsers) {
        const user = await userRepository.create(userData);
        testUserIds.push(user.id);
      }
    });

    afterEach(async () => {
      // Clean up test users
      for (const userId of testUserIds) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.warn('Failed to cleanup test user:', userId, error);
        }
      }
      testUserIds = [];
    });

    it('should list users with pagination', async () => {
      const result = await userRepository.list({}, { page: 1, limit: 2 });

      expect(result.users).toBeDefined();
      expect(result.users.length).toBeLessThanOrEqual(2);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('should search users by name', async () => {
      const result = await userRepository.search('Alice');

      expect(result.users).toBeDefined();
      expect(result.users.length).toBeGreaterThan(0);
      expect(result.users.some(user => user.first_name === 'Alice')).toBe(true);
    });

    it('should filter users by status', async () => {
      // Update one user to active status
      await userRepository.update(testUserIds[0], { status: 'active' });

      const result = await userRepository.list({ status: 'active' });

      expect(result.users).toBeDefined();
      expect(result.users.every(user => user.status === 'active')).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    let bulkUserIds: string[] = [];

    afterEach(async () => {
      // Clean up bulk test users
      for (const userId of bulkUserIds) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.warn('Failed to cleanup bulk test user:', userId, error);
        }
      }
      bulkUserIds = [];
    });

    it('should create multiple users in bulk', async () => {
      const bulkUsers: CreateUserData[] = [
        {
          email: 'test-bulk1@example.com',
          password: 'Password123!',
          first_name: 'Bulk',
          last_name: 'User1'
        },
        {
          email: 'test-bulk2@example.com',
          password: 'Password123!',
          first_name: 'Bulk',
          last_name: 'User2'
        },
        {
          email: 'test-bulk3@example.com',
          password: 'Password123!',
          first_name: 'Bulk',
          last_name: 'User3'
        }
      ];

      const createdUsers = await userRepository.createBulk(bulkUsers);
      bulkUserIds = createdUsers.map(user => user.id);

      expect(createdUsers).toHaveLength(3);
      expect(createdUsers[0].email).toBe('test-bulk1@example.com');
      expect(createdUsers[1].email).toBe('test-bulk2@example.com');
      expect(createdUsers[2].email).toBe('test-bulk3@example.com');

      // Verify users exist in database
      for (const user of createdUsers) {
        const foundUser = await userRepository.findById(user.id);
        expect(foundUser).toBeDefined();
        expect(foundUser!.email).toBe(user.email);
      }
    });

    it('should update multiple users in bulk', async () => {
      // First create users
      const bulkUsers: CreateUserData[] = [
        {
          email: 'test-bulk-update1@example.com',
          password: 'Password123!',
          first_name: 'Update',
          last_name: 'Test1'
        },
        {
          email: 'test-bulk-update2@example.com',
          password: 'Password123!',
          first_name: 'Update',
          last_name: 'Test2'
        }
      ];

      const createdUsers = await userRepository.createBulk(bulkUsers);
      bulkUserIds = createdUsers.map(user => user.id);

      // Now update them in bulk
      const updates = createdUsers.map(user => ({
        id: user.id,
        data: { bio: `Updated bio for ${user.first_name}`, status: 'active' as const }
      }));

      const updatedUsers = await userRepository.updateBulk(updates);

      expect(updatedUsers).toHaveLength(2);
      expect(updatedUsers[0].bio).toBe('Updated bio for Update');
      expect(updatedUsers[0].status).toBe('active');
      expect(updatedUsers[1].bio).toBe('Updated bio for Update');
      expect(updatedUsers[1].status).toBe('active');
    });
  });

  describe('Statistics and Analytics', () => {
    let statsTestUserIds: string[] = [];

    beforeEach(async () => {
      // Create test users with different statuses
      const testUsers: CreateUserData[] = [
        {
          email: 'test-stats-active@example.com',
          password: 'Password123!',
          first_name: 'Active',
          last_name: 'User'
        },
        {
          email: 'test-stats-inactive@example.com',
          password: 'Password123!',
          first_name: 'Inactive',
          last_name: 'User'
        }
      ];

      for (const userData of testUsers) {
        const user = await userRepository.create(userData);
        statsTestUserIds.push(user.id);
      }

      // Update statuses
      await userRepository.update(statsTestUserIds[0], { status: 'active' });
      await userRepository.update(statsTestUserIds[1], { status: 'inactive' });
    });

    afterEach(async () => {
      // Clean up stats test users
      for (const userId of statsTestUserIds) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
          console.warn('Failed to cleanup stats test user:', userId, error);
        }
      }
      statsTestUserIds = [];
    });

    it('should return user statistics', async () => {
      const stats = await userRepository.getUserStats();

      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.inactive).toBe('number');
      expect(typeof stats.created_today).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.active).toBeGreaterThanOrEqual(1);
      expect(stats.inactive).toBeGreaterThanOrEqual(1);
    });

    it('should return active users count', async () => {
      const activeCount = await userRepository.getActiveUsersCount();

      expect(typeof activeCount).toBe('number');
      expect(activeCount).toBeGreaterThanOrEqual(1);
    });

    it('should return users created today count', async () => {
      const todayCount = await userRepository.getUsersCreatedToday();

      expect(typeof todayCount).toBe('number');
      expect(todayCount).toBeGreaterThanOrEqual(2); // Our test users
    });
  });

  describe('Account Security', () => {
    let securityTestUserId: string;

    beforeEach(async () => {
      const userData: CreateUserData = {
        email: 'test-security@example.com',
        password: 'SecurePassword123!',
        first_name: 'Security',
        last_name: 'Test'
      };

      const user = await userRepository.create(userData);
      securityTestUserId = user.id;
    });

    afterEach(async () => {
      if (securityTestUserId) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [securityTestUserId]);
        } catch (error) {
          console.warn('Failed to cleanup security test user:', error);
        }
      }
    });

    it('should handle failed login attempts and account locking', async () => {
      const email = 'test-security@example.com';

      // Initially account should not be locked
      let isLocked = await userRepository.isAccountLocked(email);
      expect(isLocked).toBe(false);

      // Increment failed login attempts multiple times
      for (let i = 0; i < 5; i++) {
        await userRepository.incrementFailedLoginAttempts(email);
      }

      // Account should now be locked
      isLocked = await userRepository.isAccountLocked(email);
      expect(isLocked).toBe(true);

      // Unlock the account
      await userRepository.unlockAccount(email);

      // Account should no longer be locked
      isLocked = await userRepository.isAccountLocked(email);
      expect(isLocked).toBe(false);
    });
  });
});
