/**
 * User Repository Test Suite
 * 
 * Comprehensive tests for the UserRepository class, covering all CRUD operations,
 * authentication methods, bulk operations, and statistics.
 */

import { UserRepository, IUserRepository, UserStats } from '../../repositories/userRepository';
import { UserModel, CreateUserData, UpdateUserData, UserProfile } from '../../models/user';
import { AppError } from '../../middleware/errorHandler';
import pool from '../../db';

// Mock dependencies
jest.mock('../../db');
jest.mock('../../models/user');
jest.mock('../../utils/logger');

describe('UserRepository', () => {
  let userRepository: IUserRepository;
  let mockPool: jest.Mocked<any>;
  let mockUserModel: jest.Mocked<typeof UserModel>;

  beforeEach(() => {
    userRepository = new UserRepository();
    mockPool = pool as jest.Mocked<any>;
    mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a new user successfully', async () => {
        const userData: CreateUserData = {
          email: 'test@example.com',
          password: 'StrongPassword123!',
          first_name: 'John',
          last_name: 'Doe',
          timezone: 'UTC',
          language_code: 'en'
        };

        const expectedUser: UserProfile = {
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          display_name: 'John Doe',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
          language_code: 'en',
          role: 'user',
          status: 'pending_verification',
          email_verified: false,
          preferences: {},
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            due_date_reminders: true,
            task_assignments: true
          },
          created_at: new Date(),
          updated_at: new Date()
        };

        mockUserModel.create.mockResolvedValue(expectedUser);

        const result = await userRepository.create(userData);

        expect(mockUserModel.create).toHaveBeenCalledWith(userData);
        expect(result).toEqual(expectedUser);
      });

      it('should handle user creation errors', async () => {
        const userData: CreateUserData = {
          email: 'test@example.com',
          password: 'StrongPassword123!',
          first_name: 'John',
          last_name: 'Doe'
        };

        const error = new AppError('User already exists', 409, 'USER_EXISTS');
        mockUserModel.create.mockRejectedValue(error);

        await expect(userRepository.create(userData)).rejects.toThrow(error);
      });
    });

    describe('findById', () => {
      it('should find user by ID successfully', async () => {
        const userId = 'user-123';
        const expectedUser: UserProfile = {
          id: userId,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          display_name: 'John Doe',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
          language_code: 'en',
          role: 'user',
          status: 'active',
          email_verified: true,
          preferences: {},
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            due_date_reminders: true,
            task_assignments: true
          },
          created_at: new Date(),
          updated_at: new Date()
        };

        mockUserModel.findById.mockResolvedValue(expectedUser);

        const result = await userRepository.findById(userId);

        expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
        expect(result).toEqual(expectedUser);
      });

      it('should return null when user not found', async () => {
        const userId = 'non-existent-user';
        mockUserModel.findById.mockResolvedValue(null);

        const result = await userRepository.findById(userId);

        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update user successfully', async () => {
        const userId = 'user-123';
        const updateData: UpdateUserData = {
          first_name: 'Jane',
          timezone: 'America/New_York'
        };

        const updatedUser: UserProfile = {
          id: userId,
          email: 'test@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          display_name: 'Jane Doe',
          timezone: 'America/New_York',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
          language_code: 'en',
          role: 'user',
          status: 'active',
          email_verified: true,
          preferences: {},
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            due_date_reminders: true,
            task_assignments: true
          },
          created_at: new Date(),
          updated_at: new Date()
        };

        mockUserModel.update.mockResolvedValue(updatedUser);

        const result = await userRepository.update(userId, updateData);

        expect(mockUserModel.update).toHaveBeenCalledWith(userId, updateData);
        expect(result).toEqual(updatedUser);
      });
    });

    describe('delete', () => {
      it('should delete user successfully', async () => {
        const userId = 'user-123';
        mockUserModel.delete.mockResolvedValue();

        await userRepository.delete(userId);

        expect(mockUserModel.delete).toHaveBeenCalledWith(userId);
      });
    });
  });

  describe('Authentication Operations', () => {
    describe('verifyPassword', () => {
      it('should verify password successfully', async () => {
        const userId = 'user-123';
        const password = 'StrongPassword123!';

        mockUserModel.verifyPassword.mockResolvedValue(true);

        const result = await userRepository.verifyPassword(userId, password);

        expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(userId, password);
        expect(result).toBe(true);
      });

      it('should return false for invalid password', async () => {
        const userId = 'user-123';
        const password = 'WrongPassword';

        mockUserModel.verifyPassword.mockResolvedValue(false);

        const result = await userRepository.verifyPassword(userId, password);

        expect(result).toBe(false);
      });
    });

    describe('changePassword', () => {
      it('should change password successfully', async () => {
        const userId = 'user-123';
        const passwordData = {
          current_password: 'OldPassword123!',
          new_password: 'NewPassword123!'
        };

        mockUserModel.changePassword.mockResolvedValue();

        await userRepository.changePassword(userId, passwordData);

        expect(mockUserModel.changePassword).toHaveBeenCalledWith(userId, passwordData);
      });
    });
  });

  describe('Account Management', () => {
    describe('unlockAccount', () => {
      it('should unlock account successfully', async () => {
        const email = 'test@example.com';
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rowCount: 1 })
        };

        mockPool.query.mockResolvedValue({ rowCount: 1 } as any);

        await userRepository.unlockAccount(email);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          [email.toLowerCase()]
        );
      });

      it('should throw error when user not found', async () => {
        const email = 'nonexistent@example.com';
        mockPool.query.mockResolvedValue({ rowCount: 0 } as any);

        await expect(userRepository.unlockAccount(email)).rejects.toThrow(
          new AppError('User not found', 404, 'USER_NOT_FOUND')
        );
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('createBulk', () => {
      it('should create multiple users in transaction', async () => {
        const users: CreateUserData[] = [
          {
            email: 'user1@example.com',
            password: 'Password123!',
            first_name: 'User',
            last_name: 'One'
          },
          {
            email: 'user2@example.com',
            password: 'Password123!',
            first_name: 'User',
            last_name: 'Two'
          }
        ];

        const mockClient = {
          query: jest.fn(),
          release: jest.fn()
        };

        mockPool.connect.mockResolvedValue(mockClient as any);

        const expectedUsers = users.map((user, index) => ({
          id: `user-${index + 1}`,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: `${user.first_name} ${user.last_name}`,
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
          language_code: 'en',
          role: 'user' as const,
          status: 'pending_verification' as const,
          email_verified: false,
          preferences: {},
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            due_date_reminders: true,
            task_assignments: true
          },
          created_at: new Date(),
          updated_at: new Date()
        }));

        mockUserModel.create
          .mockResolvedValueOnce(expectedUsers[0])
          .mockResolvedValueOnce(expectedUsers[1]);

        const result = await userRepository.createBulk(users);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockUserModel.create).toHaveBeenCalledTimes(2);
        expect(result).toEqual(expectedUsers);
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should rollback transaction on error', async () => {
        const users: CreateUserData[] = [
          {
            email: 'user1@example.com',
            password: 'Password123!',
            first_name: 'User',
            last_name: 'One'
          }
        ];

        const mockClient = {
          query: jest.fn(),
          release: jest.fn()
        };

        mockPool.connect.mockResolvedValue(mockClient as any);
        mockUserModel.create.mockRejectedValue(new Error('Database error'));

        await expect(userRepository.createBulk(users)).rejects.toThrow(
          new AppError('Bulk user creation failed', 500, 'BULK_CREATE_FAILED')
        );

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
      });
    });
  });

  describe('Statistics', () => {
    describe('getUserStats', () => {
      it('should return comprehensive user statistics', async () => {
        const mockStats = {
          total: '100',
          active: '80',
          inactive: '15',
          suspended: '3',
          pending_verification: '2',
          verified: '85',
          locked: '1',
          admins: '5',
          regular_users: '95',
          created_today: '10',
          created_this_week: '25',
          created_this_month: '40',
          last_login_today: '30'
        };

        mockPool.query.mockResolvedValue({ rows: [mockStats] } as any);

        const result = await userRepository.getUserStats();

        const expectedStats: UserStats = {
          total: 100,
          active: 80,
          inactive: 15,
          suspended: 3,
          pending_verification: 2,
          verified: 85,
          locked: 1,
          admins: 5,
          regular_users: 95,
          created_today: 10,
          created_this_week: 25,
          created_this_month: 40,
          last_login_today: 30
        };

        expect(result).toEqual(expectedStats);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT')
        );
      });
    });

    describe('getActiveUsersCount', () => {
      it('should return active users count', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '75' }] } as any);

        const result = await userRepository.getActiveUsersCount();

        expect(result).toBe(75);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("WHERE status = 'active'")
        );
      });
    });
  });

  describe('Utility Methods', () => {
    describe('exists', () => {
      it('should return true when user exists', async () => {
        const userId = 'user-123';
        mockPool.query.mockResolvedValue({ rows: [{ id: userId }] } as any);

        const result = await userRepository.exists(userId);

        expect(result).toBe(true);
      });

      it('should return false when user does not exist', async () => {
        const userId = 'non-existent';
        mockPool.query.mockResolvedValue({ rows: [] } as any);

        const result = await userRepository.exists(userId);

        expect(result).toBe(false);
      });
    });

    describe('existsByEmail', () => {
      it('should return true when user exists by email', async () => {
        const email = 'test@example.com';
        mockPool.query.mockResolvedValue({ rows: [{ email }] } as any);

        const result = await userRepository.existsByEmail(email);

        expect(result).toBe(true);
      });

      it('should return false when user does not exist by email', async () => {
        const email = 'nonexistent@example.com';
        mockPool.query.mockResolvedValue({ rows: [] } as any);

        const result = await userRepository.existsByEmail(email);

        expect(result).toBe(false);
      });
    });

    describe('sanitizeUser', () => {
      it('should remove sensitive fields from user object', async () => {
        const user = {
          id: 'user-123',
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Doe',
          display_name: 'John Doe',
          timezone: 'UTC',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
          language_code: 'en',
          role: 'user' as const,
          status: 'active' as const,
          email_verified: true,
          preferences: {},
          notification_settings: {
            email_notifications: true,
            push_notifications: true,
            due_date_reminders: true,
            task_assignments: true
          },
          failed_login_attempts: 0,
          locked_until: null,
          last_login_ip: '192.168.1.1',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        };

        const result = userRepository.sanitizeUser(user as any);

        expect(result).not.toHaveProperty('password_hash');
        expect(result).not.toHaveProperty('failed_login_attempts');
        expect(result).not.toHaveProperty('locked_until');
        expect(result).not.toHaveProperty('last_login_ip');
        expect(result).not.toHaveProperty('deleted_at');
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('first_name');
      });
    });
  });
});
