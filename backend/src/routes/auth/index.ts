/**
 * Authentication Routes
 * Centralized authentication endpoints with comprehensive security
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authLimiter, loginAttemptLimiter, registrationLimiter } from '../../middleware/rateLimiting';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { optionalAuth } from '../../middleware/jwtAuth';

const router = Router();

/**
 * Authentication validation rules
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
    .withMessage('Terms and conditions must be accepted')
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
    .withMessage('Remember me must be a boolean')
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
    
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register',
  registrationLimiter,
  registerValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { email, password, first_name, last_name, terms_accepted } = req.body;

    // Mock registration (replace with actual service call)
    const user = {
      id: '123',
      email,
      first_name,
      last_name,
      role: 'user',
      status: 'pending_verification',
      created_at: new Date().toISOString()
    };

    const tokens = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600
    };

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens
      },
      message: 'Account created successfully. Please check your email for verification.'
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login',
  loginAttemptLimiter,
  loginValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { email, password, remember_me = false } = req.body;

    // Mock login (replace with actual service call)
    const user = {
      id: '123',
      email,
      first_name: 'John',
      last_name: 'Doe',
      role: 'user',
      status: 'active',
      last_login_at: new Date().toISOString()
    };

    const tokens = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: remember_me ? 86400 * 7 : 3600 // 7 days or 1 hour
    };

    // Set secure HTTP-only cookies for tokens
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: tokens.expires_in * 1000
    });

    res.json({
      success: true,
      data: {
        user,
        tokens
      },
      message: 'Login successful'
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout',
  optionalAuth,
  asyncHandler(async (req: any, res: any) => {
    // Clear authentication cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    // Mock logout (replace with actual service call to invalidate tokens)
    
    res.json({
      success: true,
      data: null,
      message: 'Logout successful'
    });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh',
  authLimiter,
  body('refresh_token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Refresh token is required'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { refresh_token } = req.body;

    // Mock token refresh (replace with actual service call)
    const tokens = {
      access_token: 'new-mock-access-token',
      refresh_token: 'new-mock-refresh-token',
      expires_in: 3600
    };

    res.json({
      success: true,
      data: tokens,
      message: 'Token refreshed successfully'
    });
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password',
  authLimiter,
  forgotPasswordValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;

    // Mock password reset request (replace with actual service call)
    
    res.json({
      success: true,
      data: null,
      message: 'If an account with that email exists, a password reset email has been sent.'
    });
  })
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post('/reset-password',
  authLimiter,
  resetPasswordValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { token, email, new_password } = req.body;

    // Mock password reset (replace with actual service call)
    
    res.json({
      success: true,
      data: null,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  })
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address using verification token
 * @access  Public
 */
router.post('/verify-email',
  authLimiter,
  body('token')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Verification token is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { token, email } = req.body;

    // Mock email verification (replace with actual service call)
    
    res.json({
      success: true,
      data: null,
      message: 'Email verified successfully. Your account is now active.'
    });
  })
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification',
  authLimiter,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;

    // Mock resend verification (replace with actual service call)
    
    res.json({
      success: true,
      data: null,
      message: 'Verification email sent. Please check your inbox.'
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me',
  optionalAuth,
  asyncHandler(async (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Authentication required'
      });
    }

    // Mock user data (replace with actual service call)
    const user = {
      id: req.user.id,
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'user',
      status: 'active',
      email_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    };

    res.json({
      success: true,
      data: user,
      message: 'User profile retrieved successfully'
    });
  })
);

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status
 * @access  Public
 */
router.get('/status',
  optionalAuth,
  asyncHandler(async (req: any, res: any) => {
    const isAuthenticated = !!req.user;
    
    res.json({
      success: true,
      data: {
        authenticated: isAuthenticated,
        user: isAuthenticated ? {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        } : null
      },
      message: 'Authentication status retrieved'
    });
  })
);

export default router;
