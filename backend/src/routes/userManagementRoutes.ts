/**
 * User Management Routes
 * 
 * Comprehensive routes for user management including:
 * - Authentication (register, login, logout)
 * - Profile management
 * - Password management
 * - Email verification
 * - Admin user operations
 * - Input validation and security
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  UserManagementController,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  updatePreferencesValidation,
  changePasswordValidation,
  resetPasswordValidation,
  userIdValidation
} from '../controllers/userManagementController';
import { jwtAuth } from '../middleware/jwtAuth';
import { authLimiter } from '../middleware/rateLimiting';

const router = Router();

// Apply rate limiting to authentication routes
router.use('/auth', authLimiter);

// =====================================================
// AUTHENTICATION ROUTES (Public)
// =====================================================

/**
 * @route   POST /api/users/auth/register
 * @desc    Register a new user account
 * @access  Public
 * @body    {object} User registration data
 * @body    {string} email - Valid email address (required)
 * @body    {string} password - Strong password (required, 8+ chars with mixed case, numbers, symbols)
 * @body    {string} first_name - First name (required, 1-50 chars)
 * @body    {string} last_name - Last name (required, 1-50 chars)
 * @body    {string} [timezone] - User timezone (default: UTC)
 * @body    {string} [language_code] - Language preference (2-5 chars, default: en)
 * @body    {boolean} terms_accepted - Must be true (required)
 * @body    {boolean} [marketing_consent] - Marketing email consent (default: false)
 * @body    {string} [referral_code] - Referral code if applicable
 */
router.post('/auth/register', registerValidation, UserManagementController.register);

/**
 * @route   POST /api/users/auth/login
 * @desc    Authenticate user and get access token
 * @access  Public
 * @body    {object} Login credentials
 * @body    {string} email - User email address (required)
 * @body    {string} password - User password (required)
 * @body    {boolean} [remember_me] - Extended session (default: false)
 * @body    {string} [device_info] - Device information for security
 */
router.post('/auth/login', loginValidation, UserManagementController.login);

/**
 * @route   POST /api/users/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    {object} Refresh token data
 * @body    {string} [refresh_token] - Refresh token (can also be in HTTP-only cookie)
 */
router.post('/auth/refresh', UserManagementController.refreshToken);

/**
 * @route   POST /api/users/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 * @body    {object} Logout data
 * @body    {string} [refresh_token] - Refresh token to invalidate (optional if in cookie)
 */
router.post('/auth/logout', jwtAuth, UserManagementController.logout);

/**
 * @route   POST /api/users/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * @body    {object} Password reset request
 * @body    {string} email - Email address to send reset link
 */
router.post('/auth/forgot-password', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], UserManagementController.requestPasswordReset);

/**
 * @route   POST /api/users/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    {object} Password reset data
 * @body    {string} token - Password reset token from email
 * @body    {string} new_password - New password (8+ chars with complexity requirements)
 */
router.post('/auth/reset-password', resetPasswordValidation, UserManagementController.resetPassword);

/**
 * @route   POST /api/users/auth/verify-email
 * @desc    Verify email address using verification token
 * @access  Public
 * @body    {object} Email verification data
 * @body    {string} token - Email verification token
 * @body    {string} email - Email address being verified
 */
