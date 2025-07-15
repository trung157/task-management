/**
 * Password Validation Middleware
 * 
 * Comprehensive password validation with strength requirements:
 * - Length requirements (8-128 characters)
 * - Character complexity (uppercase, lowercase, numbers, special chars)
 * - Pattern validation (no common sequences, repetition)
 * - Dictionary checks (common passwords, personal info)
 * - Real-time strength scoring
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import config from '../config/config';

// Password strength configuration
interface PasswordConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxRepeatingChars: number;
  forbiddenPatterns: string[];
  commonPasswords: string[];
}

const passwordConfig: PasswordConfig = {
  minLength: config.security.minPasswordLength || 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxRepeatingChars: 2,
  forbiddenPatterns: [
    '123', '234', '345', '456', '567', '678', '789', '890',
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
    'qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop',
    'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl',
    'zxc', 'xcv', 'cvb', 'vbn', 'bnm',
  ],
  commonPasswords: [
    'password', 'Password', 'password123', 'Password123',
    'admin', 'Admin', 'administrator', 'root', 'user',
    'welcome', 'Welcome', 'letmein', 'monkey', 'dragon',
    'sunshine', 'princess', 'football', 'baseball', 'superman',
    'trustno1', 'iloveyou', 'starwars', 'montypython',
    '12345678', '123456789', '1234567890', 'qwerty',
    'asdfgh', 'zxcvbn', 'password1', 'admin123',
  ],
};

// Password strength levels
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
  VERY_STRONG = 5,
}

// Password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  errors: string[];
  suggestions: string[];
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    specialChars: boolean;
    noRepeating: boolean;
    noCommonPatterns: boolean;
    noCommonPasswords: boolean;
  };
}

/**
 * Validate password length
 */
const validateLength = (password: string): { valid: boolean; error?: string } => {
  if (password.length < passwordConfig.minLength) {
    return {
      valid: false,
      error: `Password must be at least ${passwordConfig.minLength} characters long`,
    };
  }
  if (password.length > passwordConfig.maxLength) {
    return {
      valid: false,
      error: `Password must be no more than ${passwordConfig.maxLength} characters long`,
    };
  }
  return { valid: true };
};

/**
 * Validate character requirements
 */
