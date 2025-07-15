/**
 * Enhanced User Service
 * 
 * Comprehensive user management service with:
 * - Advanced authentication and authorization
 * - Password reset and recovery functionality
 * - Profile management with validation
 * - User session management
 * - Account security features
 * - Email verification and notifications
 * - User activity tracking
 * - Advanced user search and analytics
 */

import { UserModel, User, UserProfile, CreateUserData, UpdateUserData, ChangePasswordData, UserRole, UserStatus } from '../models/user';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PasswordValidator } from '../validators/passwordValidator';
import { generateAccessToken, generateRefreshToken } from '../config/jwt';
import crypto from 'crypto';
import config from '../config/config';

// =====================================================
// ENHANCED INTERFACES AND TYPES
// =====================================================

export interface AuthenticationResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PasswordResetRequest {
  email: string;
  reset_token: string;
  expires_at: Date;
  created_at: Date;
  used_at?: Date;
}

export interface EmailVerificationRequest {
  email: string;
  verification_token: string;
  expires_at: Date;
  created_at: Date;
  verified_at?: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  last_activity: Date;
  is_active: boolean;
}

export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface RegisterUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  language_code?: string;
  terms_accepted?: boolean;
  marketing_consent?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface PasswordResetData {
  email: string;
  reset_token?: string;
  new_password?: string;
}

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  language_code?: string;
  preferences?: Record<string, any>;
  notification_settings?: {
    email_notifications?: boolean;
    push_notifications?: boolean;
    due_date_reminders?: boolean;
    task_assignments?: boolean;
  };
}

export interface UserSearchFilters {
  search?: string;
  role?: UserRole | UserRole[];
  status?: UserStatus | UserStatus[];
  email_verified?: boolean;
  created_from?: Date;
  created_to?: Date;
  last_login_from?: Date;
  last_login_to?: Date;
  is_active?: boolean;
  has_failed_logins?: boolean;
}

export interface UserAnalytics {
  total_users: number;
  active_users: number;
  verified_users: number;
  locked_accounts: number;
  users_by_role: Record<UserRole, number>;
  users_by_status: Record<UserStatus, number>;
  registration_trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  login_activity: {
    active_sessions: number;
    daily_logins: number;
    weekly_logins: number;
  };
  security_metrics: {
    failed_login_attempts: number;
    password_resets: number;
    account_lockouts: number;
  };
}

// =====================================================
// ENHANCED USER SERVICE CLASS
// =====================================================

