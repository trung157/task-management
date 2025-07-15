import { UserModel, User, UserProfile, CreateUserData, UpdateUserData, ChangePasswordData } from '../models/user';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PasswordValidator } from '../validators/passwordValidator';

/**
 * User registration data interface
 */
export interface RegisterUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  language_code?: string;
}

/**
 * User profile update data interface
 */
export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  language_code?: string;
}

/**
 * User preferences update data interface
 */
export interface UpdatePreferencesData {
  preferences?: Record<string, any>;
  notification_settings?: {
    email_notifications?: boolean;
    push_notifications?: boolean;
    due_date_reminders?: boolean;
    task_assignments?: boolean;
  };
}

/**
 * User search/filter options interface
 */
export interface UserFilterOptions {
  search?: string;
  role?: string | string[];
  status?: string | string[];
  email_verified?: boolean;
  created_from?: Date;
  created_to?: Date;
  last_login_from?: Date;
  last_login_to?: Date;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'last_login_at' | 'email' | 'first_name' | 'last_name';
  sort_order?: 'asc' | 'desc';
}

/**
 * User statistics interface
 */
export interface UserStatistics {
  total_users: number;
  active_users: number;
  verified_users: number;
  admin_users: number;
  users_by_status: {
    active: number;
    inactive: number;
    suspended: number;
    pending_verification: number;
  };
  users_by_role: {
    user: number;
    admin: number;
    super_admin: number;
  };
  recent_registrations: number; // Last 30 days
  recent_logins: number; // Last 7 days
}

/**
 * Comprehensive User service class providing user management functionality
 */
