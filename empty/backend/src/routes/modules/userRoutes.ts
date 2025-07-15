/**
 * User Management Routes Module
 * Comprehensive user profile and management endpoints
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { jwtAuth, requireAdmin } from '../../middleware/jwtAuth';
import { defaultLimiter } from '../../middleware/rateLimiting';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * User management validation schemas
 */
const updateProfileValidation = [
  body('first_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
    
  body('last_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
    
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
    
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Phone must be a valid phone number'),
    
  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),
    
  body('department')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters'),
    
  body('job_title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Job title must not exceed 100 characters')
];

const updatePreferencesValidation = [
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
    
  body('date_format')
    .optional()
    .isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
    .withMessage('Date format must be valid'),
    
  body('time_format')
    .optional()
    .isIn(['12h', '24h'])
    .withMessage('Time format must be 12h or 24h'),
    
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Notifications must be an object'),
    
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto')
];

const userQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term must not be empty'),
    
  query('department')
    .optional()
    .isString()
    .trim()
    .withMessage('Department must be a string'),
    
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending'])
    .withMessage('Status must be active, inactive, or pending'),
    
  query('role')
    .optional()
    .isIn(['admin', 'manager', 'member', 'viewer'])
    .withMessage('Role must be valid'),
    
  query('sort_by')
    .optional()
    .isIn(['name', 'email', 'created_at', 'last_login'])
    .withMessage('Sort field must be valid'),
    
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const userIdValidation = [
  param('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID')
];

const updateUserRoleValidation = [
  body('role')
    .isIn(['admin', 'manager', 'member', 'viewer'])
    .withMessage('Role must be valid'),
    
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
];

// =====================================================
// USER PROFILE ROUTES
// =====================================================

/**
 * @route   GET /users/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/profile',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          bio: 'Software developer passionate about clean code',
          phone: '+1234567890',
          avatar_url: 'https://example.com/avatar.jpg',
          department: 'Engineering',
          job_title: 'Senior Developer',
          email_verified: true,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          preferences: {
            timezone: 'UTC',
            language_code: 'en',
            date_format: 'MM/DD/YYYY',
            time_format: '24h',
            theme: 'light',
            notifications: {
              email: true,
              push: true,
              desktop: false
            }
          }
        }
      }
    });
  })
);

/**
 * @route   PUT /users/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/profile',
  jwtAuth,
  updateProfileValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Profile update attempt', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          ...req.body,
          id: req.user.id,
          updated_at: new Date().toISOString()
        }
      }
    });
  })
);

/**
 * @route   PUT /users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences',
  jwtAuth,
  updatePreferencesValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Preferences update attempt', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: req.body
      }
    });
  })
);

/**
 * @route   POST /users/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post('/avatar',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Avatar upload attempt', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar_url: 'https://example.com/new-avatar.jpg'
      }
    });
  })
);

/**
 * @route   DELETE /users/avatar
 * @desc    Remove user avatar
 * @access  Private
 */
router.delete('/avatar',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Avatar removal attempt', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Avatar removed successfully'
    });
  })
);

// =====================================================
// USER MANAGEMENT ROUTES (Admin)
// =====================================================

/**
 * @route   GET /users
 * @desc    Get list of users (admin only)
 * @access  Private (Admin)
 */
router.get('/',
  jwtAuth,
  requireAdmin,
  userQueryValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User list request', { 
      adminId: req.user.id,
      query: req.query 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        users: [
          {
            id: 'user-1',
            email: 'user1@example.com',
            first_name: 'John',
            last_name: 'Doe',
            department: 'Engineering',
            job_title: 'Developer',
            status: 'active',
            role: 'member',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          },
          {
            id: 'user-2',
            email: 'user2@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            department: 'Design',
            job_title: 'Designer',
            status: 'active',
            role: 'member',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        ],
        pagination: {
          total: 2,
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          pages: 1
        }
      }
    });
  })
);

/**
 * @route   GET /users/:userId
 * @desc    Get user by ID (admin only)
 * @access  Private (Admin)
 */
router.get('/:userId',
  jwtAuth,
  requireAdmin,
  userIdValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User details request', { 
      adminId: req.user.id,
      targetUserId: req.params.userId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        user: {
          id: req.params.userId,
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          bio: 'Software developer',
          phone: '+1234567890',
          department: 'Engineering',
          job_title: 'Developer',
          status: 'active',
          role: 'member',
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          login_count: 42,
          permissions: ['read:tasks', 'write:tasks', 'read:projects']
        }
      }
    });
  })
);

/**
 * @route   PUT /users/:userId/role
 * @desc    Update user role (admin only)
 * @access  Private (Admin)
 */
router.put('/:userId/role',
  jwtAuth,
  requireAdmin,
  userIdValidation,
  updateUserRoleValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User role update', { 
      adminId: req.user.id,
      targetUserId: req.params.userId,
      newRole: req.body.role 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: req.params.userId,
          role: req.body.role,
          permissions: req.body.permissions || [],
          updated_at: new Date().toISOString()
        }
      }
    });
  })
);

/**
 * @route   PUT /users/:userId/status
 * @desc    Update user status (admin only)
 * @access  Private (Admin)
 */
router.put('/:userId/status',
  jwtAuth,
  requireAdmin,
  userIdValidation,
  body('status')
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User status update', { 
      adminId: req.user.id,
      targetUserId: req.params.userId,
      newStatus: req.body.status 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user: {
          id: req.params.userId,
          status: req.body.status,
          updated_at: new Date().toISOString()
        }
      }
    });
  })
);

/**
 * @route   DELETE /users/:userId
 * @desc    Delete user account (admin only)
 * @access  Private (Admin)
 */
router.delete('/:userId',
  jwtAuth,
  requireAdmin,
  userIdValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User deletion attempt', { 
      adminId: req.user.id,
      targetUserId: req.params.userId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'User account deleted successfully'
    });
  })
);

/**
 * @route   POST /users/:userId/impersonate
 * @desc    Impersonate user (admin only)
 * @access  Private (Admin)
 */
router.post('/:userId/impersonate',
  jwtAuth,
  requireAdmin,
  userIdValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User impersonation attempt', { 
      adminId: req.user.id,
      targetUserId: req.params.userId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Impersonation session started',
      data: {
        impersonation_token: 'placeholder-impersonation-token',
        expires_in: 3600,
        target_user: {
          id: req.params.userId,
          email: 'target@example.com',
          first_name: 'Target',
          last_name: 'User'
        }
      }
    });
  })
);

/**
 * @route   GET /users/analytics/overview
 * @desc    Get user analytics overview (admin only)
 * @access  Private (Admin)
 */
router.get('/analytics/overview',
  jwtAuth,
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User analytics request', { adminId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        total_users: 150,
        active_users: 135,
        new_users_this_month: 12,
        user_growth_rate: 8.5,
        departments: {
          'Engineering': 45,
          'Design': 20,
          'Marketing': 25,
          'Sales': 35,
          'Other': 25
        },
        roles: {
          'admin': 5,
          'manager': 15,
          'member': 120,
          'viewer': 10
        },
        activity_stats: {
          daily_active_users: 85,
          weekly_active_users: 120,
          monthly_active_users: 135
        }
      }
    });
  })
);

export default router;