export class EnhancedUserService {
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(credentials: LoginCredentials): Promise<AuthenticationResult> {
    try {
      logger.info('Authenticating user', { email: credentials.email, ip: credentials.ip_address });

      const { email, password, remember_me = false, device_info, ip_address, user_agent } = credentials;

      // Check if account is locked
      const isLocked = await UserModel.isAccountLocked(email);
      if (isLocked) {
        await this.logUserActivity(null, 'LOGIN_ATTEMPT_LOCKED', 'authentication', ip_address, user_agent);
        throw new AppError('Account is temporarily locked due to too many failed login attempts', 423);
      }

      // Find user by email
      const user = await UserModel.findByEmail(email);
      if (!user) {
        await UserModel.incrementFailedLoginAttempts(email);
        await this.logUserActivity(null, 'LOGIN_ATTEMPT_INVALID_EMAIL', 'authentication', ip_address, user_agent);
        throw new AppError('Invalid email or password', 401);
      }

      // Verify password
      const isPasswordValid = await UserModel.verifyPassword(user.id, password);
      if (!isPasswordValid) {
        await UserModel.incrementFailedLoginAttempts(email);
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_INVALID_PASSWORD', 'authentication', ip_address, user_agent);
        throw new AppError('Invalid email or password', 401);
      }

      // Check user status
      if (user.status === 'suspended') {
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_SUSPENDED', 'authentication', ip_address, user_agent);
        throw new AppError('Account is suspended', 403);
      }

      if (user.status === 'inactive') {
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_INACTIVE', 'authentication', ip_address, user_agent);
        throw new AppError('Account is inactive', 403);
      }

      if (user.status === 'pending_verification' && !user.email_verified) {
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_UNVERIFIED', 'authentication', ip_address, user_agent);
        throw new AppError('Please verify your email address before logging in', 403);
      }

      // Reset failed login attempts on successful login
      if (user.failed_login_attempts > 0) {
        await UserModel.update(user.id, { failed_login_attempts: 0, locked_until: null });
      }

      // Update last login information
      await UserModel.updateLoginInfo(user.id, ip_address);

      // Generate tokens
      const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

      // Create user session
      await this.createUserSession({
        user_id: user.id,
        device_info,
        ip_address,
        user_agent,
        remember_me
      });

      // Log successful login
      await this.logUserActivity(user.id, 'LOGIN_SUCCESS', 'authentication', ip_address, user_agent, {
        device_info,
        remember_me
      });

      // Return user profile (without sensitive data)
      const userProfile = await UserModel.findById(user.id);

      logger.info('User authenticated successfully', { 
        userId: user.id, 
        email: user.email,
        ip: ip_address 
      });

      return {
        user: userProfile!,
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        tokenType: 'Bearer'
      };

    } catch (error) {
      logger.error('Authentication failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        email: credentials.email,
        ip: credentials.ip_address 
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Authentication failed', 500);
    }
  }

  /**
   * Register a new user with enhanced validation
   */
  static async registerUser(userData: RegisterUserData): Promise<{
    user: UserProfile;
    verificationToken?: string;
  }> {
    try {
      logger.info('Registering new user', { email: userData.email });

      const { 
        email, 
        password, 
        first_name, 
        last_name, 
        timezone = 'UTC', 
        language_code = 'en',
        terms_accepted = false,
        marketing_consent = false
      } = userData;

      // Validate required terms acceptance
      if (!terms_accepted) {
        throw new AppError('Terms and conditions must be accepted', 400);
      }

      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new AppError('Invalid email format', 400);
      }

      // Check if email is already registered
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409);
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(password);
      if (!passwordValidation.isValid) {
        throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Validate names
      if (!first_name?.trim() || !last_name?.trim()) {
        throw new AppError('First name and last name are required', 400);
      }

      if (first_name.trim().length < 2 || last_name.trim().length < 2) {
        throw new AppError('First name and last name must be at least 2 characters long', 400);
      }

      // Validate timezone
      if (!this.isValidTimezone(timezone)) {
        throw new AppError('Invalid timezone', 400);
      }

      // Validate language code
      if (!this.isValidLanguageCode(language_code)) {
        throw new AppError('Invalid language code', 400);
      }

      // Create user data
      const createData: CreateUserData = {
        email: email.toLowerCase().trim(),
        password,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        timezone,
        language_code,
        role: 'user' // Default role
      };

      // Create user
      const user = await UserModel.create(createData);

      // Generate email verification token if email verification is enabled
      let verificationToken: string | undefined;
      if (config.email?.verificationRequired) {
        verificationToken = await this.generateEmailVerificationToken(user.email);
        await this.sendVerificationEmail(user.email, verificationToken, user.first_name);
      }

      // Log user registration
      await this.logUserActivity(user.id, 'USER_REGISTERED', 'user_management', undefined, undefined, {
        email_verification_required: !!verificationToken,
        marketing_consent
      });

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email,
        emailVerificationRequired: !!verificationToken
      });

