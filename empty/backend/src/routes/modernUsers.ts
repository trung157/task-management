/**
 * Modern User Routes
 * 
 * RESTful routes for user management using the ModernUserController
 * and AdvancedUserService. Includes authentication, profile management,
 * password reset, and admin functionality.
 */

import { Router } from 'express';
import { ModernUserController, userValidationRules } from '../controllers/modernUserController';
import { jwtAuth } from '../middleware/jwtAuth';
import { authLimiter } from '../middleware/rateLimiting';

const router = Router();
const userController = new ModernUserController();

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

/**
 * @route   POST /api/v1/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  userValidationRules.register,
  userController.register
);

/**
 * @route   POST /api/v1/users/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  userValidationRules.login,
  userController.login
);

/**
 * @route   POST /api/v1/users/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', userController.refreshToken);

/**
 * @route   POST /api/v1/users/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout', jwtAuth, userController.logout);

// =====================================================
// USER PROFILE ROUTES
// =====================================================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', jwtAuth, userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/profile',
  jwtAuth,
  userValidationRules.updateProfile,
  userController.updateProfile
);

/**
 * @route   PUT /api/v1/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/change-password',
  jwtAuth,
  userValidationRules.changePassword,
  userController.changePassword
);

// =====================================================
// PASSWORD RESET ROUTES
// =====================================================

/**
 * @route   POST /api/v1/users/request-password-reset
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/request-password-reset',
  authLimiter,
  userValidationRules.requestPasswordReset,
  userController.requestPasswordReset
);

/**
 * @route   POST /api/v1/users/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post(
  '/reset-password',
  authLimiter,
  userValidationRules.resetPassword,
  userController.resetPassword
);

// =====================================================
// EMAIL VERIFICATION ROUTES
// =====================================================

/**
 * @route   GET /api/v1/users/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email/:token', userController.verifyEmail);

/**
 * @route   POST /api/v1/users/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', jwtAuth, userController.resendEmailVerification);

// =====================================================
// ADMIN ROUTES
// =====================================================

/**
 * @route   GET /api/v1/users/search
 * @desc    Search and list users (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/search',
  jwtAuth,
  userValidationRules.searchUsers,
  userController.searchUsers
);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID (Admin only)
 * @access  Private (Admin)
 */
router.get('/:userId', jwtAuth, userController.getUserById);

/**
 * @route   PUT /api/v1/users/:userId/role
 * @desc    Update user role (Super Admin only)
 * @access  Private (Super Admin)
 */
router.put(
  '/:userId/role',
  jwtAuth,
  userValidationRules.updateUserRole,
  userController.updateUserRole
);

/**
 * @route   POST /api/v1/users/:userId/suspend
 * @desc    Suspend user account (Admin only)
 * @access  Private (Admin)
 */
router.post('/:userId/suspend', jwtAuth, userController.suspendUser);

export default router;
