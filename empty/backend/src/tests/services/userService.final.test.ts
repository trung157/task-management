/**
 * UserService Unit Tests - Comprehensive Edition
 * Properly typed test suite with working mocks and edge case coverage
 */

import { UserService } from '../../services/userService';
import { UserModel } from '../../models/user';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { PasswordValidator } from '../../validators/passwordValidator';
import { TestDataFactory } from '../utils/testDataFactory';
import type { 
  User, 
  UserProfile, 
  CreateUserData
} from '../../models/user';

// Create mocked versions of dependencies
const mockUserModel = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateProfile: jest.fn(),
  updatePreferences: jest.fn(),
  updatePassword: jest.fn(),
  updateLoginInfo: jest.fn(),
  getPasswordHistory: jest.fn(),
  createPasswordResetToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  resetPassword: jest.fn(),
  findWithFilters: jest.fn(),
  getStatistics: jest.fn(),
  anonymizeUser: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockPasswordValidator = {
  validate: jest.fn().mockReturnValue({
    isValid: true,
    errors: [],
    score: 8
  })
};

// Mock modules
jest.mock('../../models/user', () => ({
  UserModel: mockUserModel
}));

jest.mock('../../utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('../../validators/passwordValidator', () => ({
  PasswordValidator: mockPasswordValidator
}));

jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

