/**
 * Authentication Routes Module
 * Comprehensive authentication endpoints with security and validation
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { jwtAuth, optionalAuth } from '../../middleware/jwtAuth';
import { authLimiter, loginAttemptLimiter, registrationLimiter } from '../../middleware/rateLimiting';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Authentication validation schemas
 */
const registerValidation = [
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
    .withMessage('First name must be between 1 and 50 characters'),
    
  body('last_name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
    
  body('terms_accepted')
    .isBoolean()
    .custom(value => value === true)
    .withMessage('Terms and conditions must be accepted'),
    
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
    
  body('marketing_consent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
    
  body('referral_code')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('Referral code must be valid')
];

const loginValidation = [
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
    
  body('device_info')
    .optional()
    .isObject()
    .withMessage('Device info must be an object')
];

const refreshTokenValidation = [
  body('refresh_token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Refresh token is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
];

const resetPasswordValidation = [
  body('token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Reset token is required'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

const changePasswordValidation = [
  body('current_password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
    
  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

const verifyEmailValidation = [
  param('token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Verification token is required')
];

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

/**
 * @route   POST /auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', 
  registrationLimiter,
  registerValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User registration attempt', { email: req.body.email });
    
    // Placeholder for actual controller implementation
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: 'placeholder-uuid',
          email: req.body.email,
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          email_verified: false,
          created_at: new Date().toISOString()
        },
        tokens: {
          access_token: 'placeholder-access-token',
          refresh_token: 'placeholder-refresh-token',
          expires_in: 3600
        }
      }
    });
  })
);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login',
  loginAttemptLimiter,
  loginValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User login attempt', { email: req.body.email });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: 'placeholder-uuid',
          email: req.body.email,
          first_name: 'John',
          last_name: 'Doe',
          email_verified: true,
          last_login: new Date().toISOString()
        },
        tokens: {
          access_token: 'placeholder-access-token',
          refresh_token: 'placeholder-refresh-token',
          expires_in: 3600
        }
      }
    });
  })
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh',
  authLimiter,
  refreshTokenValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Token refresh attempt');
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        access_token: 'new-placeholder-access-token',
        expires_in: 3600
      }
    });
  })
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User logout', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

/**
 * @route   POST /auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    logger.info('User logout from all devices', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  })
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password',
  authLimiter,
  forgotPasswordValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Password reset request', { email: req.body.email });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Password reset email sent if account exists'
    });
  })
);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post('/reset-password',
  authLimiter,
  resetPasswordValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Password reset attempt');
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  })
);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password',
  jwtAuth,
  changePasswordValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Password change attempt', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

/**
 * @route   GET /auth/verify-email/:token
 * @desc    Verify user email address
 * @access  Public
 */
router.get('/verify-email/:token',
  verifyEmailValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Email verification attempt', { token: req.params.token });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  })
);

/**
 * @route   POST /auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification',
  jwtAuth,
  authLimiter,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Resend verification request', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Verification email sent'
    });
  })
);

/**
 * @route   GET /auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me',
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
          email_verified: true,
          created_at: new Date().toISOString(),
          preferences: {
            timezone: 'UTC',
            language: 'en',
            notifications: true
          }
        }
      }
    });
  })
);

/**
 * @route   GET /auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions',
  jwtAuth,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Get active sessions', { userId: req.user.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        sessions: [
          {
            id: 'session-1',
            device: 'Chrome on Windows',
            ip_address: '192.168.1.1',
            location: 'New York, US',
            last_active: new Date().toISOString(),
            current: true
          }
        ]
      }
    });
  })
);

/**
 * @route   DELETE /auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  jwtAuth,
  param('sessionId').isString().withMessage('Session ID is required'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Revoke session', { userId: req.user.id, sessionId: req.params.sessionId });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  })
);

export default router;