const validateCharacterRequirements = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (passwordConfig.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (passwordConfig.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate against repeating characters
 */
const validateRepeatingChars = (password: string): { valid: boolean; error?: string } => {
  const regex = new RegExp(`(.)\\1{${passwordConfig.maxRepeatingChars},}`);
  if (regex.test(password)) {
    return {
      valid: false,
      error: `Password cannot contain more than ${passwordConfig.maxRepeatingChars} consecutive identical characters`,
    };
  }
  return { valid: true };
};

/**
 * Validate against common patterns
 */
const validateCommonPatterns = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const lowerPassword = password.toLowerCase();

  for (const pattern of passwordConfig.forbiddenPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push(`Password cannot contain common sequence "${pattern}"`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate against common passwords
 */
const validateCommonPasswords = (password: string): { valid: boolean; error?: string } => {
  const lowerPassword = password.toLowerCase();
  
  for (const commonPassword of passwordConfig.commonPasswords) {
    if (lowerPassword === commonPassword.toLowerCase()) {
      return {
        valid: false,
        error: 'Password is too common and easily guessable',
      };
    }
  }

  return { valid: true };
};

/**
 * Validate against personal information
 */
const validatePersonalInfo = (password: string, userData?: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!userData) return { valid: true, errors };

  const lowerPassword = password.toLowerCase();
  const personalData = [
    userData.firstName?.toLowerCase(),
    userData.lastName?.toLowerCase(),
    userData.email?.split('@')[0]?.toLowerCase(),
    userData.username?.toLowerCase(),
  ].filter(Boolean);

  for (const data of personalData) {
    if (data && data.length > 2 && lowerPassword.includes(data)) {
      errors.push('Password cannot contain personal information');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Calculate password strength score
 */
const calculatePasswordScore = (password: string): number => {
  let score = 0;

  // Length bonus
  score += Math.min(password.length * 2, 25);

  // Character variety bonus
  if (/[a-z]/.test(password)) score += 5;
  if (/[A-Z]/.test(password)) score += 5;
  if (/\d/.test(password)) score += 5;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;

  // Complexity bonus
  const charTypes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
  ].filter(Boolean).length;

  score += charTypes * 5;

  // Entropy bonus (character distribution)
  const charFreq = new Map<string, number>();
  for (const char of password) {
    charFreq.set(char, (charFreq.get(char) || 0) + 1);
  }
  const entropy = [...charFreq.values()].reduce((sum, freq) => {
    const p = freq / password.length;
    return sum - p * Math.log2(p);
  }, 0);
  score += Math.round(entropy * 2);

  // Penalties
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeating characters
  if (/(012|123|234|345|456|567|678|789|890)/.test(password)) score -= 10; // Sequential numbers
  if (/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) score -= 10; // Sequential letters

  return Math.max(0, Math.min(100, score));
};

/**
 * Determine password strength level
 */
const getPasswordStrength = (score: number): PasswordStrength => {
  if (score >= 90) return PasswordStrength.VERY_STRONG;
  if (score >= 70) return PasswordStrength.STRONG;
  if (score >= 50) return PasswordStrength.GOOD;
  if (score >= 30) return PasswordStrength.FAIR;
  if (score >= 10) return PasswordStrength.WEAK;
  return PasswordStrength.VERY_WEAK;
};

/**
 * Generate password suggestions
 */
const generateSuggestions = (validationResult: PasswordValidationResult): string[] => {
  const suggestions: string[] = [];

  if (!validationResult.requirements.length) {
    suggestions.push(`Use at least ${passwordConfig.minLength} characters`);
  }

  if (!validationResult.requirements.uppercase) {
    suggestions.push('Add uppercase letters (A-Z)');
  }

  if (!validationResult.requirements.lowercase) {
    suggestions.push('Add lowercase letters (a-z)');
  }

  if (!validationResult.requirements.numbers) {
    suggestions.push('Add numbers (0-9)');
  }

  if (!validationResult.requirements.specialChars) {
    suggestions.push('Add special characters (!@#$%^&*...)');
  }

  if (!validationResult.requirements.noRepeating) {
    suggestions.push('Avoid repeating characters');
  }

  if (!validationResult.requirements.noCommonPatterns) {
    suggestions.push('Avoid common sequences like "123" or "abc"');
  }

  if (!validationResult.requirements.noCommonPasswords) {
    suggestions.push('Use a unique password, not a common one');
  }

  if (validationResult.strength < PasswordStrength.GOOD) {
    suggestions.push('Consider using a longer password');
    suggestions.push('Mix different types of characters');
    suggestions.push('Use uncommon words or phrases');
  }

  return suggestions;
};

/**
 * Comprehensive password validation function
 */
export const validatePasswordStrength = (password: string, userData?: any): PasswordValidationResult => {
  const errors: string[] = [];
  const requirements = {
    length: false,
    uppercase: false,
    lowercase: false,
    numbers: false,
    specialChars: false,
    noRepeating: false,
    noCommonPatterns: false,
    noCommonPasswords: false,
  };

  // Validate length
  const lengthCheck = validateLength(password);
  requirements.length = lengthCheck.valid;
  if (!lengthCheck.valid) {
    errors.push(lengthCheck.error!);
  }

  // Validate character requirements
  const charCheck = validateCharacterRequirements(password);
  requirements.uppercase = passwordConfig.requireUppercase ? /[A-Z]/.test(password) : true;
  requirements.lowercase = passwordConfig.requireLowercase ? /[a-z]/.test(password) : true;
  requirements.numbers = passwordConfig.requireNumbers ? /\d/.test(password) : true;
  requirements.specialChars = passwordConfig.requireSpecialChars ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true;
  
  if (!charCheck.valid) {
    errors.push(...charCheck.errors);
  }

  // Validate repeating characters
  const repeatingCheck = validateRepeatingChars(password);
  requirements.noRepeating = repeatingCheck.valid;
  if (!repeatingCheck.valid) {
    errors.push(repeatingCheck.error!);
  }

  // Validate common patterns
  const patternCheck = validateCommonPatterns(password);
  requirements.noCommonPatterns = patternCheck.valid;
  if (!patternCheck.valid) {
    errors.push(...patternCheck.errors);
  }

  // Validate common passwords
  const commonPasswordCheck = validateCommonPasswords(password);
  requirements.noCommonPasswords = commonPasswordCheck.valid;
  if (!commonPasswordCheck.valid) {
    errors.push(commonPasswordCheck.error!);
  }

  // Validate personal information
  const personalInfoCheck = validatePersonalInfo(password, userData);
  if (!personalInfoCheck.valid) {
    errors.push(...personalInfoCheck.errors);
  }

  // Calculate score and strength
  const score = calculatePasswordScore(password);
  const strength = getPasswordStrength(score);
  const isValid = errors.length === 0 && strength >= PasswordStrength.FAIR;

  const result: PasswordValidationResult = {
    isValid,
    strength,
    score,
    errors,
    suggestions: [],
    requirements,
  };

  result.suggestions = generateSuggestions(result);

  return result;
};

/**
 * Express validator middleware for password validation
 */
export const passwordValidationRules = [
  body('password')
    .custom(async (value, { req }) => {
      const userData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        username: req.body.username,
      };

      const validation = validatePasswordStrength(value, userData);
      
      if (!validation.isValid) {
        const errorMessage = validation.errors.join('; ');
        throw new Error(errorMessage);
      }

      // Store validation result for use in controller
      req.passwordValidation = validation;
      return true;
    }),
];

/**
 * Middleware to validate password strength and provide feedback
 */
export const validatePasswordMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required', 400, 'MISSING_PASSWORD');
    }

    const userData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      username: req.body.username,
    };

    const validation = validatePasswordStrength(password, userData);

    // Log password strength attempt
    logger.debug('Password strength validation', {
      strength: PasswordStrength[validation.strength],
      score: validation.score,
      isValid: validation.isValid,
      ip: req.ip,
    });

    if (!validation.isValid) {
      throw new AppError(
        'Password does not meet security requirements',
        400,
        'WEAK_PASSWORD'
      );
    }

    // Store validation result for controller use
    (req as any).passwordValidation = validation;
    next();

  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Password validation middleware error', { error, ip: req.ip });
      next(new AppError('Password validation failed', 500, 'VALIDATION_ERROR'));
    }
  }
};