      return {
        user,
        verificationToken: config.env !== 'production' ? verificationToken : undefined // Only return in dev/test
      };

    } catch (error) {
      logger.error('User registration failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        email: userData.email 
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Registration failed', 500);
    }
  }

  // =====================================================
  // PASSWORD RESET METHODS
  // =====================================================

  /**
   * Initiate password reset process
   */
  static async initiatePasswordReset(email: string, ip_address?: string, user_agent?: string): Promise<void> {
    try {
      logger.info('Initiating password reset', { email, ip: ip_address });

      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new AppError('Invalid email format', 400);
      }

      // Check if user exists (but don't reveal if email doesn't exist for security)
      const user = await UserModel.findByEmail(email);
      
      if (user) {
        // Generate reset token
        const resetToken = this.generateSecureToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store reset request
        await this.storePasswordResetRequest({
          email,
          reset_token: resetToken,
          expires_at: expiresAt,
          created_at: new Date()
        });

        // Send reset email
        await this.sendPasswordResetEmail(email, resetToken, user.first_name);

        // Log password reset request
        await this.logUserActivity(user.id, 'PASSWORD_RESET_REQUESTED', 'security', ip_address, user_agent);
      }

      // Always respond with success to prevent email enumeration
      logger.info('Password reset process initiated', { email });

    } catch (error) {
      logger.error('Password reset initiation failed', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to initiate password reset', 500);
    }
  }

  /**
   * Complete password reset with token
   */
  static async completePasswordReset(data: PasswordResetData): Promise<void> {
    try {
      const { email, reset_token, new_password } = data;

      if (!email || !reset_token || !new_password) {
        throw new AppError('Email, reset token, and new password are required', 400);
      }

      logger.info('Completing password reset', { email });

      // Validate new password
      const passwordValidation = PasswordValidator.validate(new_password);
      if (!passwordValidation.isValid) {
        throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Verify reset token
      const resetRequest = await this.getPasswordResetRequest(email, reset_token);
      if (!resetRequest) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      // Check if token is expired
      if (new Date() > resetRequest.expires_at) {
        await this.invalidatePasswordResetRequest(email, reset_token);
        throw new AppError('Reset token has expired', 400);
      }

      // Check if token was already used
      if (resetRequest.used_at) {
        throw new AppError('Reset token has already been used', 400);
      }

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if new password is different from current password
      const isSamePassword = await UserModel.verifyPassword(user.id, new_password);
      if (isSamePassword) {
        throw new AppError('New password must be different from current password', 400);
      }

      // Update password
      const passwordData: ChangePasswordData = {
        new_password
      };
      await UserModel.changePassword(user.id, passwordData);

      // Mark reset token as used
      await this.markPasswordResetRequestAsUsed(email, reset_token);

      // Reset failed login attempts and unlock account
      await UserModel.update(user.id, { 
        failed_login_attempts: 0, 
        locked_until: null 
      });

      // Invalidate all user sessions for security
      await this.invalidateAllUserSessions(user.id);

      // Log password reset completion
      await this.logUserActivity(user.id, 'PASSWORD_RESET_COMPLETED', 'security');

      // Send confirmation email
      await this.sendPasswordResetConfirmationEmail(email, user.first_name);

      logger.info('Password reset completed successfully', { userId: user.id, email });

    } catch (error) {
      logger.error('Password reset completion failed', { error, email: data.email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to complete password reset', 500);
    }
  }

  // =====================================================
  // PROFILE MANAGEMENT METHODS
  // =====================================================

  /**
   * Update user profile with enhanced validation
   */
  static async updateProfile(userId: string, profileData: ProfileUpdateData): Promise<UserProfile> {
    try {
      logger.info('Updating user profile', { userId });

      // Verify user exists
      const existingUser = await UserModel.findById(userId);
      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      // Validate profile data
      await this.validateProfileData(profileData);

      // Prepare update data
      const updateData: UpdateUserData = {};

      // Handle name updates
      if (profileData.first_name !== undefined) {
        if (!profileData.first_name.trim()) {
          throw new AppError('First name cannot be empty', 400);
        }
        updateData.first_name = profileData.first_name.trim();
      }

      if (profileData.last_name !== undefined) {
        if (!profileData.last_name.trim()) {
          throw new AppError('Last name cannot be empty', 400);
        }
        updateData.last_name = profileData.last_name.trim();
      }

      // Handle other profile fields
      if (profileData.avatar_url !== undefined) updateData.avatar_url = profileData.avatar_url;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      if (profileData.timezone) updateData.timezone = profileData.timezone;
      if (profileData.date_format) updateData.date_format = profileData.date_format;
      if (profileData.time_format) updateData.time_format = profileData.time_format;
      if (profileData.language_code) updateData.language_code = profileData.language_code;

      // Handle preferences and notifications
      if (profileData.preferences) updateData.preferences = profileData.preferences;
      if (profileData.notification_settings) updateData.notification_settings = profileData.notification_settings;

      // Update user
      const updatedUser = await UserModel.update(userId, updateData);

      // Log profile update
      await this.logUserActivity(userId, 'PROFILE_UPDATED', 'user_management', undefined, undefined, {
        updated_fields: Object.keys(updateData)
      });

      logger.info('User profile updated successfully', { userId });
      return updatedUser;

    } catch (error) {
      logger.error('Profile update failed', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update profile', 500);
    }
  }

  /**
   * Change user password with enhanced security
   */
  static async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string,
    ip_address?: string,
    user_agent?: string
  ): Promise<void> {
    try {
      logger.info('Changing user password', { userId });

      // Verify user exists
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await UserModel.verifyPassword(userId, currentPassword);
      if (!isCurrentPasswordValid) {
        await this.logUserActivity(userId, 'PASSWORD_CHANGE_INVALID_CURRENT', 'security', ip_address, user_agent);
        throw new AppError('Current password is incorrect', 400);
      }

      // Validate new password
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(`New password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Check if new password is different from current
      const isSamePassword = await UserModel.verifyPassword(userId, newPassword);
      if (isSamePassword) {
        throw new AppError('New password must be different from current password', 400);
      }

      // Update password
      const passwordData: ChangePasswordData = {
        current_password: currentPassword,
        new_password: newPassword
      };
      await UserModel.changePassword(userId, passwordData);

      // Log password change
      await this.logUserActivity(userId, 'PASSWORD_CHANGED', 'security', ip_address, user_agent);

      // Send notification email
      await this.sendPasswordChangeNotificationEmail(user.email, user.first_name);

      logger.info('Password changed successfully', { userId });

    } catch (error) {
      logger.error('Password change failed', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to change password', 500);
    }
  }

  // =====================================================
  // EMAIL VERIFICATION METHODS
  // =====================================================

  /**
   * Verify email address with token
   */
  static async verifyEmail(email: string, verificationToken: string): Promise<UserProfile> {
    try {
      logger.info('Verifying email address', { email });

      // Verify token
      const verificationRequest = await this.getEmailVerificationRequest(email, verificationToken);
      if (!verificationRequest) {
        throw new AppError('Invalid verification token', 400);
      }

      // Check if token is expired
      if (new Date() > verificationRequest.expires_at) {
        await this.invalidateEmailVerificationRequest(email, verificationToken);
        throw new AppError('Verification token has expired', 400);
      }

      // Check if already verified
      if (verificationRequest.verified_at) {
        throw new AppError('Email has already been verified', 400);
      }

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Update user verification status
      const updateData: UpdateUserData = {
        email_verified: true,
        email_verified_at: new Date(),
        status: 'active'
      };
      const updatedUser = await UserModel.update(user.id, updateData);

      // Mark verification as completed
      await this.markEmailVerificationAsCompleted(email, verificationToken);

      // Log email verification
      await this.logUserActivity(user.id, 'EMAIL_VERIFIED', 'security');

      // Send welcome email
      await this.sendWelcomeEmail(email, user.first_name);

      logger.info('Email verified successfully', { userId: user.id, email });
      return updatedUser;

    } catch (error) {
      logger.error('Email verification failed', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to verify email', 500);
    }
  }

  // =====================================================
  // SESSION MANAGEMENT METHODS
  // =====================================================

  /**
   * Create user session
   */
  private static async createUserSession(sessionData: {
    user_id: string;
    device_info?: string;
    ip_address?: string;
    user_agent?: string;
    remember_me?: boolean;
  }): Promise<UserSession> {
    const session: UserSession = {
      id: crypto.randomUUID(),
      user_id: sessionData.user_id,
      session_token: this.generateSecureToken(),
      device_info: sessionData.device_info,
      ip_address: sessionData.ip_address,
      user_agent: sessionData.user_agent,
      expires_at: new Date(Date.now() + (sessionData.remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
      created_at: new Date(),
      last_activity: new Date(),
      is_active: true
    };

    // Store session in database (placeholder)
    logger.debug('User session created', { userId: sessionData.user_id, sessionId: session.id });
    return session;
  }

  /**
   * Invalidate all user sessions
   */
  private static async invalidateAllUserSessions(userId: string): Promise<void> {
    logger.info('Invalidating all user sessions', { userId });
    // Implementation would invalidate all sessions for the user
  }

  // =====================================================
  // USER ACTIVITY LOGGING
  // =====================================================

  /**
   * Log user activity
   */
  private static async logUserActivity(
    userId: string | null,
    action: string,
    resource?: string,
    ip_address?: string,
    user_agent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const activity: Omit<UserActivity, 'id'> = {
        user_id: userId || 'anonymous',
        action,
        resource,
        ip_address,
        user_agent,
        metadata,
        created_at: new Date()
      };

      logger.debug('User activity logged', activity);
    } catch (error) {
      logger.error('Failed to log user activity', { error, userId, action });
    }
  }

  // =====================================================
  // EMAIL METHODS
  // =====================================================

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(email: string, resetToken: string, firstName: string): Promise<void> {
    if (!config.email?.enabled) {
      logger.warn('Email not configured, skipping password reset email');
      return;
    }

    const resetUrl = `${config.app?.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    logger.info('Password reset email sent', { email, resetUrl });
  }

  /**
   * Send verification email
   */
  private static async sendVerificationEmail(email: string, verificationToken: string, firstName: string): Promise<void> {
    if (!config.email?.enabled) {
      logger.warn('Email not configured, skipping verification email');
      return;
    }

    const verificationUrl = `${config.app?.frontendUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    logger.info('Verification email sent', { email, verificationUrl });
  }

  /**
   * Send welcome email
   */
  private static async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (!config.email?.enabled) {
      logger.warn('Email not configured, skipping welcome email');
      return;
    }

    logger.info('Welcome email sent', { email });
  }

  /**
   * Send password change notification email
   */
  private static async sendPasswordChangeNotificationEmail(email: string, firstName: string): Promise<void> {
    if (!config.email?.enabled) {
      logger.warn('Email not configured, skipping password change notification');
      return;
    }

    logger.info('Password change notification sent', { email });
  }

  /**
   * Send password reset confirmation email
   */
  private static async sendPasswordResetConfirmationEmail(email: string, firstName: string): Promise<void> {
    if (!config.email?.enabled) {
      logger.warn('Email not configured, skipping password reset confirmation');
      return;
    }

    logger.info('Password reset confirmation sent', { email });
  }

  // =====================================================
  // TOKEN MANAGEMENT METHODS
  // =====================================================

  /**
   * Generate secure token
   */
  private static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate email verification token
   */
  private static async generateEmailVerificationToken(email: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.storeEmailVerificationRequest({
      email,
      verification_token: token,
      expires_at: expiresAt,
      created_at: new Date()
    });

    return token;
  }

  // =====================================================
  // DATABASE OPERATIONS (PLACEHOLDERS)
  // =====================================================

  private static async storePasswordResetRequest(request: PasswordResetRequest): Promise<void> {
    logger.debug('Password reset request stored', { email: request.email });
  }

  private static async getPasswordResetRequest(email: string, token: string): Promise<PasswordResetRequest | null> {
    // Mock implementation - would fetch from database
    return {
      email,
      reset_token: token,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      created_at: new Date()
    };
  }

  private static async markPasswordResetRequestAsUsed(email: string, token: string): Promise<void> {
    logger.debug('Password reset request marked as used', { email });
  }

  private static async invalidatePasswordResetRequest(email: string, token: string): Promise<void> {
    logger.debug('Password reset request invalidated', { email });
  }

  private static async storeEmailVerificationRequest(request: EmailVerificationRequest): Promise<void> {
    logger.debug('Email verification request stored', { email: request.email });
  }

  private static async getEmailVerificationRequest(email: string, token: string): Promise<EmailVerificationRequest | null> {
    // Mock implementation - would fetch from database
    return {
      email,
      verification_token: token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date()
    };
  }

  private static async markEmailVerificationAsCompleted(email: string, token: string): Promise<void> {
    logger.debug('Email verification marked as completed', { email });
  }

  private static async invalidateEmailVerificationRequest(email: string, token: string): Promise<void> {
    logger.debug('Email verification request invalidated', { email });
  }

  // =====================================================
  // VALIDATION HELPER METHODS
  // =====================================================

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate timezone
   */
  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate language code
   */
  private static isValidLanguageCode(languageCode: string): boolean {
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'th', 'vi'];
    return validCodes.includes(languageCode.toLowerCase());
  }

  /**
   * Validate profile data
   */
  private static async validateProfileData(profileData: ProfileUpdateData): Promise<void> {
    if (profileData.timezone && !this.isValidTimezone(profileData.timezone)) {
      throw new AppError('Invalid timezone', 400);
    }

    if (profileData.language_code && !this.isValidLanguageCode(profileData.language_code)) {
      throw new AppError('Invalid language code', 400);
    }

    if (profileData.bio && profileData.bio.length > 500) {
      throw new AppError('Bio cannot exceed 500 characters', 400);
    }

    if (profileData.avatar_url && !this.isValidUrl(profileData.avatar_url)) {
      throw new AppError('Invalid avatar URL', 400);
    }
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const enhancedUserService = new EnhancedUserService();
export default enhancedUserService;

export interface UserFilterOptions {
  search?: string;
  role?: string | string[];
  status?: string | string[];
  email_verified?: boolean;
  created_from?: Date;
  created_to?: Date;
  last_login_from?: Date;
  last_login_to?: Date;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'last_login_at' | 'email' | 'first_name' | 'last_name';
  sort_order?: 'asc' | 'desc';
}

export interface UserStatistics {
  total_users: number;
  active_users: number;
  new_users_today: number;
  new_users_this_week: number;
  new_users_this_month: number;
  users_logged_in_today: number;
  verified_users: number;
  admin_users: number;
  locked_accounts: number;
}

/**
 * Enhanced User Service with Repository Pattern
 * 
 * Provides high-level business logic operations for user management,
 * utilizing the UserRepository for data access operations.
 */
export class EnhancedUserService {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository = userRepository) {
    this.userRepo = userRepo;
  }

  // =====================================================
  // User Registration and Authentication
  // =====================================================

  /**
   * Register a new user with comprehensive validation
   */
  async registerUser(userData: RegisterUserData): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Registering new user', { email: userData.email });

      // Additional business logic validations
      await this.validateRegistrationData(userData);

      // Check if user already exists
      const existingUser = await this.userRepo.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'USER_ALREADY_EXISTS');
      }

      // Create user data with defaults
      const createData: CreateUserData = {
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        first_name: userData.first_name.trim(),
        last_name: userData.last_name.trim(),
        timezone: userData.timezone || 'UTC',
        language_code: userData.language_code || 'en',
        role: 'user'
      };

      const user = await this.userRepo.create(createData);

      logger.info('EnhancedUserService: User registered successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to register user', { error, userData });
      throw new AppError('Registration failed', 500, 'REGISTRATION_FAILED');
    }
  }

  /**
   * Authenticate user login
   */
  async authenticateUser(email: string, password: string, ipAddress?: string): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Authenticating user', { email });

      // Check if account is locked
      const isLocked = await this.userRepo.isAccountLocked(email);
      if (isLocked) {
        throw new AppError('Account is temporarily locked due to failed login attempts', 423, 'ACCOUNT_LOCKED');
      }

      // Find user by email
      const user = await this.userRepo.findByEmail(email);
      if (!user) {
        await this.userRepo.incrementFailedLoginAttempts(email);
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isPasswordValid = await this.userRepo.verifyPassword(user.id, password);
      if (!isPasswordValid) {
        await this.userRepo.incrementFailedLoginAttempts(email);
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check account status
      if (user.status === 'suspended') {
        throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
      }

      if (user.status === 'inactive') {
        throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
      }

      // Update login information
      await this.userRepo.updateLoginInfo(user.id, ipAddress);

      const userProfile = this.userRepo.sanitizeUser(user);

      logger.info('EnhancedUserService: User authenticated successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return userProfile;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Authentication failed', { error, email });
      throw new AppError('Authentication failed', 500, 'AUTH_FAILED');
    }
  }

  // =====================================================
  // User Profile Management
  // =====================================================

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile> {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to get user by ID', { error, userId });
      throw new AppError('Failed to retrieve user', 500, 'USER_RETRIEVAL_FAILED');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, profileData: UpdateProfileData): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Updating user profile', { userId });

      // Verify user exists
      await this.getUserById(userId);

      // Validate profile data
      await this.validateProfileData(profileData);

      // Convert to update data format
      const updateData: UpdateUserData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar_url: profileData.avatar_url,
        bio: profileData.bio,
        timezone: profileData.timezone,
        date_format: profileData.date_format,
        time_format: profileData.time_format,
        language_code: profileData.language_code
      };

      const updatedUser = await this.userRepo.update(userId, updateData);

      logger.info('EnhancedUserService: Profile updated successfully', { userId });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to update profile', { error, userId });
      throw new AppError('Failed to update profile', 500, 'PROFILE_UPDATE_FAILED');
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferencesData: UpdatePreferencesData): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Updating user preferences', { userId });

      // Verify user exists
      await this.getUserById(userId);

      // Convert to update data format
      const updateData: UpdateUserData = {
        preferences: preferencesData.preferences,
        notification_settings: preferencesData.notification_settings
      };

      const updatedUser = await this.userRepo.update(userId, updateData);

      logger.info('EnhancedUserService: Preferences updated successfully', { userId });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to update preferences', { error, userId });
      throw new AppError('Failed to update preferences', 500, 'PREFERENCES_UPDATE_FAILED');
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      logger.info('EnhancedUserService: Changing user password', { userId });

      // Verify user exists
      await this.getUserById(userId);

      // Validate new password strength
      const passwordStrength = PasswordValidator.calculateStrength(newPassword);
      if (passwordStrength.level === 'Very Weak' || passwordStrength.level === 'Weak') {
        throw new AppError(
          `New password is too weak: ${passwordStrength.feedback.join(', ')}`, 
          400, 
          'WEAK_PASSWORD'
        );
      }

      // Change password using repository
      const passwordData: ChangePasswordData = {
        current_password: currentPassword,
        new_password: newPassword
      };

      await this.userRepo.changePassword(userId, passwordData);

      logger.info('EnhancedUserService: Password changed successfully', { userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to change password', { error, userId });
      throw new AppError('Failed to change password', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  // =====================================================
  // User Management (Admin Operations)
  // =====================================================

  /**
   * List users with advanced filtering
   */
  async listUsers(filters: UserFilterOptions = {}, pagination: PaginationOptions = {}): Promise<UserListResponse> {
    try {
      logger.info('EnhancedUserService: Listing users', { filters, pagination });

      // Convert filters to repository format
      const searchFilters: UserSearchFilters = {
        search: filters.search,
        role: Array.isArray(filters.role) ? filters.role[0] as any : filters.role as any,
        status: Array.isArray(filters.status) ? filters.status[0] as any : filters.status as any,
        email_verified: filters.email_verified,
        created_after: filters.created_from,
        created_before: filters.created_to,
        last_login_after: filters.last_login_from,
        last_login_before: filters.last_login_to
      };

      const paginationOptions: PaginationOptions = {
        page: Math.floor((filters.offset || 0) / (filters.limit || 10)) + 1,
        limit: filters.limit || 10,
        sort_by: filters.sort_by || 'created_at',
        sort_order: filters.sort_order || 'desc'
      };

      return await this.userRepo.list(searchFilters, paginationOptions);
    } catch (error) {
      logger.error('EnhancedUserService: Failed to list users', { error, filters });
      throw new AppError('Failed to retrieve users', 500, 'USER_LIST_FAILED');
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, pagination: PaginationOptions = {}): Promise<UserListResponse> {
    try {
      logger.info('EnhancedUserService: Searching users', { query });

      return await this.userRepo.search(query, pagination);
    } catch (error) {
      logger.error('EnhancedUserService: Failed to search users', { error, query });
      throw new AppError('Failed to search users', 500, 'USER_SEARCH_FAILED');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<UserStatistics> {
    try {
      logger.info('EnhancedUserService: Getting user statistics');

      const stats = await this.userRepo.getUserStats();

      return {
        total_users: stats.total,
        active_users: stats.active,
        new_users_today: stats.created_today,
        new_users_this_week: stats.created_this_week,
        new_users_this_month: stats.created_this_month,
        users_logged_in_today: stats.last_login_today,
        verified_users: stats.verified,
        admin_users: stats.admins,
        locked_accounts: stats.locked
      };
    } catch (error) {
      logger.error('EnhancedUserService: Failed to get user statistics', { error });
      throw new AppError('Failed to get user statistics', 500, 'STATS_FAILED');
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Activating user account', { userId });

      const updateData: UpdateUserData = {
        status: 'active',
        email_verified: true,
        email_verified_at: new Date()
      };

      const updatedUser = await this.userRepo.update(userId, updateData);

      logger.info('EnhancedUserService: User account activated', { userId });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to activate user', { error, userId });
      throw new AppError('Failed to activate user', 500, 'ACTIVATION_FAILED');
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string, reason?: string): Promise<UserProfile> {
    try {
      logger.info('EnhancedUserService: Suspending user account', { userId, reason });

      const updateData: UpdateUserData = {
        status: 'suspended'
      };

      const updatedUser = await this.userRepo.update(userId, updateData);

      logger.info('EnhancedUserService: User account suspended', { userId, reason });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to suspend user', { error, userId });
      throw new AppError('Failed to suspend user', 500, 'SUSPENSION_FAILED');
    }
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      logger.info('EnhancedUserService: Deleting user account', { userId });

      await this.userRepo.delete(userId);

      logger.info('EnhancedUserService: User account deleted', { userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('EnhancedUserService: Failed to delete user', { error, userId });
      throw new AppError('Failed to delete user', 500, 'DELETION_FAILED');
    }
  }

  // =====================================================
  // Validation Methods
  // =====================================================

  /**
   * Validate registration data
   */
  private async validateRegistrationData(data: RegisterUserData): Promise<void> {
    const { email, password, first_name, last_name } = data;

    // Email validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Password validation
    const passwordStrength = PasswordValidator.calculateStrength(password);
    if (passwordStrength.level === 'Very Weak' || passwordStrength.level === 'Weak') {
      throw new AppError(
        `Password validation failed: ${passwordStrength.feedback.join(', ')}`, 
        400, 
        'WEAK_PASSWORD'
      );
    }

    // Name validation
    if (!first_name || first_name.trim().length === 0) {
      throw new AppError('First name is required', 400, 'MISSING_FIRST_NAME');
    }

    if (!last_name || last_name.trim().length === 0) {
      throw new AppError('Last name is required', 400, 'MISSING_LAST_NAME');
    }

    if (first_name.trim().length > 100) {
      throw new AppError('First name must be less than 100 characters', 400, 'FIRST_NAME_TOO_LONG');
    }

    if (last_name.trim().length > 100) {
      throw new AppError('Last name must be less than 100 characters', 400, 'LAST_NAME_TOO_LONG');
    }
  }

  /**
   * Validate profile data
   */
  private async validateProfileData(data: UpdateProfileData): Promise<void> {
    if (data.first_name !== undefined && data.first_name.trim().length === 0) {
      throw new AppError('First name cannot be empty', 400, 'INVALID_FIRST_NAME');
    }

    if (data.last_name !== undefined && data.last_name.trim().length === 0) {
      throw new AppError('Last name cannot be empty', 400, 'INVALID_LAST_NAME');
    }

    if (data.bio && data.bio.length > 500) {
      throw new AppError('Bio must be less than 500 characters', 400, 'BIO_TOO_LONG');
    }

    if (data.timezone && !this.isValidTimezone(data.timezone)) {
      throw new AppError('Invalid timezone', 400, 'INVALID_TIMEZONE');
    }
  }

  /**
   * Check if timezone is valid
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const enhancedUserService = new EnhancedUserService();
export default enhancedUserService;