describe('UserService - Comprehensive Unit Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementations
    Object.values(mockUserModel).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockReset();
      }
    });

    // Setup default password validator mock
    mockPasswordValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
      score: 8
    });
  });

  describe('User Registration', () => {
    describe('Successful Registration', () => {
      it('should register a new user with valid data', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const expectedUser = TestDataFactory.createUserProfile({
          email: registrationData.email,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name
        });

        mockUserModel.findByEmail.mockResolvedValue(null); // User doesn't exist
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        const result = await UserService.registerUser(registrationData);

        // Assert
        expect(result).toEqual(expectedUser);
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith(
          registrationData.email.toLowerCase().trim()
        );
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: registrationData.email.toLowerCase().trim(),
            first_name: registrationData.first_name.trim(),
            last_name: registrationData.last_name.trim(),
            timezone: registrationData.timezone || 'UTC',
            language_code: registrationData.language_code || 'en'
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User registered successfully',
          expect.objectContaining({
            userId: expectedUser.id,
            email: expectedUser.email
          })
        );
      });

      it('should register user with minimal required data', async () => {
        // Arrange
        const registrationData = {
          email: 'test@example.com',
          password: 'SecurePassword123!',
          first_name: 'John',
          last_name: 'Doe'
        };

        const expectedUser = TestDataFactory.createUserProfile({
          email: registrationData.email,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name
        });

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        const result = await UserService.registerUser(registrationData);

        // Assert
        expect(result).toEqual(expectedUser);
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            timezone: 'UTC',
            language_code: 'en'
          })
        );
      });

      it('should trim and normalize email during registration', async () => {
        // Arrange
        const registrationData = {
          email: '  TEST@EXAMPLE.COM  ',
          password: 'SecurePassword123!',
          first_name: '  John  ',
          last_name: '  Doe  '
        };

        const expectedUser = TestDataFactory.createUserProfile({
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        });

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe'
          })
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject weak passwords', async () => {
        // Arrange
        const registrationData = {
          email: 'test@example.com',
          password: '123', // Weak password
          first_name: 'John',
          last_name: 'Doe'
        };

        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short', 'No uppercase letters'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow(AppError);
        
        expect(mockPasswordValidator.validate).toHaveBeenCalledWith(registrationData.password);
      });

      it('should reject duplicate email addresses', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const existingUser = TestDataFactory.createUser({
          email: registrationData.email
        });

        mockUserModel.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow(AppError);
        
        expect(mockUserModel.create).not.toHaveBeenCalled();
      });

      it('should handle database errors during registration', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        
        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockRejectedValue(new Error('Database connection failed'));

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow(AppError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error registering user',
          expect.objectContaining({
            email: registrationData.email
          })
        );
      });
    });
  });

  describe('User Retrieval', () => {
    describe('Get User by ID', () => {
      it('should return user when found', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
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
        const userId = `user-${Date.now()}`;
        mockUserModel.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.getUserById(userId))
          .rejects
          .toThrow(AppError);
      });

      it('should handle database errors', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        mockUserModel.findById.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(UserService.getUserById(userId))
          .rejects
          .toThrow(AppError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error fetching user by ID',
          expect.objectContaining({ userId })
        );
      });
    });

    describe('Get User by Email', () => {
      it('should return user when found', async () => {
        // Arrange
        const email = 'test@example.com';
        const expectedUser = TestDataFactory.createUser({ email });

        mockUserModel.findByEmail.mockResolvedValue(expectedUser);

        // Act
        const result = await UserService.getUserByEmail(email);

        // Assert
        expect(result).toEqual(expectedUser);
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith(email.toLowerCase().trim());
      });

      it('should normalize email before lookup', async () => {
        // Arrange
        const email = '  TEST@EXAMPLE.COM  ';
        const expectedUser = TestDataFactory.createUser({ email: 'test@example.com' });

        mockUserModel.findByEmail.mockResolvedValue(expectedUser);

        // Act
        await UserService.getUserByEmail(email);

        // Assert
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
      });

      it('should throw error when user not found', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        mockUserModel.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.getUserByEmail(email))
          .rejects
          .toThrow(AppError);
      });
    });
  });

  describe('Profile Updates', () => {
    describe('Successful Updates', () => {
      it('should update user profile with valid data', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const profileData = {
          first_name: 'Updated',
          last_name: 'Name',
          bio: 'Updated bio',
          timezone: 'America/New_York'
        };

        const existingUser = TestDataFactory.createUserProfile({ id: userId });
        const updatedUser = TestDataFactory.createUserProfile({
          id: userId,
          first_name: profileData.first_name,
          last_name: profileData.last_name
        });

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updateProfile(userId, profileData);

        // Assert
        expect(result).toEqual(updatedUser);
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(
          userId,
          expect.objectContaining(profileData)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Updating profile for user ${userId}`,
          expect.objectContaining({ profileData })
        );
      });

      it('should update partial profile data', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const profileData = {
          bio: 'Just updating bio'
        };

        const existingUser = TestDataFactory.createUserProfile({ id: userId });
        const updatedUser = TestDataFactory.createUserProfile({
          id: userId
        });

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updateProfile(userId, profileData);

        // Assert
        expect(result).toEqual(updatedUser);
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(userId, profileData);
      });
    });

    describe('Validation Errors', () => {
      it('should reject empty first name', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const profileData = {
          first_name: '   ' // Empty after trim
        };

        const existingUser = TestDataFactory.createUserProfile({ id: userId });
        mockUserModel.findById.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.updateProfile(userId, profileData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject empty last name', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const profileData = {
          last_name: ''
        };

        const existingUser = TestDataFactory.createUserProfile({ id: userId });
        mockUserModel.findById.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.updateProfile(userId, profileData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject updates for non-existent users', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const profileData = {
          first_name: 'Updated'
        };

        mockUserModel.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.updateProfile(userId, profileData))
          .rejects
          .toThrow(AppError);
      });
    });
  });

  describe('Password Management', () => {
    describe('Password Changes', () => {
      it('should change password with valid current password', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const passwordData = {
          current_password: 'CurrentPass123!',
          new_password: 'NewSecurePass456!',
          confirm_password: 'NewSecurePass456!'
        };

        const existingUser = TestDataFactory.createUser({ id: userId });
        
        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updatePassword.mockResolvedValue(true);

        // Act
        const result = await UserService.changePassword(userId, passwordData);

        // Assert
        expect(result).toBe(true);
        expect(mockUserModel.updatePassword).toHaveBeenCalledWith(
          userId,
          passwordData.new_password
        );
        expect(mockPasswordValidator.validate).toHaveBeenCalledWith(passwordData.new_password);
      });

      it('should reject weak new passwords', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const passwordData = {
          current_password: 'CurrentPass123!',
          new_password: 'weak',
          confirm_password: 'weak'
        };

        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short'],
          score: 1
        });

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject mismatched password confirmations', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const passwordData = {
          current_password: 'CurrentPass123!',
          new_password: 'NewSecurePass456!',
          confirm_password: 'DifferentPass789!'
        };

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow(AppError);
      });
    });

    describe('Password Reset', () => {
      it('should initiate password reset for valid email', async () => {
        // Arrange
        const email = 'test@example.com';
        const existingUser = TestDataFactory.createUser({ email });
        const resetToken = 'reset-token-123';

        mockUserModel.findByEmail.mockResolvedValue(existingUser);
        mockUserModel.createPasswordResetToken.mockResolvedValue(resetToken);

        // Act
        const result = await UserService.initiatePasswordReset(email);

        // Assert
        expect(result).toBe(resetToken);
        expect(mockUserModel.createPasswordResetToken).toHaveBeenCalledWith(existingUser.id);
      });

      it('should not reveal non-existent email addresses', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        mockUserModel.findByEmail.mockResolvedValue(null);

        // Act
        const result = await UserService.initiatePasswordReset(email);

        // Assert
        expect(result).toBe(true); // Always return true for security
        expect(mockUserModel.createPasswordResetToken).not.toHaveBeenCalled();
      });

      it('should reset password with valid token', async () => {
        // Arrange
        const token = 'valid-reset-token';
        const newPassword = 'NewSecurePassword123!';
        const userId = `user-${Date.now()}`;

        mockUserModel.findByPasswordResetToken.mockResolvedValue({ id: userId });
        mockUserModel.resetPassword.mockResolvedValue(true);

        // Act
        const result = await UserService.resetPassword(token, newPassword);

        // Assert
        expect(result).toBe(true);
        expect(mockUserModel.resetPassword).toHaveBeenCalledWith(token, newPassword);
        expect(mockPasswordValidator.validate).toHaveBeenCalledWith(newPassword);
      });

      it('should reject password reset with invalid token', async () => {
        // Arrange
        const token = 'invalid-token';
        const newPassword = 'NewSecurePassword123!';

        mockUserModel.findByPasswordResetToken.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.resetPassword(token, newPassword))
          .rejects
          .toThrow(AppError);
      });
    });
  });

  describe('User Search and Filtering', () => {
    describe('Successful Search', () => {
      it('should search users with filters', async () => {
        // Arrange
        const filters = {
          search: 'john',
          role: ['user', 'admin'],
          status: ['active'],
          email_verified: true,
          limit: 10,
          offset: 0
        };

        const mockUsers = [
          TestDataFactory.createUserProfile({ first_name: 'John', last_name: 'Doe' }),
          TestDataFactory.createUserProfile({ first_name: 'Johnny', last_name: 'Smith' })
        ];

        const mockResponse = {
          users: mockUsers,
          total: 2,
          hasMore: false
        };

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.searchUsers(filters);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(filters);
      });

      it('should handle empty search results', async () => {
        // Arrange
        const filters = { search: 'nonexistent' };
        const mockResponse = {
          users: [],
          total: 0,
          hasMore: false
        };

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.searchUsers(filters);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.users).toHaveLength(0);
      });
    });
  });

  describe('User Statistics', () => {
    describe('Successful Statistics Retrieval', () => {
      it('should get user statistics', async () => {
        // Arrange
        const mockStats = {
          total_users: 1000,
          active_users: 850,
          verified_users: 950,
          admin_users: 10,
          users_by_status: {
            active: 850,
            inactive: 100,
            suspended: 25,
            pending_verification: 25
          },
          users_by_role: {
            user: 980,
            admin: 15,
            super_admin: 5
          },
          recent_registrations: 45,
          recent_logins: 320
        };

        mockUserModel.getStatistics.mockResolvedValue(mockStats);

        // Act
        const result = await UserService.getUserStatistics();

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total_users).toBe(1000);
        expect(result.active_users).toBe(850);
      });
    });
  });

  describe('User Anonymization', () => {
    describe('Successful Anonymization', () => {
      it('should anonymize user data', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const reason = 'GDPR deletion request';

        const existingUser = TestDataFactory.createUser({ id: userId });
        
        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.anonymizeUser.mockResolvedValue(true);

        // Act
        const result = await UserService.anonymizeUser(userId, reason);

        // Assert
        expect(result).toBe(true);
        expect(mockUserModel.anonymizeUser).toHaveBeenCalledWith(userId, reason);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User anonymized successfully',
          expect.objectContaining({ userId, reason })
        );
      });

      it('should reject anonymization of non-existent users', async () => {
        // Arrange
        const userId = `user-${Date.now()}`;
        const reason = 'GDPR deletion request';

        mockUserModel.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.anonymizeUser(userId, reason))
          .rejects
          .toThrow(AppError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected database errors gracefully', async () => {
      // Arrange
      const userId = `user-${Date.now()}`;
      mockUserModel.findById.mockRejectedValue(new Error('Unexpected database error'));

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects
        .toThrow(AppError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should preserve AppError instances', async () => {
      // Arrange
      const registrationData = TestDataFactory.createRegistrationData();
      const appError = new AppError('Custom validation error', 400);
      
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue(appError);

      // Act & Assert
      await expect(UserService.registerUser(registrationData))
        .rejects
        .toThrow(AppError);
    });

    it('should convert generic errors to AppError', async () => {
      // Arrange
      const userId = `user-${Date.now()}`;
      mockUserModel.findById.mockRejectedValue(new Error('Generic error'));

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects
        .toThrow(AppError);
    });
  });
});