/**
 * Middleware to check password strength without enforcing requirements
 */
export const checkPasswordStrengthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { password } = req.body;

    if (!password) {
      res.json({
        success: true,
        data: {
          message: 'No password provided',
          strength: 'N/A',
          score: 0,
        },
      });
      return;
    }

    const validation = validatePasswordStrength(password);

    res.json({
      success: true,
      data: {
        strength: PasswordStrength[validation.strength],
        score: validation.score,
        isValid: validation.isValid,
        errors: validation.errors,
        suggestions: validation.suggestions,
        requirements: {
          ...validation.requirements,
          config: passwordConfig,
        },
        strengthLevels: {
          0: 'Very Weak',
          1: 'Weak',
          2: 'Fair',
          3: 'Good',
          4: 'Strong',
          5: 'Very Strong',
        },
      },
    });

  } catch (error) {
    logger.error('Password strength check error', { error, ip: req.ip });
    next(new AppError('Password strength check failed', 500, 'STRENGTH_CHECK_ERROR'));
  }
};

// Export configuration for testing and customization
export { passwordConfig, PasswordConfig };

// Export default with all functions
export default {
  validatePasswordStrength,
  validatePasswordMiddleware,
  checkPasswordStrengthMiddleware,
  passwordValidationRules,
  passwordConfig,
  PasswordStrength,
};
