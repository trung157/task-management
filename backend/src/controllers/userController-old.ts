import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import config from '../config/config';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class UserController {
  /**
   * Get current user profile
   */
  public getProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        email_verified,
        created_at,
        updated_at,
        last_login_at
      FROM users 
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user profile:', error);
      throw new AppError('Failed to fetch user profile', 500, 'FETCH_PROFILE_FAILED');
    }
  };

  /**
   * Update current user profile
   */
  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { firstName, lastName, email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateValues.push(firstName);
      paramIndex++;
    }

    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateValues.push(lastName);
      paramIndex++;
    }

    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
      
      // Reset email verification if email changed
      updateFields.push(`email_verified = false`);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) { // Only updated_at
      res.json({
        success: true,
        message: 'No changes made',
      });
      return;
    }

    updateValues.push(userId);
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, role, email_verified, created_at, updated_at, last_login_at
    `;

    try {
      const result = await pool.query(updateQuery, updateValues);
      const user = result.rows[0];

      logger.info('User profile updated successfully:', { userId });

      res.json({
        success: true,
        data: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastLoginAt: user.last_login_at,
        },
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw new AppError('Failed to update user profile', 500, 'UPDATE_PROFILE_FAILED');
    }
  };

  /**
   * Get user by ID (admin or owner only)
   */
  public getUserById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        name,
        email,
        role,
        is_email_verified,
        is_active,
        created_at,
        updated_at,
        last_login_at
      FROM users 
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user:', error);
      throw new AppError('Failed to fetch user', 500, 'FETCH_USER_FAILED');
    }
  };

  /**
   * Update user (admin or owner only)
   */
  public updateUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { firstName, lastName, email, role, is_active } = req.body;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateValues.push(firstName);
      paramIndex++;
    }

    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateValues.push(lastName);
      paramIndex++;
    }

    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
      
      // Reset email verification if email changed
      updateFields.push(`email_verified = false`);
    }

    // Only admins can change role and active status
    if (currentUserRole === 'admin') {
      if (role !== undefined) {
        updateFields.push(`role = $${paramIndex}`);
        updateValues.push(role);
        paramIndex++;
      }

      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateValues.push(is_active);
        paramIndex++;
      }
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) { // Only updated_at
      res.json({
        success: true,
        message: 'No changes made',
      });
      return;
    }

    updateValues.push(id);
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, role, email_verified, is_active, created_at, updated_at, last_login_at
    `;

    try {
      const result = await pool.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = result.rows[0];

      logger.info('User updated successfully:', { userId: id, updatedBy: currentUserId });

      res.json({
        success: true,
        data: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          emailVerified: user.email_verified,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastLoginAt: user.last_login_at,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating user:', error);
      throw new AppError('Failed to update user', 500, 'UPDATE_USER_FAILED');
    }
  };

  /**
   * Delete user (soft delete - admin or owner only)
   */
  public deleteUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    // Prevent users from deleting themselves
    if (id === currentUserId) {
      throw new AppError('Cannot delete your own account', 400, 'CANNOT_DELETE_SELF');
    }

    const query = `
      UPDATE users 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        throw new AppError('User not found or already deactivated', 404, 'USER_NOT_FOUND');
      }

      // Also soft delete all user's tasks
      await pool.query(
        'UPDATE tasks SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL',
        [id]
      );

      logger.info('User deactivated successfully:', { userId: id, deactivatedBy: currentUserId });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deactivating user:', error);
      throw new AppError('Failed to deactivate user', 500, 'DELETE_USER_FAILED');
    }
  };

  /**
   * Change user password
   */
  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    try {
      // Get current password hash
      const userQuery = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userQuery.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userQuery.rows[0].password_hash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      logger.info('Password changed successfully:', { userId });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error changing password:', error);
      throw new AppError('Failed to change password', 500, 'CHANGE_PASSWORD_FAILED');
    }
  };

  /**
   * Update user email
   */
  public updateEmail = async (req: Request, res: Response): Promise<void> => {
    const { newEmail, password } = req.body;
    const userId = req.user!.id;

    try {
      // Verify password
      const userQuery = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userQuery.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const isPasswordValid = await bcrypt.compare(password, userQuery.rows[0].password_hash);
      if (!isPasswordValid) {
        throw new AppError('Password is incorrect', 400, 'INVALID_PASSWORD');
      }

      // Check if email is already taken
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [newEmail, userId]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError('Email is already in use', 400, 'EMAIL_ALREADY_EXISTS');
      }

      // Update email and set as unverified
      await pool.query(
        'UPDATE users SET email = $1, is_email_verified = false, updated_at = NOW() WHERE id = $2',
        [newEmail, userId]
      );

      logger.info('Email updated successfully:', { userId, newEmail });

      res.json({
        success: true,
        message: 'Email updated successfully. Please verify your new email address.',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating email:', error);
      throw new AppError('Failed to update email', 500, 'UPDATE_EMAIL_FAILED');
    }
  };

  /**
   * Delete user account (self-deletion)
   */
  public deleteAccount = async (req: Request, res: Response): Promise<void> => {
    const { password, confirmation } = req.body;
    const userId = req.user!.id;

    try {
      // Verify password
      const userQuery = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userQuery.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const isPasswordValid = await bcrypt.compare(password, userQuery.rows[0].password_hash);
      if (!isPasswordValid) {
        throw new AppError('Password is incorrect', 400, 'INVALID_PASSWORD');
      }

      // Soft delete user account
      await pool.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
        [userId]
      );

      // Soft delete all user's tasks
      await pool.query(
        'UPDATE tasks SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL',
        [userId]
      );

      logger.info('User account deleted successfully:', { userId });

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting account:', error);
      throw new AppError('Failed to delete account', 500, 'DELETE_ACCOUNT_FAILED');
    }
  };

  /**
   * Get user preferences
   */
  public getPreferences = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const query = `
      SELECT 
        preferences
      FROM users 
      WHERE id = $1 AND is_active = true
    `;

    try {
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0].preferences || {},
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user preferences:', error);
      throw new AppError('Failed to fetch preferences', 500, 'FETCH_PREFERENCES_FAILED');
    }
  };

  /**
   * Update notification preferences
   */
  public updateNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
    const notificationPrefs = req.body;
    const userId = req.user!.id;

    try {
      // Get current preferences
      const currentPrefs = await pool.query(
        'SELECT preferences FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (currentPrefs.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const preferences = currentPrefs.rows[0].preferences || {};
      preferences.notifications = { ...preferences.notifications, ...notificationPrefs };

      // Update preferences
      await pool.query(
        'UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(preferences), userId]
      );

      logger.info('Notification preferences updated:', { userId });

      res.json({
        success: true,
        data: preferences.notifications,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating notification preferences:', error);
      throw new AppError('Failed to update notification preferences', 500, 'UPDATE_PREFERENCES_FAILED');
    }
  };

  /**
   * Export user data
   */
  public exportUserData = async (req: Request, res: Response): Promise<void> => {
    const { format = 'json', includeDeleted = false } = req.query;
    const userId = req.user!.id;

    try {
      // Get user profile
      const userQuery = await pool.query(`
        SELECT id, email, first_name, last_name, timezone, preferences, created_at
        FROM users WHERE id = $1
      `, [userId]);

      // Get tasks
      const tasksQuery = await pool.query(`
        SELECT id, title, description, status, priority, due_date, created_at, updated_at, completed_at
        FROM tasks 
        WHERE user_id = $1 ${includeDeleted === 'true' ? '' : 'AND deleted_at IS NULL'}
        ORDER BY created_at DESC
      `, [userId]);

      // Get tags
      const tagsQuery = await pool.query(`
        SELECT id, name, color, description, created_at
        FROM tags 
        WHERE user_id = $1
        ORDER BY name ASC
      `, [userId]);

      const exportData = {
        user: userQuery.rows[0],
        tasks: tasksQuery.rows,
        tags: tagsQuery.rows,
        exportedAt: new Date().toISOString(),
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
        res.json(exportData);
      } else {
        // CSV format - simplified for tasks only
        const csvData = tasksQuery.rows.map(task => 
          `"${task.title}","${task.description || ''}","${task.status}","${task.priority}","${task.due_date || ''}","${task.created_at}"`
        ).join('\n');
        
        const csvHeader = 'Title,Description,Status,Priority,Due Date,Created At\n';
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="tasks-${userId}.csv"`);
        res.send(csvHeader + csvData);
      }

      logger.info('User data exported:', { userId, format });
    } catch (error) {
      logger.error('Error exporting user data:', error);
      throw new AppError('Failed to export user data', 500, 'EXPORT_DATA_FAILED');
    }
  };
}
