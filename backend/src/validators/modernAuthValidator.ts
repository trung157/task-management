/**
 * Modern Authentication Validators
 * 
 * Comprehensive input validation for authentication endpoints using express-validator
 */

import { body, header, query } from 'express-validator';

/**
 * Email validation rules
 */
const emailValidation = body('email')
  .isEmail()
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Please provide a valid email address (max 255 characters)');

/**
 * Password validation rules for registration
 */
const passwordValidation = [
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .not()
    .matches(/(.)\1{2,}/)
    .withMessage('Password cannot contain more than 2 consecutive identical characters')
    .not()
    .matches(/(123|abc|qwe|password|admin)/i)
    .withMessage('Password cannot contain common sequences or words'),
];

/**
 * Password confirmation validation
 */
const passwordConfirmValidation = body('confirmPassword')
  .custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  });

/**
 * Name validation rules
 */
const nameValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes'),
];

/**
 * Registration validation rules
 */
export const validateRegistration = [
  emailValidation,
  ...passwordValidation,
  passwordConfirmValidation,
  ...nameValidation,
  
  // Optional fields
  body('acceptTerms')
    .optional()
    .isBoolean()
    .withMessage('Accept terms must be a boolean'),
];

/**
 * Login validation rules
 */
export const validateLogin = [
  emailValidation,
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean'),
];

/**
 * Refresh token validation rules
 */
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid refresh token format'),
];

/**
 * Password check validation rules
 */
export const validatePasswordCheck = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),
];

/**
 * Authorization header validation
 */
export const validateAuthHeader = [
  header('authorization')
    .optional()
    .matches(/^Bearer\s[\w-]*\.[\w-]*\.[\w-]*$/)
    .withMessage('Invalid authorization header format'),
];

/**
 * Email verification validation
 */
export const validateEmailVerification = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 32, max: 128 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Invalid verification token format'),
];

/**
 * Password reset request validation
 */
export const validatePasswordResetRequest = [
  emailValidation,
];

/**
 * Password reset validation
 */
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 128 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Invalid reset token format'),
  
  ...passwordValidation,
  passwordConfirmValidation,
];

/**
 * Profile update validation
 */
export const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Please provide a valid email address (max 255 characters)'),
];

/**
 * Change password validation
 */
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
];

/**
 * Common sanitization rules
 */
export const sanitizeInput = [
  body('*')
    .trim()
    .escape(), // HTML escape for security
];

/**
 * Rate limiting validation
 */
export const validateRateLimit = [
  query('ip')
    .optional()
    .isIP()
    .withMessage('Invalid IP address format'),
];

// Export all validators
export default {
  validateRegistration,
  validateLogin,
  validateRefreshToken,
  validatePasswordCheck,
  validateAuthHeader,
  validateEmailVerification,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateProfileUpdate,
  validateChangePassword,
  sanitizeInput,
  validateRateLimit,
};
