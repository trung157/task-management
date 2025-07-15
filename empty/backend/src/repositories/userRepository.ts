/**
 * User Repository - Advanced Repository Pattern Implementation
 * 
 * This repository provides a clean abstraction layer over the UserModel,
 * implementing the Repository pattern for better separation of concerns,
 * testability, and code organization.
 */

import {
  UserModel,
  User,
  UserProfile,
  CreateUserData,
  UpdateUserData,
  ChangePasswordData,
  UserSearchFilters,
  PaginationOptions,
  UserListResponse
} from '../models/user';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import pool from '../db';

/**
 * Repository interface for User operations
 */
export interface IUserRepository {
  // CRUD Operations
  create(userData: CreateUserData): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, updateData: UpdateUserData): Promise<UserProfile>;
  delete(id: string): Promise<void>;
  
  // List and Search
  list(filters?: UserSearchFilters, pagination?: PaginationOptions): Promise<UserListResponse>;
  search(query: string, pagination?: PaginationOptions): Promise<UserListResponse>;
  
  // Authentication
  verifyPassword(id: string, password: string): Promise<boolean>;
  changePassword(id: string, passwordData: ChangePasswordData): Promise<void>;
  
  // Account Management
  updateLoginInfo(id: string, ipAddress?: string): Promise<void>;
  incrementFailedLoginAttempts(email: string): Promise<void>;
  isAccountLocked(email: string): Promise<boolean>;
  unlockAccount(email: string): Promise<void>;
  
  // Bulk Operations
  createBulk(users: CreateUserData[]): Promise<UserProfile[]>;
  updateBulk(updates: { id: string; data: UpdateUserData }[]): Promise<UserProfile[]>;
  deleteBulk(ids: string[]): Promise<void>;
  
  // Analytics and Statistics
  getUserStats(): Promise<UserStats>;
  getActiveUsersCount(): Promise<number>;
  getUsersCreatedToday(): Promise<number>;
  
  // Utility Methods
  exists(id: string): Promise<boolean>;
  existsByEmail(email: string): Promise<boolean>;
  sanitizeUser(user: User): UserProfile;
}

/**
 * User statistics interface
 */
export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  pending_verification: number;
  verified: number;
  locked: number;
  admins: number;
  regular_users: number;
  created_today: number;
  created_this_week: number;
  created_this_month: number;
  last_login_today: number;
}

/**
 * User Repository Implementation
 * 
 * Implements the Repository pattern for User entities, providing a clean
 * abstraction over the UserModel with additional utility methods.
 */
export class UserRepository implements IUserRepository {
  
  // =====================================================
  // CRUD Operations
  // =====================================================
  
  /**
   * Create a new user
   */
  async create(userData: CreateUserData): Promise<UserProfile> {
    try {
      logger.info('UserRepository: Creating new user', { email: userData.email });
      return await UserModel.create(userData);
    } catch (error) {
      logger.error('UserRepository: Failed to create user', { error, userData });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserProfile | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      logger.error('UserRepository: Failed to find user by ID', { error, id });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await UserModel.findByEmail(email);
    } catch (error) {
      logger.error('UserRepository: Failed to find user by email', { error, email });
      throw error;
    }
  }

  /**
   * Update user data
   */
  async update(id: string, updateData: UpdateUserData): Promise<UserProfile> {
    try {
      logger.info('UserRepository: Updating user', { id, fields: Object.keys(updateData) });
      return await UserModel.update(id, updateData);
    } catch (error) {
      logger.error('UserRepository: Failed to update user', { error, id, updateData });
      throw error;
    }
  }

  /**
   * Soft delete user
   */
  async delete(id: string): Promise<void> {
    try {
      logger.info('UserRepository: Deleting user', { id });
      await UserModel.delete(id);
    } catch (error) {
      logger.error('UserRepository: Failed to delete user', { error, id });
      throw error;
    }
  }

  // =====================================================
  // List and Search Operations
  // =====================================================

