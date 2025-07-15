import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import config from '../config/config';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { PasswordValidator } from '../validators/passwordValidator';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export interface User {
  id: string;
  email: string;
  password_hash: string;
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
  password_changed_at: Date;
  failed_login_attempts: number;
  locked_until?: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  preferences: Record<string, any>;
  notification_settings: NotificationSettings;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  due_date_reminders: boolean;
  task_assignments: boolean;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  language_code?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  language_code?: string;
  role?: UserRole;
  status?: UserStatus;
  email_verified?: boolean;
  email_verified_at?: Date;
  failed_login_attempts?: number;
  locked_until?: Date | null;
  preferences?: Record<string, any>;
  notification_settings?: Partial<NotificationSettings>;
}

export interface ChangePasswordData {
  current_password?: string;
  new_password: string;
}

export interface UserProfile {
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
  last_login_at?: Date;
  preferences: Record<string, any>;
  notification_settings: NotificationSettings;
  created_at: Date;
  updated_at: Date;
}

export interface UserSearchFilters {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  email_verified?: boolean;
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: UserProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// =====================================================
// USER MODEL CLASS
// =====================================================

export class UserModel {
  /**
   * Create a new user with password hashing and validation
   */
  static async create(userData: CreateUserData): Promise<UserProfile> {
    const { email, password, first_name, last_name, timezone, language_code, role } = userData;

    // Validate input data
    await this.validateCreateData(userData);

    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
    }

    // Hash password
    const password_hash = await this.hashPassword(password);

    // Generate user ID
    const userId = uuidv4();

