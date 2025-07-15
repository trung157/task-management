/**
 * Modern User Controller
 * 
 * RESTful user management controller using the advanced UserService
 * Handles all user-related HTTP endpoints with proper validation,
 * authentication, authorization, and error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { AdvancedUserService } from '../services/advancedUserService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { body, query, param, validationResult } from 'express-validator';

// =====================================================
// EXTENDED REQUEST INTERFACES
// =====================================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UserSearchQuery extends PaginationQuery {
  search?: string;
  role?: string;
  status?: string;
  isVerified?: string;
  createdFrom?: string;
  createdTo?: string;
}

// =====================================================
// VALIDATION RULES
// =====================================================

export const userValidationRules = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('timezone').optional().isString(),
    body('language_code').optional().isString(),
  ],

  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('captcha_token').optional().isString(),
    body('remember_me').optional().isBoolean(),
  ],

  updateProfile: [
    body('first_name').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
    body('last_name').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
    body('phone_number').optional().isMobilePhone('any'),
    body('date_of_birth').optional().isISO8601(),
    body('timezone').optional().isString(),
    body('language_code').optional().isString(),
    body('notification_preferences').optional().isObject(),
  ],

  changePassword: [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('confirm_password').custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  ],

  requestPasswordReset: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('captcha_token').optional().isString(),
  ],

  resetPassword: [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('confirm_password').custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  ],

  searchUsers: [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['created_at', 'updated_at', 'email', 'first_name', 'last_name']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('role').optional().isIn(['user', 'admin', 'super_admin']),
    query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']),
    query('isVerified').optional().isBoolean(),
  ],

  updateUserRole: [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Valid role is required'),
    body('reason').optional().isString(),
  ],
};

// =====================================================
// CONTROLLER CLASS
// =====================================================

export class ModernUserController {
  constructor() {
    // AdvancedUserService is a static class, no instantiation needed
  }

  // =====================================================
  // AUTHENTICATION ENDPOINTS
  // =====================================================

  /**
   * User registration
   */
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { email, password, first_name, last_name, timezone, language_code, terms_accepted = true } = req.body;

      const result = await AdvancedUserService.registerUser({
        email,
        password,
        first_name,
        last_name,
        timezone,
        language_code,
        terms_accepted,
      });

      logger.info('User registered successfully', {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * User login
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { email, password, captcha_token, remember_me } = req.body;

      const result = await AdvancedUserService.authenticateUser({
        email,
        password,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        captcha_token,
        remember_me,
      });

      logger.info('User logged in successfully', {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
      }

      const result = await AdvancedUserService.refreshAccessToken(refresh_token);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * User logout
   */
  public logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;

      if (req.user?.id) {
        await AdvancedUserService.logoutUser(req.user.id, refresh_token);
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // USER PROFILE ENDPOINTS
  // =====================================================

  /**
   * Get current user profile
   */
  public getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const user = await AdvancedUserService.getUserById(req.user.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user profile
   */
  public updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const updateData = req.body;
      const updatedUser = await AdvancedUserService.updateUserProfile(req.user.id, updateData);

      logger.info('User profile updated', {
        userId: req.user.id,
        updatedFields: Object.keys(updateData),
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change user password
   */
  public changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const { current_password, new_password } = req.body;

      await AdvancedUserService.changePassword(req.user.id, current_password, new_password, req.ip, req.get('User-Agent'));

      logger.info('User password changed', {
        userId: req.user.id,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // PASSWORD RESET ENDPOINTS
  // =====================================================

  /**
   * Request password reset
   */
  public requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { email, captcha_token } = req.body;

      await AdvancedUserService.requestPasswordReset(email, {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        captcha_token,
      });

      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset password with token
   */
  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { token, new_password } = req.body;

      await AdvancedUserService.resetPassword(token, new_password, {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
      });

      logger.info('Password reset completed', {
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // ADMIN ENDPOINTS
  // =====================================================

  /**
   * Search and list users (Admin only)
   */
  public searchUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const query = req.query as UserSearchQuery;
      
      const filters = {
        search: query.search,
        role: query.role,
        status: query.status,
        isVerified: query.isVerified === 'true',
        createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
        createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
      };

      const pagination = {
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '20'),
        sortBy: query.sortBy || 'created_at',
        sortOrder: (query.sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await AdvancedUserService.searchUsers(filters, pagination);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user by ID (Admin only)
   */
  public getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const { userId } = req.params;
      const user = await AdvancedUserService.getUserById(userId);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user role (Super Admin only)
   */
  public updateUserRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || req.user.role !== 'super_admin') {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { userId } = req.params;
      const { role, reason } = req.body;

      const updatedUser = await AdvancedUserService.updateUserRole(userId, role, {
        changed_by: req.user.id,
        reason,
      });

      logger.warn('User role updated by super admin', {
        targetUserId: userId,
        newRole: role,
        changedBy: req.user.id,
        reason,
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Suspend/Unsuspend user (Admin only)
   */
  public suspendUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const { userId } = req.params;
      const { reason, duration_hours } = req.body;

      await AdvancedUserService.suspendUser(userId, {
        suspended_by: req.user.id,
        reason,
        duration_hours,
      });

      logger.warn('User suspended', {
        targetUserId: userId,
        suspendedBy: req.user.id,
        reason,
        duration_hours,
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // EMAIL VERIFICATION ENDPOINTS
  // =====================================================

  /**
   * Verify email with token
   */
  public verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, email } = req.body;

      if (!token) {
        throw new AppError('Verification token is required', 400, 'TOKEN_REQUIRED');
      }

      if (!email) {
        throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
      }

      await AdvancedUserService.verifyEmail(email, token);

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resend email verification
   */
  public resendEmailVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      await AdvancedUserService.resendEmailVerification(req.user.id);

      res.json({
        success: true,
        message: 'Verification email sent',
      });
    } catch (error) {
      next(error);
    }
  };
}
