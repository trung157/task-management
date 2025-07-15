import { body, ValidationChain } from 'express-validator';

/**
 * Enhanced password validation with comprehensive security rules
 */
export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;
  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'shadow', 'login', 'admin123'
  ];

  /**
   * Get enhanced password validation rules
   */
  static getValidationRules(): ValidationChain[] {
    return [
      body('password')
        .isLength({ min: this.MIN_LENGTH, max: this.MAX_LENGTH })
        .withMessage(`Password must be between ${this.MIN_LENGTH} and ${this.MAX_LENGTH} characters long`)
        .custom(this.validatePasswordStrength)
        .custom(this.validateNoCommonPasswords)
        .custom(this.validateNoUserInfo),
    ];
  }

  /**
   * Validate password strength requirements
   */
  private static validatePasswordStrength(password: string): boolean | never {
    const errors: string[] = [];

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('at least one lowercase letter');
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('at least one uppercase letter');
    }

    // Check for number
    if (!/\d/.test(password)) {
      errors.push('at least one number');
    }

    // Check for special character
    if (!/[@$!%*?&^#()_+=\-\[\]{}|;:,.<>~`]/.test(password)) {
      errors.push('at least one special character (@$!%*?&^#()_+=-[]{}|;:,.<>~`)');
    }

    // Check for no more than 2 consecutive identical characters
    if (/(.)\1{2,}/.test(password)) {
      errors.push('no more than 2 consecutive identical characters');
    }

    // Check for no simple sequences
    if (this.hasSimpleSequence(password)) {
      errors.push('no simple sequences (like 123, abc, qwe)');
    }

    if (errors.length > 0) {
      throw new Error(`Password must contain ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Check for simple character sequences
   */
  private static hasSimpleSequence(password: string): boolean {
    const sequences = [
      '123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop',
      'asdfghjkl', 'zxcvbnm', '987654321', 'zyxwvutsrqponmlkjihgfedcba'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subSeq = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(subSeq)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validate against common passwords
   */
  private static validateNoCommonPasswords(password: string): boolean | never {
    const lowerPassword = password.toLowerCase();
    
    for (const commonPassword of this.COMMON_PASSWORDS) {
      if (lowerPassword.includes(commonPassword) || 
          lowerPassword === commonPassword ||
          this.isVariantOfCommonPassword(lowerPassword, commonPassword)) {
        throw new Error('Password is too common. Please choose a more unique password.');
      }
    }

    return true;
  }

  /**
   * Check if password is a variant of common password (with numbers/symbols added)
   */
  private static isVariantOfCommonPassword(password: string, commonPassword: string): boolean {
    // Remove common number/symbol additions and check if it's still a common password
    const cleaned = password.replace(/[0-9@$!%*?&^#()_+=\-\[\]{}|;:,.<>~`]/g, '');
    return cleaned === commonPassword;
  }

  /**
   * Validate password doesn't contain user information
   */
  private static validateNoUserInfo(password: string, { req }: { req: any }): boolean | never {
    if (!req || !req.body) return true;

    const { firstName, lastName, email } = req.body;
    const lowerPassword = password.toLowerCase();

    // Check against first name
    if (firstName && lowerPassword.includes(firstName.toLowerCase())) {
      throw new Error('Password cannot contain your first name');
    }

    // Check against last name
    if (lastName && lowerPassword.includes(lastName.toLowerCase())) {
      throw new Error('Password cannot contain your last name');
    }

    // Check against email username
    if (email) {
      const emailUsername = email.split('@')[0].toLowerCase();
      if (emailUsername.length >= 3 && lowerPassword.includes(emailUsername)) {
        throw new Error('Password cannot contain your email username');
      }
    }

    return true;
  }

  /**
   * Calculate password strength score (0-100)
   */
  static calculateStrength(password: string): {
    score: number;
    level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    // Length scoring
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    else if (password.length < 8) feedback.push('Use at least 8 characters');

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 10;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 10;
    else feedback.push('Add uppercase letters');

    if (/\d/.test(password)) score += 10;
    else feedback.push('Add numbers');

    if (/[@$!%*?&^#()_+=\-\[\]{}|;:,.<>~`]/.test(password)) score += 15;
    else feedback.push('Add special characters');

    // Entropy and complexity
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 15);

    // Deduct points for patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Avoid repeated characters');
    }

    if (this.hasSimpleSequence(password)) {
      score -= 15;
      feedback.push('Avoid simple sequences');
    }

    // Common password check
    if (this.COMMON_PASSWORDS.some(common => 
      password.toLowerCase().includes(common))) {
      score -= 20;
      feedback.push('Avoid common words');
    }

    // Determine level
    let level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
    if (score < 30) level = 'Very Weak';
    else if (score < 50) level = 'Weak';
    else if (score < 70) level = 'Fair';
    else if (score < 85) level = 'Good';
    else level = 'Strong';

    return { score: Math.max(0, Math.min(100, score)), level, feedback };
  }

  /**
   * Validate password and return validation result
   */
  static validate(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    // Check maximum length
    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters`);
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    // Check for sequential characters
    if (/123|abc|qwe/i.test(password)) {
      errors.push('Password should not contain sequential characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Enhanced password validation for different contexts
 */
export const validateStrongPassword = PasswordValidator.getValidationRules();

/**
 * Password change validation (includes current password check)
 */
export const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters long')
    .custom(PasswordValidator['validatePasswordStrength'])
    .custom(PasswordValidator['validateNoCommonPasswords']),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
];

/**
 * Password reset validation
 */
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters long')
    .custom(PasswordValidator['validatePasswordStrength'])
    .custom(PasswordValidator['validateNoCommonPasswords']),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
];