    try {
      const result = await pool.query(`
        INSERT INTO users (
          id, email, password_hash, first_name, last_name,
          timezone, language_code, role, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [
        userId,
        email.toLowerCase().trim(),
        password_hash,
        first_name.trim(),
        last_name.trim(),
        timezone || 'UTC',
        language_code || 'en',
        role || 'user'
      ]);

      const user = result.rows[0];

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to create user', { error, email });
      throw new AppError('Failed to create user', 500, 'USER_CREATION_FAILED');
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<UserProfile | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      return result.rows.length > 0 ? this.sanitizeUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find user by ID', { error, id });
      throw new AppError('Failed to retrieve user', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
        [email.toLowerCase().trim()]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Failed to find user by email', { error, email });
      throw new AppError('Failed to retrieve user', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Update user data
   */
  static async update(id: string, updateData: UpdateUserData): Promise<UserProfile> {
    // Validate update data
    await this.validateUpdateData(updateData);

    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await this.findByEmail(updateData.email);
      if (emailExists) {
        throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
      }
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'email') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value.toLowerCase().trim());
        } else if (typeof value === 'string') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value.trim());
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return existingUser;
    }

    // Add updated_at field
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    // Add user ID for WHERE clause
    values.push(id);

    try {
      const result = await pool.query(`
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      logger.info('User updated successfully', { userId: id, fields: Object.keys(updateData) });

      return this.sanitizeUser(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update user', { error, userId: id });
      throw new AppError('Failed to update user', 500, 'UPDATE_FAILED');
    }
  }

  /**
   * Change user password with validation
   */
  static async changePassword(id: string, passwordData: ChangePasswordData): Promise<void> {
    const { current_password, new_password } = passwordData;

    // Get user with password hash
    const user = await this.findByEmail((await this.findById(id))?.email || '');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify current password if provided (skip for admin resets)
    if (current_password) {
      const isCurrentPasswordValid = await this.comparePassword(current_password, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }
    }

    // Validate new password strength
    const passwordStrength = PasswordValidator.calculateStrength(new_password);
    if (passwordStrength.level === 'Very Weak' || passwordStrength.level === 'Weak') {
      throw new AppError(`New password is too weak: ${passwordStrength.feedback.join(', ')}`, 400, 'WEAK_PASSWORD');
    }

    // Hash new password
    const new_password_hash = await this.hashPassword(new_password);

    try {
      await pool.query(`
        UPDATE users 
        SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [new_password_hash, id]);

      logger.info('Password changed successfully', { userId: id });
    } catch (error) {
      logger.error('Failed to change password', { error, userId: id });
      throw new AppError('Failed to change password', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  /**
   * Soft delete user
   */
  static async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    try {
      await pool.query(`
        UPDATE users 
        SET deleted_at = NOW(), updated_at = NOW(), status = 'inactive'
        WHERE id = $1
      `, [id]);

      logger.info('User soft deleted', { userId: id });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: id });
      throw new AppError('Failed to delete user', 500, 'DELETE_FAILED');
    }
  }

  /**
   * List users with filtering and pagination
   */
  static async list(
    filters: UserSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<UserListResponse> {
    const {
      search,
      role,
      status,
      email_verified,
      created_after,
      created_before,
      last_login_after,
      last_login_before
    } = filters;

    const {
      page = 1,
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(
        email ILIKE $${paramCount} OR 
        first_name ILIKE $${paramCount} OR 
        last_name ILIKE $${paramCount} OR
        display_name ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      conditions.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (email_verified !== undefined) {
      conditions.push(`email_verified = $${paramCount}`);
      values.push(email_verified);
      paramCount++;
    }

    if (created_after) {
      conditions.push(`created_at >= $${paramCount}`);
      values.push(created_after);
      paramCount++;
    }

    if (created_before) {
      conditions.push(`created_at <= $${paramCount}`);
      values.push(created_before);
      paramCount++;
    }

    if (last_login_after) {
      conditions.push(`last_login_at >= $${paramCount}`);
      values.push(last_login_after);
      paramCount++;
    }

    if (last_login_before) {
      conditions.push(`last_login_at <= $${paramCount}`);
      values.push(last_login_before);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) as total FROM users ${whereClause}
      `, values);

      const total = parseInt(countResult.rows[0].total, 10);
      const pages = Math.ceil(total / limit);

      // Get users
      const result = await pool.query(`
        SELECT * FROM users 
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order.toUpperCase()}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]);

      const users = result.rows.map(user => this.sanitizeUser(user));

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      };
    } catch (error) {
      logger.error('Failed to list users', { error, filters, pagination });
      throw new AppError('Failed to retrieve users', 500, 'LIST_FAILED');
    }
  }

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Verify password against hash
   */
  static async verifyPassword(id: string, password: string): Promise<boolean> {
    const user = await this.findByEmail((await this.findById(id))?.email || '');
    if (!user) {
      return false;
    }

    return this.comparePassword(password, user.password_hash);
  }

  /**
   * Update login information
   */
  static async updateLoginInfo(id: string, ipAddress?: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE users 
        SET last_login_at = NOW(), 
            last_login_ip = $1,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = $2
      `, [ipAddress, id]);

      logger.info('Login info updated', { userId: id, ipAddress });
    } catch (error) {
      logger.error('Failed to update login info', { error, userId: id });
    }
  }

  /**
   * Increment failed login attempts
   */
  static async incrementFailedLoginAttempts(email: string): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
              ELSE locked_until
            END,
            updated_at = NOW()
        WHERE email = $1
        RETURNING failed_login_attempts, locked_until
      `, [email.toLowerCase().trim()]);

      if (result.rows.length > 0) {
        const { failed_login_attempts, locked_until } = result.rows[0];
        logger.warn('Failed login attempt recorded', {
          email,
          attempts: failed_login_attempts,
          locked_until
        });
      }
    } catch (error) {
      logger.error('Failed to increment login attempts', { error, email });
    }
  }

  /**
   * Check if user account is locked
   */
  static async isAccountLocked(email: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        SELECT locked_until FROM users 
        WHERE email = $1 AND locked_until > NOW()
      `, [email.toLowerCase().trim()]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check account lock status', { error, email });
      return false;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Hash password using bcrypt
   */
  private static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  /**
   * Compare password with hash
   */
  private static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Remove sensitive fields from user object
   */
  private static sanitizeUser(user: User): UserProfile {
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

  /**
   * Validate create user data
   */
  private static async validateCreateData(data: CreateUserData): Promise<void> {
    const { email, password, first_name, last_name } = data;

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Validate password strength
    const passwordStrength = PasswordValidator.calculateStrength(password);
    if (passwordStrength.level === 'Very Weak' || passwordStrength.level === 'Weak') {
      throw new AppError(`Password validation failed: ${passwordStrength.feedback.join(', ')}`, 400, 'WEAK_PASSWORD');
    }

    // Validate names
    if (!first_name || first_name.trim().length === 0) {
      throw new AppError('First name is required', 400, 'MISSING_FIRST_NAME');
    }

    if (!last_name || last_name.trim().length === 0) {
      throw new AppError('Last name is required', 400, 'MISSING_LAST_NAME');
    }

    if (first_name.trim().length > 100) {
      throw new AppError('First name must be less than 100 characters', 400, 'FIRST_NAME_TOO_LONG');
    }

    if (last_name.trim().length > 100) {
      throw new AppError('Last name must be less than 100 characters', 400, 'LAST_NAME_TOO_LONG');
    }
  }

  /**
   * Validate update user data
   */
  private static async validateUpdateData(data: UpdateUserData): Promise<void> {
    if (data.email) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(data.email)) {
        throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
      }
    }

    if (data.first_name !== undefined) {
      if (!data.first_name || data.first_name.trim().length === 0) {
        throw new AppError('First name cannot be empty', 400, 'INVALID_FIRST_NAME');
      }
      if (data.first_name.trim().length > 100) {
        throw new AppError('First name must be less than 100 characters', 400, 'FIRST_NAME_TOO_LONG');
      }
    }

    if (data.last_name !== undefined) {
      if (!data.last_name || data.last_name.trim().length === 0) {
        throw new AppError('Last name cannot be empty', 400, 'INVALID_LAST_NAME');
      }
      if (data.last_name.trim().length > 100) {
        throw new AppError('Last name must be less than 100 characters', 400, 'LAST_NAME_TOO_LONG');
      }
    }

    if (data.bio && data.bio.length > 500) {
      throw new AppError('Bio must be less than 500 characters', 400, 'BIO_TOO_LONG');
    }

    if (data.timezone && !this.isValidTimezone(data.timezone)) {
      throw new AppError('Invalid timezone', 400, 'INVALID_TIMEZONE');
    }
  }

  /**
   * Check if timezone is valid
   */
  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}

// =====================================================
// LEGACY INTERFACES (for backward compatibility)
// =====================================================

export interface CreateUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserProfile;
  token: string;
  refreshToken: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}