  /**
   * List users with filtering and pagination
   */
  async list(filters: UserSearchFilters = {}, pagination: PaginationOptions = {}): Promise<UserListResponse> {
    try {
      return await UserModel.list(filters, pagination);
    } catch (error) {
      logger.error('UserRepository: Failed to list users', { error, filters, pagination });
      throw error;
    }
  }

  /**
   * Search users by query string
   */
  async search(query: string, pagination: PaginationOptions = {}): Promise<UserListResponse> {
    try {
      const filters: UserSearchFilters = { search: query };
      return await UserModel.list(filters, pagination);
    } catch (error) {
      logger.error('UserRepository: Failed to search users', { error, query, pagination });
      throw error;
    }
  }

  // =====================================================
  // Authentication Operations
  // =====================================================

  /**
   * Verify user password
   */
  async verifyPassword(id: string, password: string): Promise<boolean> {
    try {
      return await UserModel.verifyPassword(id, password);
    } catch (error) {
      logger.error('UserRepository: Failed to verify password', { error, id });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(id: string, passwordData: ChangePasswordData): Promise<void> {
    try {
      logger.info('UserRepository: Changing password', { id });
      await UserModel.changePassword(id, passwordData);
    } catch (error) {
      logger.error('UserRepository: Failed to change password', { error, id });
      throw error;
    }
  }

  // =====================================================
  // Account Management Operations
  // =====================================================

  /**
   * Update login information
   */
  async updateLoginInfo(id: string, ipAddress?: string): Promise<void> {
    try {
      await UserModel.updateLoginInfo(id, ipAddress);
    } catch (error) {
      logger.error('UserRepository: Failed to update login info', { error, id });
      throw error;
    }
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLoginAttempts(email: string): Promise<void> {
    try {
      await UserModel.incrementFailedLoginAttempts(email);
    } catch (error) {
      logger.error('UserRepository: Failed to increment failed login attempts', { error, email });
      throw error;
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(email: string): Promise<boolean> {
    try {
      return await UserModel.isAccountLocked(email);
    } catch (error) {
      logger.error('UserRepository: Failed to check account lock status', { error, email });
      throw error;
    }
  }

  /**
   * Unlock user account
   */
  async unlockAccount(email: string): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET failed_login_attempts = 0, 
            locked_until = NULL, 
            updated_at = NOW()
        WHERE email = $1
      `, [email.toLowerCase().trim()]);

      if (result.rowCount === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      logger.info('UserRepository: Account unlocked successfully', { email });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UserRepository: Failed to unlock account', { error, email });
      throw new AppError('Failed to unlock account', 500, 'UNLOCK_FAILED');
    }
  }

  // =====================================================
  // Bulk Operations
  // =====================================================

  /**
   * Create multiple users in a transaction
   */
  async createBulk(users: CreateUserData[]): Promise<UserProfile[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const createdUsers: UserProfile[] = [];
      for (const userData of users) {
        const user = await UserModel.create(userData);
        createdUsers.push(user);
      }
      
      await client.query('COMMIT');
      logger.info('UserRepository: Bulk user creation completed', { count: users.length });
      
      return createdUsers;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('UserRepository: Bulk user creation failed', { error, userCount: users.length });
      throw new AppError('Bulk user creation failed', 500, 'BULK_CREATE_FAILED');
    } finally {
      client.release();
    }
  }

  /**
   * Update multiple users in a transaction
   */
  async updateBulk(updates: { id: string; data: UpdateUserData }[]): Promise<UserProfile[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updatedUsers: UserProfile[] = [];
      for (const { id, data } of updates) {
        const user = await UserModel.update(id, data);
        updatedUsers.push(user);
      }
      
      await client.query('COMMIT');
      logger.info('UserRepository: Bulk user update completed', { count: updates.length });
      
      return updatedUsers;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('UserRepository: Bulk user update failed', { error, updateCount: updates.length });
      throw new AppError('Bulk user update failed', 500, 'BULK_UPDATE_FAILED');
    } finally {
      client.release();
    }
  }

  /**
   * Delete multiple users (soft delete)
   */
  async deleteBulk(ids: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const id of ids) {
        await UserModel.delete(id);
      }
      
      await client.query('COMMIT');
      logger.info('UserRepository: Bulk user deletion completed', { count: ids.length });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('UserRepository: Bulk user deletion failed', { error, idCount: ids.length });
      throw new AppError('Bulk user deletion failed', 500, 'BULK_DELETE_FAILED');
    } finally {
      client.release();
    }
  }

  // =====================================================
  // Analytics and Statistics
  // =====================================================

  /**
   * Get comprehensive user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
          COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL) as active,
          COUNT(*) FILTER (WHERE status = 'inactive' AND deleted_at IS NULL) as inactive,
          COUNT(*) FILTER (WHERE status = 'suspended' AND deleted_at IS NULL) as suspended,
          COUNT(*) FILTER (WHERE status = 'pending_verification' AND deleted_at IS NULL) as pending_verification,
          COUNT(*) FILTER (WHERE email_verified = true AND deleted_at IS NULL) as verified,
          COUNT(*) FILTER (WHERE locked_until > NOW() AND deleted_at IS NULL) as locked,
          COUNT(*) FILTER (WHERE role IN ('admin', 'super_admin') AND deleted_at IS NULL) as admins,
          COUNT(*) FILTER (WHERE role = 'user' AND deleted_at IS NULL) as regular_users,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL) as created_today,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL) as created_this_week,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND deleted_at IS NULL) as created_this_month,
          COUNT(*) FILTER (WHERE last_login_at >= CURRENT_DATE AND deleted_at IS NULL) as last_login_today
        FROM users
      `);

      return {
        total: parseInt(result.rows[0].total) || 0,
        active: parseInt(result.rows[0].active) || 0,
        inactive: parseInt(result.rows[0].inactive) || 0,
        suspended: parseInt(result.rows[0].suspended) || 0,
        pending_verification: parseInt(result.rows[0].pending_verification) || 0,
        verified: parseInt(result.rows[0].verified) || 0,
        locked: parseInt(result.rows[0].locked) || 0,
        admins: parseInt(result.rows[0].admins) || 0,
        regular_users: parseInt(result.rows[0].regular_users) || 0,
        created_today: parseInt(result.rows[0].created_today) || 0,
        created_this_week: parseInt(result.rows[0].created_this_week) || 0,
        created_this_month: parseInt(result.rows[0].created_this_month) || 0,
        last_login_today: parseInt(result.rows[0].last_login_today) || 0
      };
    } catch (error) {
      logger.error('UserRepository: Failed to get user stats', { error });
      throw new AppError('Failed to get user statistics', 500, 'STATS_FAILED');
    }
  }

  /**
   * Get count of active users
   */
  async getActiveUsersCount(): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE status = 'active' AND deleted_at IS NULL
      `);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('UserRepository: Failed to get active users count', { error });
      throw new AppError('Failed to get active users count', 500, 'COUNT_FAILED');
    }
  }

  /**
   * Get count of users created today
   */
  async getUsersCreatedToday(): Promise<number> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL
      `);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('UserRepository: Failed to get users created today', { error });
      throw new AppError('Failed to get users created today', 500, 'COUNT_FAILED');
    }
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  /**
   * Check if user exists by ID
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('UserRepository: Failed to check user existence', { error, id });
      return false;
    }
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
        [email.toLowerCase().trim()]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('UserRepository: Failed to check user existence by email', { error, email });
      return false;
    }
  }

  /**
   * Sanitize user object (remove sensitive fields)
   */
  sanitizeUser(user: User): UserProfile {
    const {
      password_hash,
      failed_login_attempts,
      locked_until,
      last_login_ip,
      deleted_at,
      ...sanitizedUser
    } = user;

    return sanitizedUser as UserProfile;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
export default userRepository;
