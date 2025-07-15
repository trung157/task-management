import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import config from '../config/config';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { EmailService } from '../services/emailService';
import { EnhancedRateLimiter } from '../middleware/rateLimiting';
import { PasswordValidator } from '../validators/passwordValidator';

export class AuthController {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Register a new user
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('User already exists with this email', 409, 'USER_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, first_name, last_name, email, email_verified, role, created_at`,
      [userId, firstName, lastName, email, hashedPassword]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    logger.info('User registered successfully:', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          emailVerified: user.email_verified,
          role: user.role,
          createdAt: user.created_at,
        },
        token,
        refreshToken,
      },
    });
  };

  /**
   * Login user
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
      // Find user
      const result = await pool.query(
        'SELECT id, first_name, last_name, email, password_hash, email_verified, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        // Track failed attempt for non-existent user
        EnhancedRateLimiter.trackFailedAttempt(req);
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        // Track failed attempt for wrong password
        EnhancedRateLimiter.trackFailedAttempt(req);
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Clear failed attempts on successful login
      EnhancedRateLimiter.clearFailedAttempts(req);

      // Update last login
      await pool.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await pool.query(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
        [uuidv4(), user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );

      logger.info('User logged in successfully:', { userId: user.id, email: user.email });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            emailVerified: user.email_verified,
            role: user.role,
          },
          accessToken: token,
          refreshToken,
        },
      });
    } catch (error) {
      // Re-throw the error to be handled by the global error handler
      throw error;
    }
  };

  /**
   * Logout user
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.body.refreshToken;

    if (refreshToken) {
      // Remove refresh token from database
      await pool.query(
        'DELETE FROM refresh_tokens WHERE token = $1',
        [refreshToken]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { id: string; email: string };
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Check if refresh token exists in database
    const tokenResult = await pool.query(
      'SELECT id, user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError('Refresh token not found or expired', 401, 'REFRESH_TOKEN_NOT_FOUND');
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email, email_verified, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found or inactive', 401, 'USER_NOT_FOUND');
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const newToken = this.generateToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Remove old refresh token and add new one
    await pool.query('BEGIN');
    try {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      await pool.query(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
        [uuidv4(), user.id, newRefreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  };

  /**
   * Forgot password
   */
  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Don't reveal if user exists or not
    if (result.rows.length === 0) {
      res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
      return;
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await pool.query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(email, `${user.first_name} ${user.last_name}`, resetToken);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new AppError('Failed to send password reset email', 500, 'EMAIL_SEND_FAILED');
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    });
  };

  /**
   * Reset password
   */
  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;

    // Find user with valid reset token
    const result = await pool.query(
      'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    const user = result.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    // Invalidate all refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    logger.info('Password reset successfully:', { userId: user.id });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  };

  /**
   * Change password (authenticated user)
   */
  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const user = result.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400, 'INCORRECT_PASSWORD');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    // Invalidate all refresh tokens except current session
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

    logger.info('Password changed successfully:', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  };

  /**
   * Verify email
   */
  public verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    // Find user with verification token
    const result = await pool.query(
      'SELECT id FROM users WHERE email_verification_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid verification token', 400, 'INVALID_VERIFICATION_TOKEN');
    }

    const user = result.rows[0];

    // Update user as verified
    await pool.query(
      `UPDATE users 
       SET is_email_verified = true, email_verification_token = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    logger.info('Email verified successfully:', { userId: user.id });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  };

  /**
   * Resend verification email
   */
  public resendVerification = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT id, first_name, last_name, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.json({
        success: true,
        message: 'If an account with that email exists and is not verified, we have sent a verification email.',
      });
      return;
    }

    const user = result.rows[0];

    if (user.is_email_verified) {
      res.json({
        success: true,
        message: 'Email is already verified',
      });
      return;
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Update token
    await pool.query(
      'UPDATE users SET email_verification_token = $1 WHERE id = $2',
      [verificationToken, user.id]
    );

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(email, `${user.first_name} ${user.last_name}`, verificationToken);
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      throw new AppError('Failed to send verification email', 500, 'EMAIL_SEND_FAILED');
    }

    res.json({
      success: true,
      message: 'If an account with that email exists and is not verified, we have sent a verification email.',
    });
  };

  /**
   * Check password strength (utility endpoint)
   */
  public checkPasswordStrength = async (req: Request, res: Response): Promise<void> => {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required', 400, 'MISSING_PASSWORD');
    }

    const strength = PasswordValidator.calculateStrength(password);

    res.json({
      success: true,
      data: {
        strength,
        recommendations: strength.feedback,
      },
    });
  };

  /**
   * Generate JWT access token
   */
  private generateToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      }
    );
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.refreshSecret,
      {
        expiresIn: config.jwt.refreshExpiresIn,
      }
    );
  }
}
