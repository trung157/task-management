import { Request, Response } from 'express';
import { 
  UserModel, 
  CreateUserData, 
  UpdateUserData, 
  ChangePasswordData,
  UserSearchFilters,
  PaginationOptions,
  UserProfile 
} from '../models/user';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Extended Request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

export class UserController {
  /**
   * Create a new user (Admin only)
   */
  public createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { first_name, last_name, email, password, timezone, language_code, role } = req.body;

    // Check if requester is admin
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const userData: CreateUserData = {
      email,
      password,
      first_name,
      last_name,
      timezone,
      language_code,
      role
    };

    const user = await UserModel.create(userData);

    logger.info('User created by admin', {
      createdUserId: user.id,
      adminId: req.user?.id,
      email: user.email
    });

    res.status(201).json({
      success: true,
      data: { user },
      message: 'User created successfully'
    });
  };

  /**
   * Get current user profile
   */
  public getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: { user }
    });
  };

  /**
   * Get user by ID (Admin only for other users)
   */
  public getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;

    // Users can only view their own profile unless they're admin
    if (id !== requesterId && requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: { user }
    });
  };

  /**
   * Update user profile
   */
  public updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const {
      first_name,
      last_name,
      email,
      avatar_url,
      bio,
      timezone,
      date_format,
      time_format,
      language_code,
      preferences,
      notification_settings
    } = req.body;

    const updateData: UpdateUserData = {
      first_name,
      last_name,
      email,
      avatar_url,
      bio,
      timezone,
      date_format,
      time_format,
      language_code,
      preferences,
      notification_settings
    };

    const user = await UserModel.update(userId, updateData);

    logger.info('User profile updated', {
      userId,
      updatedFields: Object.keys(updateData).filter(key => updateData[key as keyof UpdateUserData] !== undefined)
    });

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully'
    });
  };

  /**
   * Update user by ID (Admin only)
   */
  public updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const requesterRole = req.user?.role;

    // Check admin permissions
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const {
      first_name,
      last_name,
      email,
      avatar_url,
      bio,
      timezone,
      date_format,
      time_format,
      language_code,
      role,
      status,
      preferences,
      notification_settings
    } = req.body;

    const updateData: UpdateUserData = {
      first_name,
      last_name,
      email,
      avatar_url,
      bio,
      timezone,
      date_format,
      time_format,
      language_code,
      role,
      status,
      preferences,
      notification_settings
    };

    const user = await UserModel.update(id, updateData);

    logger.info('User updated by admin', {
      updatedUserId: id,
      adminId: req.user?.id,
      updatedFields: Object.keys(updateData).filter(key => updateData[key as keyof UpdateUserData] !== undefined)
    });

    res.json({
      success: true,
      data: { user },
      message: 'User updated successfully'
    });
  };

  /**
   * Change password
   */
  public changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { current_password, new_password, confirm_password } = req.body;

    // Validate input
    if (!current_password || !new_password || !confirm_password) {
      throw new AppError('All password fields are required', 400, 'MISSING_FIELDS');
    }

    if (new_password !== confirm_password) {
      throw new AppError('New password and confirmation do not match', 400, 'PASSWORD_MISMATCH');
    }

    const passwordData: ChangePasswordData = {
      current_password,
      new_password
    };

    await UserModel.changePassword(userId, passwordData);

    logger.info('Password changed successfully', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  };

  /**
   * Delete user account (soft delete)
   */
  public deleteProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    await UserModel.delete(userId);

    logger.info('User account deleted', { userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  };

  /**
   * Delete user by ID (Admin only)
   */
  public deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const requesterRole = req.user?.role;
    const requesterId = req.user?.id;

    // Check admin permissions
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    // Prevent self-deletion
    if (id === requesterId) {
      throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE_FORBIDDEN');
    }

    await UserModel.delete(id);

    logger.info('User deleted by admin', {
      deletedUserId: id,
      adminId: requesterId
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  };

  /**
   * List users with filtering and pagination (Admin only)
   */
  public listUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const requesterRole = req.user?.role;

    // Check admin permissions
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    // Parse query parameters
    const {
      search,
      role,
      status,
      email_verified,
      created_after,
      created_before,
      last_login_after,
      last_login_before,
      page,
      limit,
      sort_by,
      sort_order
    } = req.query;

    const filters: UserSearchFilters = {
      search: search as string,
      role: role as any,
      status: status as any,
      email_verified: email_verified === 'true' ? true : email_verified === 'false' ? false : undefined,
      created_after: created_after ? new Date(created_after as string) : undefined,
      created_before: created_before ? new Date(created_before as string) : undefined,
      last_login_after: last_login_after ? new Date(last_login_after as string) : undefined,
      last_login_before: last_login_before ? new Date(last_login_before as string) : undefined
    };

    const pagination: PaginationOptions = {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sort_by: sort_by as string,
      sort_order: sort_order as 'asc' | 'desc'
    };

    const result = await UserModel.list(filters, pagination);

    res.json({
      success: true,
      data: result,
      message: 'Users retrieved successfully'
    });
  };

  /**
   * Get user statistics (Admin only)
   */
  public getUserStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const requesterRole = req.user?.role;

    // Check admin permissions
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    try {
      // Get user statistics
      const statsResult = await UserModel.list({}, { limit: 1000000 }); // Get all users for stats
      const users = statsResult.users;

      const stats = {
        total_users: users.length,
        active_users: users.filter(u => u.status === 'active').length,
        verified_users: users.filter(u => u.email_verified).length,
        admin_users: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
        recent_signups: users.filter(u => {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return new Date(u.created_at) > oneWeekAgo;
        }).length,
        recent_logins: users.filter(u => {
          if (!u.last_login_at) return false;
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return new Date(u.last_login_at) > oneWeekAgo;
        }).length
      };

      res.json({
        success: true,
        data: { stats },
        message: 'User statistics retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get user statistics', { error });
      throw new AppError('Failed to retrieve user statistics', 500, 'STATS_FAILED');
    }
  };

  /**
   * Search users (Admin only)
   */
  public searchUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const requesterRole = req.user?.role;

    // Check admin permissions
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const { q: query, limit = 10 } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new AppError('Search query is required', 400, 'MISSING_QUERY');
    }

    const filters: UserSearchFilters = {
      search: query as string
    };

    const pagination: PaginationOptions = {
      limit: parseInt(limit as string, 10),
      page: 1
    };

    const result = await UserModel.list(filters, pagination);

    res.json({
      success: true,
      data: { users: result.users },
      message: 'Search completed successfully'
    });
  };

  /**
   * Update user email
   */
  public updateEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { email, password } = req.body;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Verify password before allowing email change
    const isPasswordValid = await UserModel.verifyPassword(userId, password);
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 400, 'INVALID_PASSWORD');
    }

    const updatedUser = await UserModel.update(userId, { email });

    logger.info('User email updated', { userId, newEmail: email });

    res.json({
      success: true,
      data: { user: updatedUser },
      message: 'Email updated successfully'
    });
  };

  /**
   * Delete user account (soft delete)
   */
  public deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { password } = req.body;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Verify password before allowing account deletion
    const isPasswordValid = await UserModel.verifyPassword(userId, password);
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 400, 'INVALID_PASSWORD');
    }

    await UserModel.delete(userId);

    logger.info('User account deleted', { userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  };

  /**
   * Get user preferences
   */
  public getPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        preferences: user.preferences,
        notification_settings: user.notification_settings,
        timezone: user.timezone,
        date_format: user.date_format,
        time_format: user.time_format,
        language_code: user.language_code
      },
      message: 'Preferences retrieved successfully'
    });
  };

  /**
   * Update notification preferences
   */
  public updateNotificationPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { notification_settings } = req.body;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const updatedUser = await UserModel.update(userId, { notification_settings });

    logger.info('User notification preferences updated', { userId });

    res.json({
      success: true,
      data: { user: updatedUser },
      message: 'Notification preferences updated successfully'
    });
  };

  /**
   * Export user data
   */
  public exportUserData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Create export data (excluding sensitive information)
    const exportData = {
      profile: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        bio: user.bio,
        timezone: user.timezone,
        language_code: user.language_code,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      preferences: user.preferences,
      notification_settings: user.notification_settings,
      exported_at: new Date().toISOString()
    };

    logger.info('User data exported', { userId });

    res.json({
      success: true,
      data: exportData,
      message: 'Data exported successfully'
    });
  };
}
