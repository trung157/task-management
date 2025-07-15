/**
 * Modern Authentication Routes
 * 
 * Complete authentication endpoints with:
 * - User registration and login
 * - JWT token generation and refresh
 * - Input validation and error handling
 * - Rate limiting and security features
 * - Password strength validation
 */

import { Router } from 'express';
import { ModernAuthController } from '../controllers/modernAuthController';
import { 
  validateRegistration, 
  validateLogin, 
  validateRefreshToken,
  validatePasswordCheck,
  validateAuthHeader
} from '../validators/modernAuthValidator';
import { validateRequest } from '../middleware/validation';
import { requireAuth } from '../middleware/jwtAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { 
  authLimiter,
  loginAttemptLimiter,
  registrationLimiter,
  passwordResetLimiter,
  sensitiveOperationLimiter,
  checkTemporaryBlock 
} from '../middleware/rateLimiting';
import { 
  validatePasswordMiddleware,
  checkPasswordStrengthMiddleware 
} from '../middleware/passwordValidation';

const router = Router();
const authController = new ModernAuthController();

// Apply security checks to all auth routes
router.use(checkTemporaryBlock);

// Middleware to log auth requests
const logAuthRequest = (req: any, res: any, next: any) => {
  logger.info('Auth request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  next();
};

// Apply logging to all auth routes
router.use(logAuthRequest);

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, confirmPassword, firstName, lastName }
 */
router.post('/register',
  checkTemporaryBlock,
  registrationLimiter,
  validateRegistration,
  validateRequest,
  validatePasswordMiddleware,
  asyncHandler(authController.register)
);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password, rememberMe? }
 */
router.post('/login',
  checkTemporaryBlock,
  loginAttemptLimiter,
  validateLogin,
  validateRequest,
  asyncHandler(authController.login)
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh',
  authLimiter,
  validateRefreshToken,
  validateRequest,
  asyncHandler(authController.refreshToken)
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (blacklist tokens)
 * @access  Private
 * @body    { refreshToken? }
 */
router.post('/logout',
  requireAuth,
  asyncHandler(authController.logout)
);

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  requireAuth,
  asyncHandler(authController.getProfile)
);

/**
 * @route   GET /auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.get('/verify',
  requireAuth,
  asyncHandler(authController.verifyToken)
);

/**
 * @route   POST /auth/check-password
 * @desc    Check password strength
 * @access  Public
 * @body    { password }
 */
router.post('/check-password',
  authLimiter,
  validatePasswordCheck,
  validateRequest,
  checkPasswordStrengthMiddleware
);

/**
 * @route   GET /auth/health
 * @desc    Health check for auth service
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    data: {
      endpoints: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        refresh: 'POST /auth/refresh',
        logout: 'POST /auth/logout',
        profile: 'GET /auth/profile',
        verify: 'GET /auth/verify',
        checkPassword: 'POST /auth/check-password',
      },
      features: [
        'JWT Authentication',
        'Password Hashing (bcrypt)',
        'Input Validation',
        'Rate Limiting',
        'Token Blacklisting',
        'Password Strength Validation',
      ],
      security: {
        bcryptRounds: 'Configured',
        rateLimiting: 'Enabled',
        inputValidation: 'Enabled',
        passwordRequirements: 'Enforced',
      },
    },
  });
});

/**
 * @route   GET /auth/info
 * @desc    Get authentication configuration info
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      passwordRequirements: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        forbiddenPatterns: [
          'Consecutive identical characters (more than 2)',
          'Common sequences (123, abc, qwe)',
          'Common words (password, admin)',
        ],
      },
      tokenInfo: {
        accessTokenExpiry: '15 minutes',
        refreshTokenExpiry: '7 days',
        tokenType: 'Bearer',
      },
      rateLimits: {
        general: '10 requests per 15 minutes',
        login: '5 requests per 15 minutes',
        registration: '3 requests per hour',
      },
      supportedFeatures: [
        'User Registration',
        'User Login',
        'Token Refresh',
        'Secure Logout',
        'Profile Access',
        'Token Verification',
        'Password Strength Check',
      ],
    },
  });
});

export default router;
