/**
 * Comprehensive User Management Controller
 * 
 * Modern Express.js controller for complete user management with:
 * - User registration and authentication
 * - Login and logout functionality
 * - Profile management and updates
 * - Password management (change, reset)
 * - Email verification
 * - User search and admin operations
 * - Session management
 * - Comprehensive validation and error handling
 * - Security best practices
 */

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AdvancedUserService, AuthenticationResult } from '../services/advancedUserService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { UserRole } from '../models/user';

// =====================================================
// TYPES AND INTERFACES
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

export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('first_name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .escape(),
  
  body('last_name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .escape(),
  
  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Timezone must be a valid string'),
  
  body('language_code')
    .optional()
    .isString()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  
  body('terms_accepted')
    .isBoolean()
    .custom(value => value === true)
    .withMessage('Terms and conditions must be accepted'),
  
  body('marketing_consent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  
  body('remember_me')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean'),
];

export const updateProfileValidation = [
  body('first_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .escape(),
  
  body('last_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .escape(),
  
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters')
    .escape(),
  
  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Timezone must be a valid string'),
  
  body('language_code')
    .optional()
    .isString()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
];

export const updatePreferencesValidation = [
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  
  body('notification_settings')
    .optional()
    .isObject()
    .withMessage('Notification settings must be an object'),
  
  body('notification_settings.email_notifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications setting must be a boolean'),
  
  body('notification_settings.push_notifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications setting must be a boolean'),
  
  body('notification_settings.due_date_reminders')
    .optional()
    .isBoolean()
    .withMessage('Due date reminders setting must be a boolean'),
  
  body('notification_settings.task_assignments')
    .optional()
    .isBoolean()
    .withMessage('Task assignments setting must be a boolean'),
];

export const changePasswordValidation = [
  body('current_password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  
  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
];

export const resetPasswordValidation = [
  body('token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Reset token is required'),
  
  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

export const userIdValidation = [
  param('id')
    .isUUID(4)
    .withMessage('User ID must be a valid UUID'),
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Handle validation errors
 */
const handleValidationErrors = (req: Request): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    logger.warn('Validation failed', {
      errors: errorMessages,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }
};

/**
 * Ensure user is authenticated
 */
const ensureAuthenticated = (req: AuthenticatedRequest): string => {
  if (!req.user?.id) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user.id;
};

/**
 * Ensure user has admin privileges
 */
const ensureAdmin = (req: AuthenticatedRequest): void => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Admin privileges required', 403, 'FORBIDDEN');
  }
};

/**
 * Format successful response
 */
const formatResponse = (data: any, message?: string, meta?: any) => {
  return {
    success: true,
    message: message || 'Operation completed successfully',
    data,
    meta,
    timestamp: new Date().toISOString()
  };
};

/**
 * Format paginated response
 */
const formatPaginatedResponse = (result: any, page: number, limit: number) => {
  const totalPages = Math.ceil(result.total / limit);
  
  return formatResponse(result.data, 'Users retrieved successfully', {
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
};

// =====================================================
// AUTHENTICATION CONTROLLERS
// =====================================================

/**
 * User Registration
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);

    const registrationData = {
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      timezone: req.body.timezone || 'UTC',
      language_code: req.body.language_code || 'en',
      terms_accepted: req.body.terms_accepted,
      marketing_consent: req.body.marketing_consent || false,
      referral_code: req.body.referral_code
    };

    const result = await AdvancedUserService.registerUser(registrationData);

    logger.info('User registered successfully', {
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip
    });

    res.status(201).json(formatResponse(
      {
        user: result.user,
        requiresEmailVerification: result.requiresVerification,
        verificationToken: result.verificationToken // Only in development
      },
      'User registered successfully'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * User Login
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);

    const credentials = {
      email: req.body.email,
      password: req.body.password,
      remember_me: req.body.remember_me || false,
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || '',
      device_info: req.body.device_info
    };

    const result: AuthenticationResult = await AdvancedUserService.authenticateUser(credentials);

    logger.info('User logged in successfully', {
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip
    });

    // Set secure HTTP-only cookie for refresh token
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json(formatResponse(
      {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType
      },
      'Login successful'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Access Token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refresh_token = req.cookies.refresh_token || req.body.refresh_token;

    if (!refresh_token) {
      throw new AppError('Refresh token required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const result = await AdvancedUserService.refreshAccessToken(refresh_token);

    logger.info('Access token refreshed', {
      ip: req.ip
    });

    res.json(formatResponse(
      {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType
      },
      'Token refreshed successfully'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * User Logout
 * POST /api/auth/logout
 */
export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);
    const refresh_token = req.cookies.refresh_token || req.body.refresh_token;

    if (refresh_token) {
      await AdvancedUserService.logoutUser(userId, refresh_token);
    }

    // Clear refresh token cookie
    res.clearCookie('refresh_token');

    logger.info('User logged out', {
      userId,
      ip: req.ip
    });

    res.json(formatResponse(null, 'Logout successful'));
  } catch (error) {
    next(error);
  }
};

// =====================================================
// PROFILE MANAGEMENT CONTROLLERS
// =====================================================

/**
 * Get Current User Profile
 * GET /api/users/profile
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);

    const user = await AdvancedUserService.getUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json(formatResponse(user, 'Profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update User Profile
 * PATCH /api/users/profile
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);

    const updateData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      bio: req.body.bio,
      avatar_url: req.body.avatar_url,
      timezone: req.body.timezone,
      date_format: req.body.date_format,
      time_format: req.body.time_format,
      language_code: req.body.language_code
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });

    const updatedUser = await AdvancedUserService.updateUserProfile(userId, updateData);

    logger.info('User profile updated', {
      userId,
      updatedFields: Object.keys(updateData)
    });

    res.json(formatResponse(updatedUser, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update User Preferences
 * PUT /api/users/preferences
 */
export const updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);
    const { preferences, notification_settings } = req.body;

    if (!preferences && !notification_settings) {
      throw new AppError('Preferences or notification settings are required', 400, 'PREFERENCES_REQUIRED');
    }

    const updateData: any = {};
    if (preferences) {
      updateData.preferences = preferences;
    }
    if (notification_settings) {
      updateData.notification_settings = notification_settings;
    }

    const updatedUser = await AdvancedUserService.updateProfile(userId, updateData);

    logger.info('User preferences updated', {
      userId,
      hasPreferences: !!preferences,
      hasNotificationSettings: !!notification_settings
    });

    res.json(formatResponse(updatedUser, 'Preferences updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password
 * POST /api/users/change-password
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);

    await AdvancedUserService.changePassword(
      userId,
      req.body.current_password,
      req.body.new_password,
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Password changed successfully', {
      userId,
      ip: req.ip
    });

    res.json(formatResponse(null, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

// =====================================================
// PASSWORD RESET CONTROLLERS
// =====================================================

/**
 * Request Password Reset
 * POST /api/auth/forgot-password
 */
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);

    const { email } = req.body;

    await AdvancedUserService.requestPasswordReset(email, {
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    logger.info('Password reset requested', {
      email,
      ip: req.ip
    });

    // Always return success to prevent email enumeration
    res.json(formatResponse(
      null,
      'If an account with that email exists, a password reset link has been sent'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);

    const { token, new_password } = req.body;

    await AdvancedUserService.resetPassword(token, new_password, {
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    logger.info('Password reset completed', {
      ip: req.ip
    });

    res.json(formatResponse(null, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
};

// =====================================================
// EMAIL VERIFICATION CONTROLLERS
// =====================================================

/**
 * Verify Email
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, email } = req.body;

    if (!token) {
      throw new AppError('Verification token is required', 400, 'TOKEN_REQUIRED');
    }

    if (!email) {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }

    await AdvancedUserService.verifyEmail(email, token);

    logger.info('Email verified successfully', {
      email,
      ip: req.ip
    });

    res.json(formatResponse(null, 'Email verified successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Resend Email Verification
 * POST /api/auth/resend-verification
 */
export const resendVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);

    await AdvancedUserService.resendEmailVerification(userId);

    logger.info('Email verification resent', {
      userId,
      ip: req.ip
    });

    res.json(formatResponse(null, 'Verification email sent'));
  } catch (error) {
    next(error);
  }
};

// =====================================================
// ADMIN USER MANAGEMENT CONTROLLERS
// =====================================================

/**
 * Search Users (Admin only)
 * GET /api/admin/users
 */
export const searchUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    ensureAdmin(req);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filters = {
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
      isVerified: req.query.isVerified === 'true',
      createdFrom: req.query.createdFrom ? new Date(req.query.createdFrom as string) : undefined,
      createdTo: req.query.createdTo ? new Date(req.query.createdTo as string) : undefined
    };

    const pagination = {
      page,
      limit,
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    };

    const result = await AdvancedUserService.searchUsers(filters, pagination);

    res.json(formatPaginatedResponse(result, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * Get User by ID (Admin only)
 * GET /api/admin/users/:id
 */
export const getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    ensureAdmin(req);

    const userId = req.params.id;

    const user = await AdvancedUserService.getUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json(formatResponse(user, 'User retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update User Role (Admin only)
 * PATCH /api/admin/users/:id/role
 */
export const updateUserRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    ensureAdmin(req);

    const userId = req.params.id;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      throw new AppError('Invalid role specified', 400, 'INVALID_ROLE');
    }

    const updatedUser = await AdvancedUserService.updateUserRole(userId, role as UserRole, {
      changed_by: req.user!.id,
      reason: req.body.reason
    });

    logger.info('User role updated', {
      targetUserId: userId,
      newRole: role,
      updatedBy: req.user!.id
    });

    res.json(formatResponse(updatedUser, 'User role updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend User (Admin only)
 * POST /api/admin/users/:id/suspend
 */
export const suspendUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    ensureAdmin(req);

    const userId = req.params.id;
    const { reason, duration_days } = req.body;

    await AdvancedUserService.suspendUser(userId, {
      reason,
      duration_hours: duration_days ? duration_days * 24 : undefined, // Convert days to hours
      suspended_by: req.user!.id
    });

    logger.info('User suspended', {
      targetUserId: userId,
      reason,
      duration_days,
      suspendedBy: req.user!.id
    });

    res.json(formatResponse(null, 'User suspended successfully'));
  } catch (error) {
    next(error);
  }
};

// =====================================================
// EXPORT CONTROLLER OBJECT
// =====================================================

export const UserManagementController = {
  // Authentication
  register,
  login,
  refreshToken,
  logout,
  
  // Profile Management
  getProfile,
  updateProfile,
  updatePreferences,
  changePassword,
  
  // Password Reset
  requestPasswordReset,
  resetPassword,
  
  // Email Verification
  verifyEmail,
  resendVerification,
  
  // Admin Operations
  searchUsers,
  getUserById,
  updateUserRole,
  suspendUser
};

export default UserManagementController;
