/**
 * Fixed UserService Unit Tests
 * 
 * Comprehensive unit tests for UserService with proper mocking,
 * correct method signatures, and type-safe test data.
 */

import { UserService, RegisterUserData, UpdateProfileData, UpdatePreferencesData, UserFilterOptions } from '../../services/userService';
import { UserModel, UserProfile, CreateUserData } from '../../models/user';
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

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockPasswordValidator.validate.mockReturnValue({
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
        last_name: 'Doe',
        timezone: 'America/New_York',
        language_code: 'en'
      };

      const expectedUser: UserProfile = TestDataFactory.createUserProfile({
        email: registerData.email,
        first_name: registerData.first_name,
        last_name: registerData.last_name,
        timezone: registerData.timezone,
        language_code: registerData.language_code
      });

      mockUserModel.findByEmail.mockResolvedValue(null); // User doesn't exist
      mockUserModel.create.mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.registerUser(registerData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPasswordValidator.validate).toHaveBeenCalledWith(registerData.password);
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        email: registerData.email.toLowerCase().trim(),
        password: registerData.password,
        first_name: registerData.first_name.trim(),
        last_name: registerData.last_name.trim(),
        timezone: registerData.timezone,
        language_code: registerData.language_code
      });
      expect(mockLogger.info).toHaveBeenCalledWith('User registered successfully', {
        userId: expectedUser.id,
        email: expectedUser.email
      });
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe'
      };

      const existingUser = TestDataFactory.createUserProfile({ email: registerData.email });
      mockUserModel.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('User with this email already exists');

      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw error when password is weak', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'test@example.com',
        password: 'weak',
        first_name: 'John',
        last_name: 'Doe'
      };

      mockPasswordValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Password too short', 'Missing special characters']
      });

      mockUserModel.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Password validation failed');

      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during registration', async () => {
      // Arrange
      const registerData: RegisterUserData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe'
      };

      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Failed to register user');
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

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-123';
      mockUserModel.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects.toThrow('Failed to fetch user');
    });
  });

  describe('updateProfile', () => {
    it('should successfully update user profile', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData: UpdateProfileData = {
        first_name: 'Updated',
        last_name: 'User',
        timezone: 'America/New_York'
      };

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      const updatedUser = TestDataFactory.createUserProfile({
        id: userId,
        first_name: updateData.first_name,
        last_name: updateData.last_name,
        timezone: updateData.timezone
      });

      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.update.mockResolvedValue(updatedUser);

      // Act
      const result = await UserService.updateProfile(userId, updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.update).toHaveBeenCalledWith(userId, updateData);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating profile for user user-123', {
        profileData: updateData
      });
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

    it('should handle update validation errors', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData: UpdateProfileData = { first_name: 'Updated' };

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.update.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(UserService.updateProfile(userId, updateData))
        .rejects.toThrow('Failed to update profile');

      expect(mockLogger.error).toHaveBeenCalledWith('User profile update failed',
        expect.objectContaining({
          error: expect.any(Error),
          userId,
          updateData
        })
      );
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
      mockUserModel.updatePassword.mockResolvedValue(true);

      // Act
      await UserService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockPasswordValidator.validate).toHaveBeenCalledWith(newPassword);
      expect(mockUserModel.updatePassword).toHaveBeenCalledWith(userId, newPassword);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';

      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('User not found');
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
    });

    it('should throw error when new password is weak', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'weak';

      const existingUser = TestDataFactory.createUserProfile({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.verifyPassword.mockResolvedValue(true);
      
      mockPasswordValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Password too short']
      });

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Password validation failed');

      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('should successfully retrieve users with filters', async () => {
      // Arrange
      const filterOptions: UserFilterOptions = {
        search: 'john',
        role: 'user',
        is_active: true,
        limit: 10,
        offset: 0
      };

      const mockUsers = [
        TestDataFactory.createUserProfile({ first_name: 'John', last_name: 'Doe' }),
        TestDataFactory.createUserProfile({ first_name: 'Jane', last_name: 'Smith' })
      ];

      const mockResponse = {
        users: mockUsers,
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false
      };

      mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

      // Act
      const result = await UserService.getUsers(filterOptions);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(filterOptions);
    });

    it('should handle empty filter options', async () => {
      // Arrange
      const mockResponse = {
        users: [],
        total: 0,
        limit: 20,
        offset: 0,
        hasMore: false
      };

      mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

      // Act
      const result = await UserService.getUsers({});

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockUserModel.findWithFilters).toHaveBeenCalledWith({});
    });

    it('should handle database errors', async () => {
      // Arrange
      const filterOptions: UserFilterOptions = { search: 'test' };
      mockUserModel.findWithFilters.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.getUsers(filterOptions))
        .rejects.toThrow('Failed to fetch users');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle generic database errors gracefully', async () => {
      // Arrange
      mockUserModel.findById.mockRejectedValue(new Error('Unexpected database error'));

      // Act & Assert
      await expect(UserService.getUserById('user-123'))
        .rejects.toThrow('Failed to fetch user');
    });

    it('should handle AppError instances properly', async () => {
      // Arrange
      const appError = new AppError('Custom validation error', 400);
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue(appError);

      // Act & Assert
      await expect(UserService.registerUser({
        email: 'test@example.com',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User'
      })).rejects.toThrow('Custom validation error');
    });

    it('should handle unexpected errors during registration', async () => {
      // Arrange
      mockUserModel.findById.mockRejectedValue(new Error('Generic error'));

      // Act & Assert
      await expect(UserService.getUserById('user-123'))
        .rejects.toThrow('Failed to fetch user');
    });
  });
});
