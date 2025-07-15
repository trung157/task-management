import { body, param, query } from 'express-validator';

/**
 * Validation rules for creating a new user (Admin only)
 */
export const validateCreateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('role')
    .optional()
    .isIn(['user', 'admin', 'super_admin'])
    .withMessage('Role must be one of: user, admin, super_admin'),
  
  body('timezone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Timezone must be less than 50 characters'),
  
  body('language_code')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Language code must be less than 10 characters'),
];

/**
 * Validation rules for listing users (Admin only)
 */
export const validateListUsers = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('role')
    .optional()
    .isIn(['user', 'admin', 'super_admin'])
    .withMessage('Role must be one of: user, admin, super_admin'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be one of: active, inactive, suspended'),
  
  query('email_verified')
    .optional()
    .isBoolean()
    .withMessage('Email verified must be a boolean'),
  
  query('created_after')
    .optional()
    .isISO8601()
    .withMessage('Created after must be a valid ISO 8601 date'),
  
  query('created_before')
    .optional()
    .isISO8601()
    .withMessage('Created before must be a valid ISO 8601 date'),
  
  query('last_login_after')
    .optional()
    .isISO8601()
    .withMessage('Last login after must be a valid ISO 8601 date'),
  
  query('last_login_before')
    .optional()
    .isISO8601()
    .withMessage('Last login before must be a valid ISO 8601 date'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at', 'last_login_at', 'email', 'first_name', 'last_name'])
    .withMessage('Sort by must be one of: created_at, updated_at, last_login_at, email, first_name, last_name'),
  
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
];

/**
 * Validation rules for searching users (Admin only)
 */
export const validateSearchUsers = [
  query('q')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query is required and must be between 1 and 100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

/**
 * Validation rules for updating user profile
 */
export const validateUpdateProfile = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('timezone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Timezone must be less than 50 characters'),
  
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be one of: light, dark, auto'),
  
  body('preferences.language')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Language must be less than 10 characters'),
  
  body('preferences.notifications')
    .optional()
    .isObject()
    .withMessage('Notifications preferences must be an object'),
  
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),
  
  body('preferences.notifications.desktop')
    .optional()
    .isBoolean()
    .withMessage('Desktop notification preference must be a boolean'),
];

/**
 * Validation rules for changing password
 */
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
];

/**
 * Validation rules for updating email
 */
export const validateUpdateEmail = [
  body('newEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required to change email'),
];

/**
 * Validation rules for deleting account
 */
export const validateDeleteAccount = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),
  
  body('confirmation')
    .equals('DELETE_MY_ACCOUNT')
    .withMessage('Please type "DELETE_MY_ACCOUNT" to confirm account deletion'),
];

/**
 * Validation rules for user ID parameter
 */
export const validateUserId = [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
];

/**
 * Validation rules for uploading avatar
 */
export const validateAvatarUpload = [
  // File validation will be handled by multer middleware
  // This is for any additional validation after file upload
];

/**
 * Validation rules for updating notification preferences
 */
export const validateNotificationPreferences = [
  body('email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  
  body('push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),
  
  body('desktop')
    .optional()
    .isBoolean()
    .withMessage('Desktop notification preference must be a boolean'),
  
  body('taskReminders')
    .optional()
    .isBoolean()
    .withMessage('Task reminders preference must be a boolean'),
  
  body('dueDateAlerts')
    .optional()
    .isBoolean()
    .withMessage('Due date alerts preference must be a boolean'),
  
  body('weeklyDigest')
    .optional()
    .isBoolean()
    .withMessage('Weekly digest preference must be a boolean'),
];

/**
 * Validation rules for export data request
 */
export const validateExportData = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be either json or csv'),
  
  query('includeDeleted')
    .optional()
    .isBoolean()
    .withMessage('Include deleted must be a boolean'),
];