router.post('/auth/verify-email', [
  body('token').isString().isLength({ min: 1 }).withMessage('Verification token is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], UserManagementController.verifyEmail);

/**
 * @route   POST /api/users/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private (must be logged in)
 */
router.post('/auth/resend-verification', [jwtAuth, authLimiter], UserManagementController.resendVerification);

// =====================================================
// PROFILE MANAGEMENT ROUTES (Private)
// =====================================================

// Apply authentication to all profile routes
router.use('/profile', jwtAuth);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile information
 * @access  Private
 */
router.get('/profile', UserManagementController.getProfile);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update current user's profile
 * @access  Private
 * @body    {object} Profile update data
 * @body    {string} [first_name] - First name (1-50 chars)
 * @body    {string} [last_name] - Last name (1-50 chars)
 * @body    {string} [bio] - User bio (max 500 chars)
 * @body    {string} [avatar_url] - Profile picture URL
 * @body    {string} [timezone] - User timezone
 * @body    {string} [language_code] - Language preference (2-5 chars)
 * @body    {string} [date_format] - Preferred date format
 * @body    {string} [time_format] - Preferred time format (12/24 hour)
 */
router.patch('/profile', updateProfileValidation, UserManagementController.updateProfile);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences and notification settings
 * @access  Private
 * @body    {object} [preferences] - User preferences object
 * @body    {object} [notification_settings] - Notification settings
 * @body    {boolean} [notification_settings.email_notifications] - Email notifications enabled
 * @body    {boolean} [notification_settings.push_notifications] - Push notifications enabled
 * @body    {boolean} [notification_settings.due_date_reminders] - Due date reminders enabled
 * @body    {boolean} [notification_settings.task_assignments] - Task assignment notifications enabled
 */
router.put('/preferences', updatePreferencesValidation, UserManagementController.updatePreferences);

/**
 * @route   POST /api/users/profile/change-password
 * @desc    Change user password
 * @access  Private
 * @body    {object} Password change data
 * @body    {string} current_password - Current password for verification
 * @body    {string} new_password - New password (8+ chars with complexity requirements)
 * @body    {string} confirm_password - Must match new_password
 */
router.post('/profile/change-password', changePasswordValidation, UserManagementController.changePassword);

// =====================================================
// ADMIN USER MANAGEMENT ROUTES (Admin Only)
// =====================================================

// Apply authentication to all admin routes
router.use('/admin', jwtAuth);

/**
 * @route   GET /api/users/admin/users
 * @desc    Search and list users (Admin only)
 * @access  Private (Admin)
 * @query   {string} [search] - Search term for name/email
 * @query   {string} [role] - Filter by user role
 * @query   {string} [status] - Filter by user status
 * @query   {boolean} [isVerified] - Filter by email verification status
 * @query   {string} [createdFrom] - Filter by creation date (ISO format)
 * @query   {string} [createdTo] - Filter by creation date (ISO format)
 * @query   {number} [page] - Page number (default: 1)
 * @query   {number} [limit] - Items per page (default: 20, max: 100)
 * @query   {string} [sortBy] - Sort field (default: created_at)
 * @query   {string} [sortOrder] - Sort direction: asc/desc (default: desc)
 */
router.get('/admin/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim().isLength({ max: 200 }).withMessage('Search term too long'),
  query('role').optional().isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
  query('sortBy').optional().isIn(['created_at', 'updated_at', 'email', 'first_name', 'last_name']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], UserManagementController.searchUsers);

/**
 * @route   GET /api/users/admin/users/:id
 * @desc    Get specific user by ID (Admin only)
 * @access  Private (Admin)
 * @param   {string} id - User UUID
 */
router.get('/admin/users/:id', userIdValidation, UserManagementController.getUserById);

/**
 * @route   PATCH /api/users/admin/users/:id/role
 * @desc    Update user role (Admin only)
 * @access  Private (Admin)
 * @param   {string} id - User UUID
 * @body    {object} Role update data
 * @body    {string} role - New role: user, admin, super_admin
 * @body    {string} [reason] - Reason for role change
 */
router.patch('/admin/users/:id/role', [
  ...userIdValidation,
  body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason too long')
], UserManagementController.updateUserRole);

/**
 * @route   POST /api/users/admin/users/:id/suspend
 * @desc    Suspend user account (Admin only)
 * @access  Private (Admin)
 * @param   {string} id - User UUID
 * @body    {object} Suspension data
 * @body    {string} reason - Reason for suspension (required)
 * @body    {number} [duration_days] - Suspension duration in days
 */
router.post('/admin/users/:id/suspend', [
  ...userIdValidation,
  body('reason').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Reason is required and must be under 500 characters'),
  body('duration_days').optional().isInt({ min: 1, max: 365 }).withMessage('Duration must be between 1 and 365 days')
], UserManagementController.suspendUser);

// =====================================================
// USER PREFERENCES AND SETTINGS (Private)
// =====================================================

/**
 * @route   PATCH /api/users/preferences
 * @desc    Update user preferences and notification settings
 * @access  Private
 * @body    {object} Preferences data
 * @body    {object} [preferences] - Custom user preferences
 * @body    {object} [notification_settings] - Notification preferences
 * @body    {boolean} [notification_settings.email_notifications] - Email notifications
 * @body    {boolean} [notification_settings.push_notifications] - Push notifications
 * @body    {boolean} [notification_settings.due_date_reminders] - Due date reminders
 * @body    {boolean} [notification_settings.task_assignments] - Task assignment notifications
 */
router.patch('/preferences', [
  jwtAuth,
  body('preferences').optional().isObject().withMessage('Preferences must be an object'),
  body('notification_settings').optional().isObject().withMessage('Notification settings must be an object'),
  body('notification_settings.email_notifications').optional().isBoolean().withMessage('Email notifications must be boolean'),
  body('notification_settings.push_notifications').optional().isBoolean().withMessage('Push notifications must be boolean'),
  body('notification_settings.due_date_reminders').optional().isBoolean().withMessage('Due date reminders must be boolean'),
  body('notification_settings.task_assignments').optional().isBoolean().withMessage('Task assignments must be boolean')
], async (req: any, res: any, next: any) => {
  // This would need to be implemented in the controller
  res.status(501).json({ message: 'Preferences update not yet implemented' });
});

export default router;