export class UserService {
  /**
   * Register a new user
   */
  static async registerUser(userData: RegisterUserData): Promise<UserProfile> {
    try {
      logger.info('Registering new user', { email: userData.email });

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(userData.password);
      if (!passwordValidation.isValid) {
        throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Create user
      const createData: CreateUserData = {
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        first_name: userData.first_name.trim(),
        last_name: userData.last_name.trim(),
        timezone: userData.timezone || 'UTC',
        language_code: userData.language_code || 'en'
      };

      const user = await UserModel.create(createData);
      
      logger.info('User registered successfully', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.error('Error registering user', { error, email: userData.email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to register user', 500);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserProfile> {
    try {
      const user = await UserModel.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error fetching user by ID', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch user', 500);
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User> {
    try {
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error fetching user by email', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch user', 500);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, profileData: UpdateProfileData): Promise<UserProfile> {
    try {
      logger.info(`Updating profile for user ${userId}`, { profileData });

      // Verify user exists
      await this.getUserById(userId);

      // Validate input data
      if (profileData.first_name !== undefined && profileData.first_name.trim().length === 0) {
        throw new AppError('First name cannot be empty', 400);
      }

      if (profileData.last_name !== undefined && profileData.last_name.trim().length === 0) {
        throw new AppError('Last name cannot be empty', 400);
      }

      if (profileData.timezone && !this.isValidTimezone(profileData.timezone)) {
        throw new AppError('Invalid timezone', 400);
      }

      if (profileData.language_code && !this.isValidLanguageCode(profileData.language_code)) {
        throw new AppError('Invalid language code', 400);
      }

      // Prepare update data
      const updateData: UpdateUserData = {};
      
      if (profileData.first_name) updateData.first_name = profileData.first_name.trim();
      if (profileData.last_name) updateData.last_name = profileData.last_name.trim();
      if (profileData.avatar_url !== undefined) updateData.avatar_url = profileData.avatar_url;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      if (profileData.timezone) updateData.timezone = profileData.timezone;
      if (profileData.date_format) updateData.date_format = profileData.date_format;
      if (profileData.time_format) updateData.time_format = profileData.time_format;
      if (profileData.language_code) updateData.language_code = profileData.language_code;

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('User profile updated successfully', { userId });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile', { error, userId, profileData });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update profile', 500);
    }
  }

  /**
   * Update user preferences and notification settings
   */
  static async updatePreferences(userId: string, preferencesData: UpdatePreferencesData): Promise<UserProfile> {
    try {
      logger.info(`Updating preferences for user ${userId}`, { preferencesData });

      // Verify user exists
      await this.getUserById(userId);

      const updateData: UpdateUserData = {};
      
      if (preferencesData.preferences) {
        updateData.preferences = preferencesData.preferences;
      }

      if (preferencesData.notification_settings) {
        updateData.notification_settings = preferencesData.notification_settings;
      }

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('User preferences updated successfully', { userId });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user preferences', { error, userId, preferencesData });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update preferences', 500);
    }
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      logger.info(`Changing password for user ${userId}`);

      // Verify user exists
      await this.getUserById(userId);

      // Validate current password
      const isCurrentPasswordValid = await UserModel.verifyPassword(userId, currentPassword);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Validate new password strength
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(`New password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Check if new password is different from current
      const isSamePassword = await UserModel.verifyPassword(userId, newPassword);
      if (isSamePassword) {
        throw new AppError('New password must be different from current password', 400);
      }

      const passwordData: ChangePasswordData = {
        current_password: currentPassword,
        new_password: newPassword
      };

      await UserModel.changePassword(userId, passwordData);
      
      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Error changing password', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to change password', 500);
    }
  }

  /**
   * Reset user password (admin function)
   */
  static async resetPassword(userId: string, newPassword: string, adminUserId: string): Promise<void> {
    try {
      logger.info(`Admin ${adminUserId} resetting password for user ${userId}`);

      // Verify admin has permission
      const admin = await this.getUserById(adminUserId);
      if (admin.role !== 'admin' && admin.role !== 'super_admin') {
        throw new AppError('Insufficient permissions', 403);
      }

      // Verify target user exists
      await this.getUserById(userId);

      // Validate new password strength
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Force password change (no current password required)
      const passwordData: ChangePasswordData = {
        new_password: newPassword
      };

      await UserModel.changePassword(userId, passwordData);
      
      logger.info('Password reset successfully by admin', { userId, adminUserId });
    } catch (error) {
      logger.error('Error resetting password', { error, userId, adminUserId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to reset password', 500);
    }
  }

  /**
   * Update user role (admin function)
   */
  static async updateUserRole(userId: string, newRole: string, adminUserId: string): Promise<UserProfile> {
    try {
      logger.info(`Admin ${adminUserId} updating role for user ${userId} to ${newRole}`);

      // Verify admin has permission
      const admin = await this.getUserById(adminUserId);
      if (admin.role !== 'super_admin') {
        throw new AppError('Only super admins can change user roles', 403);
      }

      // Verify target user exists
      await this.getUserById(userId);

      // Validate role
      const validRoles = ['user', 'admin', 'super_admin'];
      if (!validRoles.includes(newRole)) {
        throw new AppError('Invalid role specified', 400);
      }

      // Prevent super admin from demoting themselves
      if (userId === adminUserId && admin.role === 'super_admin' && newRole !== 'super_admin') {
        throw new AppError('Super admin cannot demote themselves', 400);
      }

      const updateData: UpdateUserData = {
        role: newRole as any
      };

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('User role updated successfully', { userId, newRole, adminUserId });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user role', { error, userId, newRole, adminUserId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update user role', 500);
    }
  }

  /**
   * Update user status (admin function)
   */
  static async updateUserStatus(userId: string, newStatus: string, adminUserId: string): Promise<UserProfile> {
    try {
      logger.info(`Admin ${adminUserId} updating status for user ${userId} to ${newStatus}`);

      // Verify admin has permission
      const admin = await this.getUserById(adminUserId);
      if (admin.role !== 'admin' && admin.role !== 'super_admin') {
        throw new AppError('Insufficient permissions', 403);
      }

      // Verify target user exists
      await this.getUserById(userId);

      // Validate status
      const validStatuses = ['active', 'inactive', 'suspended', 'pending_verification'];
      if (!validStatuses.includes(newStatus)) {
        throw new AppError('Invalid status specified', 400);
      }

      // Prevent admin from suspending themselves
      if (userId === adminUserId && newStatus === 'suspended') {
        throw new AppError('Admin cannot suspend themselves', 400);
      }

      const updateData: UpdateUserData = {
        status: newStatus as any
      };

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('User status updated successfully', { userId, newStatus, adminUserId });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user status', { error, userId, newStatus, adminUserId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update user status', 500);
    }
  }

  /**
   * Delete user account (soft delete)
   */
  static async deleteUser(userId: string, adminUserId?: string): Promise<void> {
    try {
      logger.info(`Deleting user ${userId}`, { adminUserId });

      // If admin is deleting, verify permissions
      if (adminUserId) {
        const admin = await this.getUserById(adminUserId);
        
        // Prevent super admin from deleting themselves
        if (userId === adminUserId && admin.role === 'super_admin') {
          throw new AppError('Super admin cannot delete themselves', 400);
        }
        
        // If deleting another user, check permissions
        if (adminUserId !== userId) {
          if (admin.role !== 'admin' && admin.role !== 'super_admin') {
            throw new AppError('Insufficient permissions', 403);
          }

          // Prevent admin from deleting other admins unless super admin
          const targetUser = await this.getUserById(userId);
          if (targetUser.role === 'admin' || targetUser.role === 'super_admin') {
            if (admin.role !== 'super_admin') {
              throw new AppError('Only super admins can delete other admins', 403);
            }
          }
        }
      }

      // Verify user exists
      await this.getUserById(userId);

      await UserModel.delete(userId);
      
      logger.info('User deleted successfully', { userId, adminUserId });
    } catch (error) {
      logger.error('Error deleting user', { error, userId, adminUserId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete user', 500);
    }
  }

  /**
   * Get users with filtering and pagination
   */
  static async getUsers(options: UserFilterOptions = {}): Promise<{
    users: UserProfile[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      logger.info('Fetching users with filters', { options });

      // Set defaults
      const limit = Math.min(options.limit || 50, 100); // Max 100 users per request
      const offset = options.offset || 0;

      // Build filters for UserModel
      const filters: any = {
        search: options.search,
        email_verified: options.email_verified,
        created_after: options.created_from,
        created_before: options.created_to,
        last_login_after: options.last_login_from,
        last_login_before: options.last_login_to
      };

      // Handle single role/status (UserModel expects single values, not arrays)
      if (options.role) {
        if (Array.isArray(options.role)) {
          filters.role = options.role[0]; // Take first role for now
        } else {
          filters.role = options.role;
        }
      }

      if (options.status) {
        if (Array.isArray(options.status)) {
          filters.status = options.status[0]; // Take first status for now
        } else {
          filters.status = options.status;
        }
      }

      const pagination = {
        limit: limit + 1, // Get one extra to check if there are more
        offset,
        sort_by: options.sort_by || 'created_at',
        sort_order: options.sort_order || 'desc'
      };

      const result = await UserModel.list(filters, pagination);
      
      // Check if there are more results
      const hasMore = result.users.length > limit;
      if (hasMore) {
        result.users.pop(); // Remove the extra user
      }

      logger.info(`Fetched ${result.users.length} users`);

      return {
        users: result.users,
        pagination: {
          total: result.pagination.total,
          limit,
          offset,
          hasMore
        }
      };
    } catch (error) {
      logger.error('Error fetching users', { error, options });
      throw new AppError('Failed to fetch users', 500);
    }
  }

  /**
   * Get user statistics (admin function)
   */
  static async getUserStatistics(): Promise<UserStatistics> {
    try {
      logger.info('Fetching user statistics');

      // Get all users to calculate statistics
      const allUsers = await UserModel.list({}, { limit: 10000 }); // Get all users
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats: UserStatistics = {
        total_users: allUsers.users.length,
        active_users: allUsers.users.filter(u => u.status === 'active').length,
        verified_users: allUsers.users.filter(u => u.email_verified).length,
        admin_users: allUsers.users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
        users_by_status: {
          active: allUsers.users.filter(u => u.status === 'active').length,
          inactive: allUsers.users.filter(u => u.status === 'inactive').length,
          suspended: allUsers.users.filter(u => u.status === 'suspended').length,
          pending_verification: allUsers.users.filter(u => u.status === 'pending_verification').length
        },
        users_by_role: {
          user: allUsers.users.filter(u => u.role === 'user').length,
          admin: allUsers.users.filter(u => u.role === 'admin').length,
          super_admin: allUsers.users.filter(u => u.role === 'super_admin').length
        },
        recent_registrations: allUsers.users.filter(u => new Date(u.created_at) > thirtyDaysAgo).length,
        recent_logins: allUsers.users.filter(u => u.last_login_at && new Date(u.last_login_at) > sevenDaysAgo).length
      };

      logger.info('User statistics fetched successfully', { stats });
      return stats;
    } catch (error) {
      logger.error('Error fetching user statistics', { error });
      throw new AppError('Failed to fetch user statistics', 500);
    }
  }

  /**
   * Verify user account (email verification)
   */
  static async verifyEmail(userId: string): Promise<UserProfile> {
    try {
      logger.info(`Verifying email for user ${userId}`);

      // Verify user exists
      await this.getUserById(userId);

      const updateData: UpdateUserData = {
        email_verified: true,
        email_verified_at: new Date(),
        status: 'active' // Activate account upon email verification
      };

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('Email verified successfully', { userId });
      return updatedUser;
    } catch (error) {
      logger.error('Error verifying email', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to verify email', 500);
    }
  }

  /**
   * Update login information
   */
  static async updateLoginInfo(userId: string, ipAddress?: string): Promise<void> {
    try {
      await UserModel.updateLoginInfo(userId, ipAddress);
      logger.info('Login info updated successfully', { userId, ipAddress });
    } catch (error) {
      logger.error('Error updating login info', { error, userId });
      throw new AppError('Failed to update login info', 500);
    }
  }

  /**
   * Check if account is locked
   */
  static async isAccountLocked(email: string): Promise<boolean> {
    try {
      return await UserModel.isAccountLocked(email);
    } catch (error) {
      logger.error('Error checking account lock status', { error, email });
      throw new AppError('Failed to check account status', 500);
    }
  }

  /**
   * Increment failed login attempts
   */
  static async incrementFailedLoginAttempts(email: string): Promise<void> {
    try {
      await UserModel.incrementFailedLoginAttempts(email);
      logger.info('Failed login attempt recorded', { email });
    } catch (error) {
      logger.error('Error recording failed login attempt', { error, email });
      throw new AppError('Failed to record login attempt', 500);
    }
  }

  /**
   * Unlock user account (admin function)
   */
  static async unlockAccount(userId: string, adminUserId: string): Promise<UserProfile> {
    try {
      logger.info(`Admin ${adminUserId} unlocking account for user ${userId}`);

      // Verify admin has permission
      const admin = await this.getUserById(adminUserId);
      if (admin.role !== 'admin' && admin.role !== 'super_admin') {
        throw new AppError('Insufficient permissions', 403);
      }

      // Reset failed login attempts and unlock
      const updateData: UpdateUserData = {
        failed_login_attempts: 0,
        locked_until: null
      };

      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('Account unlocked successfully', { userId, adminUserId });
      return updatedUser;
    } catch (error) {
      logger.error('Error unlocking account', { error, userId, adminUserId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to unlock account', 500);
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Validate timezone string
   */
  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate language code
   */
  private static isValidLanguageCode(languageCode: string): boolean {
    // Basic validation for common language codes
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
    return validCodes.includes(languageCode.toLowerCase());
  }
}
