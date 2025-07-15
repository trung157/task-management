/**
 * Modern Authentication Controller
 * 
 * Complete authentication endpoints with:
 * - User registration with bcrypt password hashing
 * - User login with credential validation
 * - JWT token generation and refresh
 * - Input validation and sanitization
 * - Rate limiting and security features
 * - Password strength validation
 * - Email verification support
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { generateTokenPair, verifyRefreshToken } from '../config/jwt';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import config from '../config/config';
import db from '../config/database';
import { blacklistToken } from '../middleware/jwtAuth';

// User interface for database operations
interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

// Registration request interface
interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  confirmPassword?: string;
}

// Login request interface
interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: config.security.minPasswordLength || 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
};

/**
 * Validate password strength
 */
const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters long`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 consecutive identical characters');
  }

  if (/123|abc|qwe/i.test(password)) {
    errors.push('Password cannot contain common sequences');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize user data for response
 */
const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  fullName: `${user.first_name} ${user.last_name}`.trim(),
  role: user.role,
  isActive: user.is_active,
  emailVerified: user.email_verified,
  createdAt: user.created_at,
  lastLoginAt: user.last_login_at,
});

/**
 * Check if user exists by email
 */
const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const result = await db.query(
      `SELECT 
        id, email, password_hash, first_name, last_name, 
        role, is_active, email_verified, created_at, updated_at, last_login_at
      FROM users 
      WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error finding user by email', { email, error });
    throw new AppError('Database error', 500, 'DB_ERROR');
  }
};

/**
 * Create new user in database
 */
const createUser = async (userData: RegisterRequest): Promise<User> => {
  const { email, password, firstName, lastName } = userData;
  
  try {
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
    const userId = uuidv4();
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, 
        role, is_active, email_verified, email_verification_token,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING 
        id, email, password_hash, first_name, last_name, 
        role, is_active, email_verified, created_at, updated_at`,
      [
        userId,
        email.toLowerCase().trim(),
        hashedPassword,
        firstName.trim(),
        lastName.trim(),
        'user', // default role
        true,   // is_active
        false,  // email_verified
        emailVerificationToken
      ]
    );

    return result.rows[0];
  } catch (error) {
    if ((error as any).code === '23505') { // Unique violation
      throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
    }
    logger.error('Error creating user', { email, error });
    throw new AppError('Failed to create user', 500, 'USER_CREATION_FAILED');
  }
};

/**
 * Update user's last login timestamp
 */
const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    await db.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId]
    );
  } catch (error) {
    logger.error('Error updating last login', { userId, error });
    // Don't throw error, as this is not critical
  }
};

/**
 * Modern Authentication Controller Class
 */
export class ModernAuthController {
  /**
   * User Registration Endpoint
   * POST /auth/register
   */
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, confirmPassword, firstName, lastName }: RegisterRequest & { confirmPassword: string } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        throw new AppError('All fields are required', 400, 'MISSING_FIELDS');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      // Validate password confirmation
      if (confirmPassword && password !== confirmPassword) {
        throw new AppError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        const error = new AppError(
          'Password does not meet requirements',
          400,
          'WEAK_PASSWORD'
        );
        (error as any).details = { requirements: passwordValidation.errors };
        throw error;
      }

      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
      }

      // Create new user
      const newUser = await createUser({ email, password, firstName, lastName });

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      // Log successful registration
      logger.info('User registered successfully', {
        userId: newUser.id,
        email: newUser.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Send response
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: sanitizeUser(newUser),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
          },
        },
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * User Login Endpoint
   * POST /auth/login
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, rememberMe = false }: LoginRequest = req.body;

      // Validate required fields
      if (!email || !password) {
        throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
      }

      // Find user by email
      const user = await findUserByEmail(email);
      if (!user) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        logger.warn('Failed login attempt', {
          email: user.email,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Update last login timestamp
      await updateLastLogin(user.id);

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Log successful login
      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        rememberMe,
      });

      // Send response
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: sanitizeUser(user),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
          },
        },
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Token Refresh Endpoint
   * POST /auth/refresh
   */
  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
      }

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Find user to ensure they still exist and are active
      const user = await findUserByEmail(payload.email);
      if (!user || !user.is_active) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Generate new token pair
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Optionally blacklist the old refresh token
      blacklistToken(refreshToken);

      logger.info('Token refreshed successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
          },
        },
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * User Logout Endpoint
   * POST /auth/logout
   */
  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const { refreshToken } = req.body;

      // Blacklist access token if provided
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.substring(7);
        blacklistToken(accessToken);
      }

      // Blacklist refresh token if provided
      if (refreshToken) {
        blacklistToken(refreshToken);
      }

      logger.info('User logged out', {
        userId: req.authUser?.id,
        email: req.authUser?.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get Current User Profile
   * GET /auth/profile
   */
  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.authUser) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      // Fetch fresh user data
      const user = await findUserByEmail(req.authUser.email);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
        },
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify Token Endpoint
   * GET /auth/verify
   */
  public verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.authUser || !req.authTokenInfo) {
        throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
      }

      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.authUser,
          tokenInfo: {
            type: req.authTokenInfo.type,
            expiresAt: req.authTokenInfo.expiresAt,
            remainingTime: req.authTokenInfo.remainingTime,
          },
        },
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Password Strength Check Endpoint
   * POST /auth/check-password
   */
  public checkPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { password } = req.body;

      if (!password) {
        throw new AppError('Password is required', 400, 'MISSING_PASSWORD');
      }

      const validation = validatePasswordStrength(password);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          strength: validation.isValid ? 'strong' : 'weak',
          requirements: PASSWORD_REQUIREMENTS,
          errors: validation.errors,
          suggestions: validation.isValid ? [] : [
            'Use a mix of uppercase and lowercase letters',
            'Include numbers and special characters',
            'Avoid common patterns and sequences',
            'Make it at least 8 characters long',
          ],
        },
      });

    } catch (error) {
      next(error);
    }
  };
}

// Export singleton instance
export default new ModernAuthController();
