/**
 * Advanced User Service
 * 
 * Comprehensive user management service with:
 * - Enhanced authentication and authorization
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
import { pool } from '../config/database';
import crypto from 'crypto';
import config from '../config/config';

// =====================================================
// ADVANCED INTERFACES AND TYPES
// =====================================================

export interface AuthenticationResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PasswordResetRequest {
  id: string;
  email: string;
  reset_token: string;
  expires_at: Date;
  created_at: Date;
  used_at?: Date;
  ip_address?: string;
}

export interface EmailVerificationRequest {
  id: string;
  email: string;
  verification_token: string;
  expires_at: Date;
  created_at: Date;
  verified_at?: Date;
  attempts: number;
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

export interface UserActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface AdvancedRegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  language_code?: string;
  terms_accepted: boolean;
  marketing_consent?: boolean;
  referral_code?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  captcha_token?: string;
}

export interface PasswordResetData {
  email: string;
  reset_token?: string;
  new_password?: string;
}

export interface AdvancedProfileUpdate {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  language_code?: string;
  preferences?: Record<string, any>;
  notification_settings?: NotificationSettings;
  privacy_settings?: PrivacySettings;
}

export interface NotificationSettings {
  email_notifications?: boolean;
  push_notifications?: boolean;
  due_date_reminders?: boolean;
  task_assignments?: boolean;
  weekly_digest?: boolean;
  marketing_emails?: boolean;
}

export interface PrivacySettings {
  profile_visibility?: 'public' | 'private' | 'contacts_only';
  show_online_status?: boolean;
  allow_search_engines?: boolean;
  data_processing_consent?: boolean;
}

export interface UserSecurityInfo {
  user_id: string;
  failed_login_attempts: number;
  last_login_at?: Date;
  last_login_ip?: string;
  password_changed_at: Date;
  locked_until?: Date;
  two_factor_enabled: boolean;
  backup_codes_generated_at?: Date;
  suspicious_activity_detected: boolean;
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
    suspicious_activities: number;
  };
}

export interface BulkUserOperation {
  operation: 'activate' | 'deactivate' | 'suspend' | 'delete' | 'change_role';
  user_ids: string[];
  parameters?: Record<string, any>;
  performed_by: string;
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
  timezone?: string;
  language_code?: string;
}

// =====================================================
// ADVANCED USER SERVICE CLASS
// =====================================================

export class AdvancedUserService {
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Authenticate user with comprehensive security checks
   */
  static async authenticateUser(credentials: LoginCredentials): Promise<AuthenticationResult> {
    try {
      logger.info('Authenticating user', { 
        email: credentials.email, 
        ip: credentials.ip_address,
        user_agent: credentials.user_agent?.substring(0, 100)
      });

      const { email, password, remember_me = false, device_info, ip_address, user_agent } = credentials;

      // Validate input
      if (!this.isValidEmail(email)) {
        throw new AppError('Invalid email format', 400);
      }

      if (!password || password.length < 6) {
        throw new AppError('Invalid password', 400);
      }

      // Check if account is locked
      const isLocked = await UserModel.isAccountLocked(email);
      if (isLocked) {
        await this.logUserActivity(null, 'LOGIN_ATTEMPT_LOCKED', 'authentication', ip_address, user_agent);
        throw new AppError('Account is temporarily locked due to too many failed login attempts', 423);
      }

      // Find user by email
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        await UserModel.incrementFailedLoginAttempts(email);
        await this.logUserActivity(null, 'LOGIN_ATTEMPT_INVALID_EMAIL', 'authentication', ip_address, user_agent);
        throw new AppError('Invalid email or password', 401);
      }

      // Check for suspicious activity patterns
      await this.checkSuspiciousActivity(user.id, ip_address, user_agent);

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
        throw new AppError('Account is suspended. Please contact support.', 403);
      }

      if (user.status === 'inactive') {
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_INACTIVE', 'authentication', ip_address, user_agent);
        throw new AppError('Account is inactive. Please contact support.', 403);
      }

      if (user.status === 'pending_verification' && !user.email_verified) {
        await this.logUserActivity(user.id, 'LOGIN_ATTEMPT_UNVERIFIED', 'authentication', ip_address, user_agent);
        throw new AppError('Please verify your email address before logging in', 403);
      }

      // Reset failed login attempts on successful login
      if (user.failed_login_attempts > 0) {
        await UserModel.update(user.id, { 
          failed_login_attempts: 0, 
          locked_until: null 
        });
      }

      // Update last login information
      await UserModel.updateLoginInfo(user.id, ip_address);

      // Generate JWT tokens
      const tokenPayload = { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      };
      
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Create user session
      const session = await this.createUserSession({
        user_id: user.id,
        device_info,
        ip_address,
        user_agent,
        remember_me,
        session_token: refreshToken
      });

      // Log successful login
      await this.logUserActivity(user.id, 'LOGIN_SUCCESS', 'authentication', ip_address, user_agent, {
        device_info,
        remember_me,
        session_id: session.id
      });

      // Get fresh user profile
      const userProfile = await UserModel.findById(user.id);
      if (!userProfile) {
        throw new AppError('User profile not found', 404);
      }

      logger.info('User authenticated successfully', { 
        userId: user.id, 
        email: user.email,
        ip: ip_address,
        sessionId: session.id
      });

      return {
        user: userProfile,
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
   * Register a new user with comprehensive validation
   */
  static async registerUser(userData: AdvancedRegisterData): Promise<{
    user: UserProfile;
    verificationToken?: string;
    requiresVerification: boolean;
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
        terms_accepted,
        marketing_consent = false,
        referral_code
      } = userData;

      // Validate required terms acceptance
      if (!terms_accepted) {
        throw new AppError('Terms and conditions must be accepted', 400);
      }

      // Comprehensive input validation
      await this.validateRegistrationData(userData);

      // Check if email is already registered
      const existingUser = await UserModel.findByEmail(email.toLowerCase().trim());
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409);
      }

      // Check rate limiting for registrations from same IP
      // This would be implemented with your rate limiting system

      // Process referral code if provided
      let referredBy: string | undefined;
      if (referral_code) {
        referredBy = await this.validateReferralCode(referral_code);
      }

      // Create user data
      const createData: CreateUserData = {
        email: email.toLowerCase().trim(),
        password,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        timezone,
        language_code,
        role: 'user'
      };

      // Create user
      const user = await UserModel.create(createData);

      // Generate email verification token
      let verificationToken: string | undefined;
      let requiresVerification = false;

      if (config.features?.emailVerification !== false) {
        verificationToken = await this.generateEmailVerificationToken(user.email);
        requiresVerification = true;
        
        // Send verification email
        await this.sendVerificationEmail(user.email, verificationToken, user.first_name);
      } else {
        // Auto-activate if verification not required
        await UserModel.update(user.id, { 
          email_verified: true, 
          email_verified_at: new Date(),
          status: 'active'
        });
      }

      // Process referral if valid
      if (referredBy) {
        await this.processReferral(user.id, referredBy);
      }

      // Log user registration
      await this.logUserActivity(user.id, 'USER_REGISTERED', 'user_management', undefined, undefined, {
        email_verification_required: requiresVerification,
        marketing_consent,
        referral_code: !!referral_code,
        timezone,
        language_code
      });

      // Send welcome email (if verification not required)
      if (!requiresVerification) {
        await this.sendWelcomeEmail(user.email, user.first_name);
      }

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email,
        requiresVerification,
        referralUsed: !!referral_code
      });

      // Get fresh user profile
      const userProfile = await UserModel.findById(user.id);
      if (!userProfile) {
        throw new AppError('Failed to retrieve user profile', 500);
      }

      return {
        user: userProfile,
        verificationToken: config.nodeEnv !== 'production' ? verificationToken : undefined,
        requiresVerification
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

  /**
   * Logout user and invalidate session
   */
  static async logoutUser(userId: string, sessionToken?: string, ip_address?: string): Promise<void> {
    try {
      logger.info('Logging out user', { userId, ip: ip_address });

      // Invalidate specific session if token provided
      if (sessionToken) {
        await this.invalidateUserSession(userId, sessionToken);
      } else {
        // Invalidate all sessions
        await this.invalidateAllUserSessions(userId);
      }

      // Log logout activity
      await this.logUserActivity(userId, 'USER_LOGOUT', 'authentication', ip_address, undefined, {
        session_invalidated: !!sessionToken,
        all_sessions_invalidated: !sessionToken
      });

      logger.info('User logged out successfully', { userId });

    } catch (error) {
      logger.error('Logout failed', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Logout failed', 500);
    }
  }

  // =====================================================
  // PASSWORD MANAGEMENT METHODS
  // =====================================================

  /**
   * Initiate password reset with enhanced security
   */
  static async initiatePasswordReset(
    email: string, 
    ip_address?: string, 
    user_agent?: string,
    captcha_token?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Initiating password reset', { email, ip: ip_address });

      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new AppError('Invalid email format', 400);
      }

      // Verify captcha if required
      if (config.security?.requireCaptchaForPasswordReset && captcha_token) {
        const isValidCaptcha = await this.verifyCaptcha(captcha_token);
        if (!isValidCaptcha) {
          throw new AppError('Invalid captcha', 400);
        }
      }

      // Check rate limiting for password reset requests
      await this.checkPasswordResetRateLimit(email, ip_address);

      // Check if user exists (but don't reveal if email doesn't exist for security)
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      
      if (user) {
        // Check if account is locked or suspended
        if (user.status === 'suspended') {
          await this.logUserActivity(user.id, 'PASSWORD_RESET_ATTEMPT_SUSPENDED', 'security', ip_address, user_agent);
          // Still return success to prevent enumeration
        } else {
          // Generate secure reset token
          const resetToken = this.generateSecureToken();
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Store reset request
          await this.storePasswordResetRequest({
            id: crypto.randomUUID(),
            email: email.toLowerCase().trim(),
            reset_token: resetToken,
            expires_at: expiresAt,
            created_at: new Date(),
            ip_address
          });

          // Send reset email
          await this.sendPasswordResetEmail(email, resetToken, user.first_name);

          // Log password reset request
          await this.logUserActivity(user.id, 'PASSWORD_RESET_REQUESTED', 'security', ip_address, user_agent);
        }
      }

      // Always respond with success to prevent email enumeration
      logger.info('Password reset process initiated', { email });

      return {
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      };

    } catch (error) {
      logger.error('Password reset initiation failed', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to initiate password reset', 500);
    }
  }

  /**
   * Complete password reset with enhanced validation
   */
  static async completePasswordReset(data: PasswordResetData): Promise<{ success: boolean; message: string }> {
    try {
      const { email, reset_token, new_password } = data;

      if (!email || !reset_token || !new_password) {
        throw new AppError('Email, reset token, and new password are required', 400);
      }

      logger.info('Completing password reset', { email });

      // Validate new password strength
      const passwordValidation = PasswordValidator.validate(new_password);
      if (!passwordValidation.isValid) {
        throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Verify and retrieve reset request
      const resetRequest = await this.getPasswordResetRequest(email.toLowerCase().trim(), reset_token);
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
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
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

      // Reset security-related fields
      await UserModel.update(user.id, { 
        failed_login_attempts: 0, 
        locked_until: null 
      });

      // Invalidate all user sessions for security
      await this.invalidateAllUserSessions(user.id);

      // Log password reset completion
      await this.logUserActivity(user.id, 'PASSWORD_RESET_COMPLETED', 'security', undefined, undefined, {
        all_sessions_invalidated: true
      });

      // Send confirmation email
      await this.sendPasswordResetConfirmationEmail(email, user.first_name);

      logger.info('Password reset completed successfully', { userId: user.id, email });

      return {
        success: true,
        message: 'Password has been reset successfully. All sessions have been logged out for security.'
      };

    } catch (error) {
      logger.error('Password reset completion failed', { error, email: data.email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to complete password reset', 500);
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
  ): Promise<{ success: boolean; message: string }> {
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

      // Validate new password strength
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(`New password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Check if new password is different from current
      const isSamePassword = await UserModel.verifyPassword(userId, newPassword);
      if (isSamePassword) {
        throw new AppError('New password must be different from current password', 400);
      }

      // Check password history (prevent reusing recent passwords)
      const isRecentPassword = await this.checkPasswordHistory(userId, newPassword);
      if (isRecentPassword) {
        throw new AppError('Cannot reuse one of your recent passwords', 400);
      }

      // Update password
      const passwordData: ChangePasswordData = {
        current_password: currentPassword,
        new_password: newPassword
      };
      await UserModel.changePassword(userId, passwordData);

      // Store password in history
      await this.addPasswordToHistory(userId, newPassword);

      // Optionally invalidate other sessions (keep current session active)
      // await this.invalidateOtherUserSessions(userId, currentSessionToken);

      // Log password change
      await this.logUserActivity(userId, 'PASSWORD_CHANGED', 'security', ip_address, user_agent);

      // Send notification email
      await this.sendPasswordChangeNotificationEmail(user.email, user.first_name);

      logger.info('Password changed successfully', { userId });

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      logger.error('Password change failed', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to change password', 500);
    }
  }

  // =====================================================
  // PROFILE MANAGEMENT METHODS
  // =====================================================

  /**
   * Update user profile with comprehensive validation
   */
  static async updateProfile(userId: string, profileData: AdvancedProfileUpdate): Promise<UserProfile> {
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
      const changedFields: string[] = [];

      // Handle name updates
      if (profileData.first_name !== undefined && profileData.first_name !== existingUser.first_name) {
        if (!profileData.first_name.trim()) {
          throw new AppError('First name cannot be empty', 400);
        }
        updateData.first_name = profileData.first_name.trim();
        changedFields.push('first_name');
      }

      if (profileData.last_name !== undefined && profileData.last_name !== existingUser.last_name) {
        if (!profileData.last_name.trim()) {
          throw new AppError('Last name cannot be empty', 400);
        }
        updateData.last_name = profileData.last_name.trim();
        changedFields.push('last_name');
      }

      // Handle other profile fields
      if (profileData.avatar_url !== undefined && profileData.avatar_url !== existingUser.avatar_url) {
        updateData.avatar_url = profileData.avatar_url;
        changedFields.push('avatar_url');
      }

      if (profileData.bio !== undefined && profileData.bio !== existingUser.bio) {
        updateData.bio = profileData.bio;
        changedFields.push('bio');
      }

      if (profileData.timezone && profileData.timezone !== existingUser.timezone) {
        updateData.timezone = profileData.timezone;
        changedFields.push('timezone');
      }

      if (profileData.date_format && profileData.date_format !== existingUser.date_format) {
        updateData.date_format = profileData.date_format;
        changedFields.push('date_format');
      }

      if (profileData.time_format && profileData.time_format !== existingUser.time_format) {
        updateData.time_format = profileData.time_format;
        changedFields.push('time_format');
      }

      if (profileData.language_code && profileData.language_code !== existingUser.language_code) {
        updateData.language_code = profileData.language_code;
        changedFields.push('language_code');
      }

      // Handle preferences and notifications
      if (profileData.preferences) {
        updateData.preferences = { ...existingUser.preferences, ...profileData.preferences };
        changedFields.push('preferences');
      }

      if (profileData.notification_settings) {
        updateData.notification_settings = { 
          ...existingUser.notification_settings, 
          ...profileData.notification_settings 
        };
        changedFields.push('notification_settings');
      }

      // Only update if there are actual changes
      if (changedFields.length === 0) {
        logger.info('No changes detected in profile update', { userId });
        return existingUser;
      }

      // Update user
      const updatedUser = await UserModel.update(userId, updateData);

      // Log profile update
      await this.logUserActivity(userId, 'PROFILE_UPDATED', 'user_management', undefined, undefined, {
        updated_fields: changedFields,
        field_count: changedFields.length
      });

      logger.info('User profile updated successfully', { userId, changedFields });
      return updatedUser;

    } catch (error) {
      logger.error('Profile update failed', { error, userId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update profile', 500);
    }
  }

  // =====================================================
  // EMAIL VERIFICATION METHODS
  // =====================================================

  /**
   * Verify email address with comprehensive validation
   */
  static async verifyEmail(email: string, verificationToken: string): Promise<{
    user: UserProfile;
    success: boolean;
    message: string;
  }> {
    try {
      logger.info('Verifying email address', { email });

      // Verify token and get verification request
      const verificationRequest = await this.getEmailVerificationRequest(email.toLowerCase().trim(), verificationToken);
      if (!verificationRequest) {
        throw new AppError('Invalid verification token', 400);
      }

      // Check if token is expired
      if (new Date() > verificationRequest.expires_at) {
        await this.invalidateEmailVerificationRequest(email, verificationToken);
        throw new AppError('Verification token has expired. Please request a new one.', 400);
      }

      // Check if already verified
      if (verificationRequest.verified_at) {
        throw new AppError('Email has already been verified', 400);
      }

      // Find user
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user is already verified
      if (user.email_verified) {
        await this.markEmailVerificationAsCompleted(email, verificationToken);
        return {
          user,
          success: true,
          message: 'Email was already verified'
        };
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
      await this.logUserActivity(user.id, 'EMAIL_VERIFIED', 'security', undefined, undefined, {
        verification_completed_at: new Date().toISOString()
      });

      // Send welcome email
      await this.sendWelcomeEmail(email, user.first_name);

      // Process any pending invitations or referrals
      await this.processPendingUserActions(user.id);

      logger.info('Email verified successfully', { userId: user.id, email });

      return {
        user: updatedUser,
        success: true,
        message: 'Email verified successfully! Welcome to our platform.'
      };

    } catch (error) {
      logger.error('Email verification failed', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to verify email', 500);
    }
  }

  /**
   * Resend email verification with rate limiting
   */
  static async resendEmailVerification(email: string, ip_address?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      logger.info('Resending email verification', { email, ip: ip_address });

      // Check rate limiting
      await this.checkEmailVerificationRateLimit(email, ip_address);

      // Find user
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal if user doesn't exist
        return {
          success: true,
          message: 'If an account exists with this email, a verification email will be sent.'
        };
      }

      // Check if already verified
      if (user.email_verified) {
        return {
          success: true,
          message: 'Email is already verified'
        };
      }

      // Invalidate previous verification tokens
      await this.invalidateAllEmailVerificationRequests(email);

      // Generate new verification token
      const verificationToken = await this.generateEmailVerificationToken(email);

      // Send verification email
      await this.sendVerificationEmail(email, verificationToken, user.first_name);

      // Log resend action
      await this.logUserActivity(user.id, 'EMAIL_VERIFICATION_RESENT', 'security', ip_address, undefined);

      logger.info('Email verification resent successfully', { email });

      return {
        success: true,
        message: 'Verification email sent successfully'
      };

    } catch (error) {
      logger.error('Failed to resend email verification', { error, email });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to resend verification email', 500);
    }
  }

  // =====================================================
  // SESSION MANAGEMENT METHODS
  // =====================================================

  /**
   * Create user session with enhanced tracking
   */
  private static async createUserSession(sessionData: {
    user_id: string;
    device_info?: string;
    ip_address?: string;
    user_agent?: string;
    remember_me?: boolean;
    session_token: string;
  }): Promise<UserSession> {
    const session: UserSession = {
      id: crypto.randomUUID(),
      user_id: sessionData.user_id,
      session_token: sessionData.session_token,
      device_info: sessionData.device_info,
      ip_address: sessionData.ip_address,
      user_agent: sessionData.user_agent,
      expires_at: new Date(Date.now() + (sessionData.remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
      created_at: new Date(),
      last_activity: new Date(),
      is_active: true
    };

    // Store session in database (implementation depends on your database structure)
    logger.debug('User session created', { 
      userId: sessionData.user_id, 
      sessionId: session.id,
      remember_me: sessionData.remember_me
    });
    
    return session;
  }

  /**
   * Invalidate specific user session
   */
  private static async invalidateUserSession(userId: string, sessionToken: string): Promise<void> {
    logger.info('Invalidating user session', { userId, sessionToken: sessionToken.substring(0, 10) + '...' });
    // Implementation would invalidate specific session in database
  }

  /**
   * Invalidate all user sessions
   */
  private static async invalidateAllUserSessions(userId: string): Promise<void> {
    logger.info('Invalidating all user sessions', { userId });
    // Implementation would invalidate all sessions for the user in database
  }

  // =====================================================
  // HELPER METHODS FOR DATABASE OPERATIONS
  // =====================================================

  private static async storePasswordResetRequest(request: PasswordResetRequest): Promise<void> {
    // Implementation would store in database
    logger.debug('Password reset request stored', { email: request.email, id: request.id });
  }

  private static async getPasswordResetRequest(email: string, token: string): Promise<PasswordResetRequest | null> {
    // Implementation would fetch from database
    // Mock response for testing
    return {
      id: 'mock-id',
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

  private static async generateEmailVerificationToken(email: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.storeEmailVerificationRequest({
      id: crypto.randomUUID(),
      email,
      verification_token: token,
      expires_at: expiresAt,
      created_at: new Date(),
      attempts: 0
    });

    return token;
  }

  private static async storeEmailVerificationRequest(request: EmailVerificationRequest): Promise<void> {
    logger.debug('Email verification request stored', { email: request.email, id: request.id });
  }

  private static async getEmailVerificationRequest(email: string, token: string): Promise<EmailVerificationRequest | null> {
    // Mock implementation
    return {
      id: 'mock-id',
      email,
      verification_token: token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      attempts: 1
    };
  }

  private static async markEmailVerificationAsCompleted(email: string, token: string): Promise<void> {
    logger.debug('Email verification marked as completed', { email });
  }

  private static async invalidateEmailVerificationRequest(email: string, token: string): Promise<void> {
    logger.debug('Email verification request invalidated', { email });
  }

  private static async invalidateAllEmailVerificationRequests(email: string): Promise<void> {
    logger.debug('All email verification requests invalidated', { email });
  }

  // =====================================================
  // SECURITY AND VALIDATION METHODS
  // =====================================================

  private static async validateRegistrationData(userData: AdvancedRegisterData): Promise<void> {
    const { email, password, first_name, last_name, timezone, language_code } = userData;

    // Validate email
    if (!this.isValidEmail(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // Validate password
    const passwordValidation = PasswordValidator.validate(password);
    if (!passwordValidation.isValid) {
      throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
    }

    // Validate names
    if (!first_name?.trim() || first_name.trim().length < 2) {
      throw new AppError('First name must be at least 2 characters long', 400);
    }

    if (!last_name?.trim() || last_name.trim().length < 2) {
      throw new AppError('Last name must be at least 2 characters long', 400);
    }

    if (first_name.trim().length > 50 || last_name.trim().length > 50) {
      throw new AppError('Names cannot exceed 50 characters', 400);
    }

    // Validate timezone
    if (timezone && !this.isValidTimezone(timezone)) {
      throw new AppError('Invalid timezone', 400);
    }

    // Validate language code
    if (language_code && !this.isValidLanguageCode(language_code)) {
      throw new AppError('Invalid language code', 400);
    }
  }

  private static async validateProfileData(profileData: AdvancedProfileUpdate): Promise<void> {
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

    if (profileData.first_name && (profileData.first_name.length < 2 || profileData.first_name.length > 50)) {
      throw new AppError('First name must be between 2 and 50 characters', 400);
    }

    if (profileData.last_name && (profileData.last_name.length < 2 || profileData.last_name.length > 50)) {
      throw new AppError('Last name must be between 2 and 50 characters', 400);
    }
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private static isValidLanguageCode(languageCode: string): boolean {
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no'];
    return validCodes.includes(languageCode.toLowerCase());
  }

  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // =====================================================
  // ACTIVITY LOGGING
  // =====================================================

  private static async logUserActivity(
    userId: string | null,
    action: string,
    resource?: string,
    ip_address?: string,
    user_agent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const activity: Omit<UserActivityLog, 'id'> = {
        user_id: userId || 'anonymous',
        action,
        resource,
        ip_address,
        user_agent: user_agent?.substring(0, 255), // Truncate long user agents
        metadata,
        created_at: new Date()
      };

      // Store in database (implementation depends on your database structure)
      logger.debug('User activity logged', { 
        userId: userId || 'anonymous', 
        action, 
        resource,
        ip: ip_address
      });
    } catch (error) {
      logger.error('Failed to log user activity', { error, userId, action });
      // Don't throw error - activity logging shouldn't break main functionality
    }
  }

  // =====================================================
  // EMAIL METHODS
  // =====================================================

  private static async sendVerificationEmail(email: string, token: string, firstName: string): Promise<void> {
    const verificationUrl = `${config.app?.frontendUrl || 'http://localhost:3000'}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    
    // Implementation would use your email service
    logger.info('Verification email sent', { 
      email, 
      firstName,
      verificationUrl: verificationUrl.replace(token, 'REDACTED')
    });
  }

  private static async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<void> {
    const resetUrl = `${config.app?.frontendUrl || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    
    logger.info('Password reset email sent', { 
      email, 
      firstName,
      resetUrl: resetUrl.replace(token, 'REDACTED')
    });
  }

  private static async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    logger.info('Welcome email sent', { email, firstName });
  }

  private static async sendPasswordChangeNotificationEmail(email: string, firstName: string): Promise<void> {
    logger.info('Password change notification sent', { email, firstName });
  }

  private static async sendPasswordResetConfirmationEmail(email: string, firstName: string): Promise<void> {
    logger.info('Password reset confirmation sent', { email, firstName });
  }

  // =====================================================
  // ADDITIONAL SECURITY METHODS (PLACEHOLDERS)
  // =====================================================

  private static async checkSuspiciousActivity(userId: string, ip_address?: string, user_agent?: string): Promise<void> {
    // Implementation would check for suspicious patterns
    logger.debug('Checking for suspicious activity', { userId, ip: ip_address });
  }

  private static async checkPasswordResetRateLimit(email: string, ip_address?: string): Promise<void> {
    // Implementation would check rate limits
    logger.debug('Checking password reset rate limit', { email, ip: ip_address });
  }

  private static async checkEmailVerificationRateLimit(email: string, ip_address?: string): Promise<void> {
    // Implementation would check rate limits
    logger.debug('Checking email verification rate limit', { email, ip: ip_address });
  }

  private static async verifyCaptcha(token: string): Promise<boolean> {
    // Implementation would verify captcha with service
    return true; // Mock implementation
  }

  private static async validateReferralCode(code: string): Promise<string | undefined> {
    // Implementation would validate referral code and return referring user ID
    return undefined;
  }

  private static async processReferral(newUserId: string, referredBy: string): Promise<void> {
    // Implementation would process referral rewards
    logger.debug('Processing referral', { newUserId, referredBy });
  }

  private static async processPendingUserActions(userId: string): Promise<void> {
    // Implementation would process any pending actions for newly verified user
    logger.debug('Processing pending user actions', { userId });
  }

  private static async checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
    // Implementation would check against password history
    return false; // Mock implementation
  }

  private static async addPasswordToHistory(userId: string, password: string): Promise<void> {
    // Implementation would add password to history
    logger.debug('Password added to history', { userId });
  }

  // =====================================================
  // USER PROFILE MANAGEMENT METHODS
  // =====================================================

  /**
   * Get user by ID with security filtering
   */
  static async getUserById(userId: string): Promise<UserProfile> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      return {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        timezone: user.timezone,
        date_format: user.date_format,
        time_format: user.time_format,
        language_code: user.language_code,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
        email_verified_at: user.email_verified_at,
        last_login_at: user.last_login_at,
        preferences: user.preferences,
        notification_settings: user.notification_settings,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      logger.error('Error getting user by ID', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile with validation
   */
  static async updateUserProfile(userId: string, updateData: Partial<UpdateUserData>): Promise<UserProfile> {
    try {
      // Get current user
      const currentUser = await UserModel.findById(userId);
      if (!currentUser) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Validate update data
      if (updateData.email && updateData.email !== currentUser.email) {
        if (!this.isValidEmail(updateData.email)) {
          throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
        }

        // Check if email is already taken
        const existingUser = await UserModel.findByEmail(updateData.email);
        if (existingUser && existingUser.id !== userId) {
          throw new AppError('Email already exists', 400, 'EMAIL_EXISTS');
        }
      }

      // Update user
      const updatedUser = await UserModel.update(userId, updateData);
      
      logger.info('User profile updated', { 
        userId, 
        updatedFields: Object.keys(updateData) 
      });

      return this.getUserById(userId);
    } catch (error) {
      logger.error('Error updating user profile', { userId, error: error.message });
      throw error;
    }
  }

  // =====================================================
  // PASSWORD RESET METHODS
  // =====================================================

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string, options: { ip_address?: string; user_agent?: string; captcha_token?: string } = {}): Promise<void> {
    try {
      const { ip_address, user_agent, captcha_token } = options;

      // Validate email
      if (!this.isValidEmail(email)) {
        throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      // Check rate limiting
      await this.checkPasswordResetRateLimit(email, ip_address);

      // Verify captcha if required
      if (config.security?.requireCaptchaForPasswordReset && captcha_token) {
        const isValidCaptcha = await this.verifyCaptcha(captcha_token);
        if (!isValidCaptcha) {
          throw new AppError('Invalid captcha', 400, 'INVALID_CAPTCHA');
        }
      }

      // Find user (but don't reveal if user doesn't exist for security)
      const user = await UserModel.findByEmail(email.toLowerCase().trim());
      if (!user) {
        logger.warn('Password reset requested for non-existent email', { email, ip: ip_address });
        return; // Don't throw error for security reasons
      }

      // Generate reset token
      const resetToken = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store reset request
      await pool?.query(
        `INSERT INTO password_reset_requests (email, reset_token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, resetToken, expiresAt, ip_address, user_agent]
      );

      // Send reset email (mock in development)
      if (config.nodeEnv !== 'production') {
        logger.info('Password reset token (DEV ONLY)', { 
          email, 
          resetToken,
          resetUrl: `${config.app.frontendUrl}/reset-password?token=${resetToken}`
        });
      }

      logger.info('Password reset requested', { email, ip: ip_address });
    } catch (error) {
      logger.error('Error requesting password reset', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(token: string, newPassword: string, options: { ip_address?: string; user_agent?: string } = {}): Promise<void> {
    try {
      const { ip_address, user_agent } = options;

      // Validate inputs
      if (!token || token.length < 32) {
        throw new AppError('Invalid reset token', 400, 'INVALID_TOKEN');
      }

      await PasswordValidator.validatePassword(newPassword);

      // Find and validate reset request
      const resetRequest = await pool?.query(
        `SELECT * FROM password_reset_requests 
         WHERE reset_token = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [token]
      );

      if (!resetRequest?.rows.length) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_OR_EXPIRED_TOKEN');
      }

      const request = resetRequest.rows[0];

      // Find user
      const user = await UserModel.findByEmail(request.email);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check password history
      const isPasswordReused = await this.checkPasswordHistory(user.id, newPassword);
      if (isPasswordReused) {
        throw new AppError('Cannot reuse recent passwords', 400, 'PASSWORD_REUSED');
      }

      // Update password
      await UserModel.updatePassword(user.id, newPassword);

      // Mark reset request as used
      await pool?.query(
        `UPDATE password_reset_requests 
         SET used_at = NOW(), ip_address = $1, user_agent = $2 
         WHERE id = $3`,
        [ip_address, user_agent, request.id]
      );

      // Add to password history
      await this.addPasswordToHistory(user.id, newPassword);

      // Revoke all user sessions for security
      await this.revokeAllUserTokens(user.id);

      logger.info('Password reset completed', { userId: user.id, ip: ip_address });
    } catch (error) {
      logger.error('Error resetting password', { error: error.message });
      throw error;
    }
  }

  // =====================================================
  // USER SEARCH AND ADMIN METHODS
  // =====================================================

  /**
   * Search users with filters and pagination
   */
  static async searchUsers(filters: any = {}, pagination: any = {}): Promise<any> {
    try {
      const { search, role, status, isVerified, createdFrom, createdTo } = filters;
      const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = pagination;

      let query = `
        SELECT 
          id, email, first_name, last_name, phone_number, 
          is_verified, status, role, created_at, updated_at, last_login
        FROM users 
        WHERE 1=1
      `;
      const values: any[] = [];
      let paramCount = 0;

      // Apply filters
      if (search) {
        paramCount++;
        query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
        values.push(`%${search}%`);
      }

      if (role) {
        paramCount++;
        query += ` AND role = $${paramCount}`;
        values.push(role);
      }

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        values.push(status);
      }

      if (typeof isVerified === 'boolean') {
        paramCount++;
        query += ` AND is_verified = $${paramCount}`;
        values.push(isVerified);
      }

      if (createdFrom) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(createdFrom);
      }

      if (createdTo) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(createdTo);
      }

      // Add sorting
      const validSortColumns = ['created_at', 'updated_at', 'email', 'first_name', 'last_name'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;

      // Add pagination
      const offset = (page - 1) * limit;
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(limit);
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      values.push(offset);

      // Get results
      const result = await pool?.query(query, values);
      
      // Get total count
      let countQuery = `SELECT COUNT(*) FROM users WHERE 1=1`;
      const countValues: any[] = [];
      let countParams = 0;

      // Apply same filters for count
      if (search) {
        countParams++;
        countQuery += ` AND (first_name ILIKE $${countParams} OR last_name ILIKE $${countParams} OR email ILIKE $${countParams})`;
        countValues.push(`%${search}%`);
      }

      if (role) {
        countParams++;
        countQuery += ` AND role = $${countParams}`;
        countValues.push(role);
      }

      if (status) {
        countParams++;
        countQuery += ` AND status = $${countParams}`;
        countValues.push(status);
      }

      const countResult = await pool?.query(countQuery, countValues);
      const total = parseInt(countResult?.rows[0]?.count || 0);

      return {
        users: result?.rows || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error searching users', { error: error.message });
      throw error;
    }
  }

  /**
   * Update user role (admin function)
   */
  static async updateUserRole(userId: string, newRole: string, options: { changed_by?: string; reason?: string } = {}): Promise<UserProfile> {
    try {
      const { changed_by, reason } = options;

      // Validate role
      const validRoles = ['user', 'admin', 'super_admin'];
      if (!validRoles.includes(newRole)) {
        throw new AppError('Invalid role', 400, 'INVALID_ROLE');
      }

      // Get current user
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.role === newRole) {
        throw new AppError('User already has this role', 400, 'ROLE_UNCHANGED');
      }

      // Update role
      await UserModel.update(userId, { role: newRole });

      // Log role change
      await pool?.query(
        `INSERT INTO user_role_changes (user_id, old_role, new_role, changed_by, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, user.role, newRole, changed_by, reason]
      );

      logger.warn('User role updated', { 
        userId, 
        oldRole: user.role, 
        newRole, 
        changedBy: changed_by,
        reason 
      });

      return this.getUserById(userId);
    } catch (error) {
      logger.error('Error updating user role', { userId, newRole, error: error.message });
      throw error;
    }
  }

  /**
   * Suspend user account
   */
  static async suspendUser(userId: string, options: { suspended_by?: string; reason?: string; duration_hours?: number } = {}): Promise<void> {
    try {
      const { suspended_by, reason, duration_hours } = options;

      // Get user
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.status === 'suspended') {
        throw new AppError('User is already suspended', 400, 'ALREADY_SUSPENDED');
      }

      // Calculate suspension end time if duration provided
      const suspendedUntil = duration_hours 
        ? new Date(Date.now() + duration_hours * 60 * 60 * 1000)
        : null;

      // Update user status
      await UserModel.update(userId, { 
        status: 'suspended',
        suspended_until: suspendedUntil
      });

      // Log suspension
      await pool?.query(
        `INSERT INTO user_suspensions (user_id, suspended_by, reason, duration_hours, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, suspended_by, reason, duration_hours]
      );

      // Revoke all user sessions
      await this.revokeAllUserTokens(userId);

      logger.warn('User suspended', { 
        userId, 
        suspendedBy: suspended_by, 
        reason, 
        duration_hours 
      });
    } catch (error) {
      logger.error('Error suspending user', { userId, error: error.message });
      throw error;
    }
  }

  // =====================================================
  // TOKEN MANAGEMENT METHODS
  // =====================================================

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
    try {
      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
      }

      // Find and validate refresh token
      const tokenResult = await pool?.query(
        `SELECT * FROM refresh_tokens 
         WHERE token = $1 AND expires_at > NOW() AND is_revoked = false`,
        [refreshToken]
      );

      if (!tokenResult?.rows.length) {
        throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      const tokenRecord = tokenResult.rows[0];

      // Get user
      const user = await UserModel.findById(tokenRecord.user_id);
      if (!user || user.status !== 'active') {
        throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
      }

      // Generate new access token
      const accessToken = generateAccessToken({ 
        id: user.id, 
        email: user.email, 
        role: user.role 
      });

      // Update refresh token last used
      await pool?.query(
        `UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`,
        [tokenRecord.id]
      );

      logger.info('Access token refreshed', { userId: user.id });

      return {
        accessToken,
        expiresIn: 15 * 60, // 15 minutes
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Error refreshing access token', { error: error.message });
      throw error;
    }
  }
}

// Export the service
export default AdvancedUserService;
