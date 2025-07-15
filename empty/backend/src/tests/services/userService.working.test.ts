/**
 * Working UserService Unit Tests
 * 
 * Simplified tests that match the actual UserService implementation
 */

import { UserService, RegisterUserData, UpdateProfileData } from '../../services/userService';
import { UserModel, UserProfile } from '../../models/user';
import { AppError } from '../../middleware/errorHandler';
import { PasswordValidator } from '../../validators/passwordValidator';
import { TestDataFactory } from '../utils/testDataFactory';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../models/user');
jest.mock('../../validators/passwordValidator');
jest.mock('../../utils/logger');

// Create typed mocks
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockPasswordValidator = PasswordValidator as jest.Mocked<typeof PasswordValidator>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('UserService - Working Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (mockPasswordValidator.validate as jest.Mock).mockReturnValue({
      isValid: true,
      errors: []
    });
    
    mockLogger.info.mockImplementation();
    mockLogger.error.mockImplementation();
    mockLogger.warn.mockImplementation();
  });

  describe('registerUser', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe'
      };

      const expectedUser: UserProfile = TestDataFactory.createUserProfile({
        email: registerData.email,
        first_name: registerData.first_name,
        last_name: registerData.last_name
      });

      mockUserModel.findByEmail.mockResolvedValue(null); // User doesn't exist
      mockUserModel.create.mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.registerUser(registerData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPasswordValidator.validate).toHaveBeenCalledWith(registerData.password);
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({
        email: registerData.email.toLowerCase().trim(),
        password: registerData.password,
        first_name: registerData.first_name.trim(),
        last_name: registerData.last_name.trim()
      }));
    });

    it('should handle password validation errors', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'test@example.com',
        password: 'weak',
        first_name: 'John',
        last_name: 'Doe'
      };

      (mockPasswordValidator.validate as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Password too short']
      });

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Password validation failed');

      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should handle existing user error', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe'
      };

      const existingUser = TestDataFactory.createUserProfile({ email: registerData.email });
      mockUserModel.findByEmail.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('User with this email already exists');

      expect(mockUserModel.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should successfully retrieve user by ID', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedUser = TestDataFactory.createUserProfile({ id: userId });

      mockUserModel.findById.mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.getUserById(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 'user-123';
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should successfully update user profile', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData: UpdateProfileData = {
        first_name: 'Updated',
        last_name: 'User'
      };

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      const updatedUser = TestDataFactory.createUserProfile({
        id: userId,
        first_name: updateData.first_name,
        last_name: updateData.last_name
      });

      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.update.mockResolvedValue(updatedUser);

      // Act
      const result = await UserService.updateProfile(userId, updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.update).toHaveBeenCalledWith(userId, updateData);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData: UpdateProfileData = { first_name: 'Updated' };

      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.updateProfile(userId, updateData))
        .rejects.toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    it('should successfully change user password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.verifyPassword.mockResolvedValue(true);
      mockUserModel.changePassword.mockResolvedValue(undefined);

      // Act
      await UserService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockPasswordValidator.validate).toHaveBeenCalledWith(newPassword);
      expect(mockUserModel.changePassword).toHaveBeenCalledWith(userId, { new_password: newPassword });
    });

    it('should throw error when current password is incorrect', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'WrongPassword';
      const newPassword = 'NewPassword123!';

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.verifyPassword.mockResolvedValue(false);

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');

      expect(mockUserModel.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockUserModel.findById.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.getUserById('user-123'))
        .rejects.toThrow('Failed to fetch user');
    });

    it('should preserve AppError instances', async () => {
      // Arrange
      const appError = new AppError('Custom error', 400);
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue(appError);

      // Act & Assert
      await expect(UserService.registerUser({
        email: 'test@example.com',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User'
      })).rejects.toThrow('Custom error');
    });
  });
});
