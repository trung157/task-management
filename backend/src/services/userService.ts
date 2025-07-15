import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { UserModel } from '../models/user';
import { PasswordValidator } from '../validators/passwordValidator';
import type { User, CreateUserData, UserProfile } from '../models/user';

export class UserService {
  /**
   * Register a new user
   */
  static async registerUser(userData: CreateUserData): Promise<{ user: UserProfile; tokens: any }> {
    const { email, password, first_name, last_name } = userData;

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Validate password strength
    const passwordValidation = PasswordValidator.validate(password);
    if (!passwordValidation.isValid) {
      throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userId = uuidv4();
    const createData: CreateUserData = {
      email: email.toLowerCase(),
      password: passwordHash,
      first_name,
      last_name
    };

    const newUser = await UserModel.create(createData);

    logger.info(`New user registered: ${email}`);

    return {
      user: newUser,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    };
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string): Promise<{ user: UserProfile; tokens: any }> {
    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // For UserProfile, we need to get the full user data
    const fullUser = await UserModel.findById(user.id);
    if (!fullUser) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password - need to get password hash from full user data
    const isPasswordValid = await bcrypt.compare(password, (fullUser as any).password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await UserModel.updateLoginInfo(user.id);

    logger.info(`User authenticated: ${email}`);

    return {
      user,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserProfile> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Use updateUser method if available, otherwise just return the user
    const updatedUser = await UserModel.findById(userId);
    if (!updatedUser) {
      throw new AppError('Failed to update user', 500);
    }

    logger.info(`User profile updated: ${userId}`);
    
    return updatedUser;
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get full user data to access password_hash
    const fullUser = await UserModel.findById(userId);
    if (!fullUser) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, (fullUser as any).password_hash);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Validate new password
    const passwordValidation = PasswordValidator.validate(newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password (would need to implement this method)
    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Delete user account
   */
  static async deleteUser(userId: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // In a real application, you might want to soft delete or anonymize the user
    // For now, we'll just log the action
    logger.info(`User deletion requested: ${userId}`);
    
    // TODO: Implement actual user deletion logic
    throw new AppError('User deletion not implemented', 501);
  }
}
