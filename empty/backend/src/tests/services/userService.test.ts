import { 
  mockUserModel, 
  mockLogger, 
  MockAppError, 
  mockPasswordValidator,
  createTestUser,
  resetAllMocks 
} from '../mocks';

// Mock dependencies first - these need to be before imports
jest.mock('../../models/user', () => ({
  UserModel: require('../mocks').mockUserModel
}));

jest.mock('../../utils/logger', () => ({
  logger: require('../mocks').mockLogger
}));

jest.mock('../../middleware/errorHandler', () => ({
  AppError: require('../mocks').MockAppError
}));

jest.mock('../../validators/passwordValidator', () => ({
  PasswordValidator: require('../mocks').mockPasswordValidator
}));

// Import after mocks
import { UserService } from '../../services/userService';

describe('UserService', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('registerUser', () => {
    const registerData = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      first_name: 'New',
      last_name: 'User',
      timezone: 'UTC',
      language_code: 'en'
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const mockUser = createTestUser({ 
        email: registerData.email,
        first_name: registerData.first_name,
        last_name: registerData.last_name
      });
      
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockPasswordValidator.isStrongPassword.mockReturnValue(true);
      mockUserModel.create.mockResolvedValue(mockUser);

      // Act
      const result = await UserService.registerUser(registerData);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(mockPasswordValidator.isStrongPassword).toHaveBeenCalledWith(registerData.password);
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerData.email,
          first_name: registerData.first_name,
          last_name: registerData.last_name,
          timezone: registerData.timezone,
          language_code: registerData.language_code
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        { email: registerData.email, userId: mockUser.id }
      );
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const existingUser = createTestUser({ email: registerData.email });
      mockUserModel.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Email already registered');
      
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw error when password is weak', async () => {
      // Arrange
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockPasswordValidator.isStrongPassword.mockReturnValue(false);

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Password does not meet security requirements');
      
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during registration', async () => {
      // Arrange
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockPasswordValidator.isStrongPassword.mockReturnValue(true);
      mockUserModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserService.registerUser(registerData))
        .rejects.toThrow('Failed to register user');
    });
  });

  describe('getUserById', () => {
    const userId = 'user-123';

    it('should successfully retrieve user by ID', async () => {
      // Arrange
      const mockUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(mockUser);

      // Act
      const result = await UserService.getUserById(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects.toThrow('User not found');
      
      expect(mockLogger.warn).toHaveBeenCalledWith('User not found', { userId });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockUserModel.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserService.getUserById(userId))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('updateProfile', () => {
    const userId = 'user-123';
    const updateData = {
      first_name: 'Updated',
      last_name: 'User',
      bio: 'Updated bio',
      timezone: 'America/New_York'
    };

    it('should successfully update user profile', async () => {
      // Arrange
      const existingUser = createTestUser({ id: userId });
      const updatedUser = createTestUser({ 
        id: userId,
        first_name: updateData.first_name,
        last_name: updateData.last_name
      });

      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.update.mockResolvedValue(updatedUser);

      // Act
      const result = await UserService.updateProfile(userId, updateData);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.update).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(updatedUser);
      expect(mockLogger.info).toHaveBeenCalledWith('User profile updated successfully', {
        userId,
        updatedFields: Object.keys(updateData)
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.updateProfile(userId, updateData))
        .rejects.toThrow('User not found');
      
      expect(mockUserModel.update).not.toHaveBeenCalled();
    });

    it('should handle update validation errors', async () => {
      // Arrange
      const existingUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockUserModel.update.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(UserService.updateProfile(userId, updateData))
        .rejects.toThrow('Failed to update user profile');
      
      expect(mockLogger.error).toHaveBeenCalledWith('User profile update failed', 
        expect.objectContaining({
          userId,
          updateData,
          error: expect.any(Error)
        })
      );
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewPassword456!';

    it('should successfully change user password', async () => {
      // Arrange
      const existingUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockPasswordValidator.verifyPassword.mockResolvedValue(true);
      mockPasswordValidator.isStrongPassword.mockReturnValue(true);
      mockUserModel.updatePassword.mockResolvedValue(undefined);

      // Act
      await UserService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockPasswordValidator.verifyPassword).toHaveBeenCalledWith(
        currentPassword,
        expect.any(String)
      );
      expect(mockPasswordValidator.isStrongPassword).toHaveBeenCalledWith(newPassword);
      expect(mockUserModel.updatePassword).toHaveBeenCalledWith(userId, newPassword);
      expect(mockLogger.info).toHaveBeenCalledWith('Password changed successfully', { userId });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('User not found');
      
      expect(mockPasswordValidator.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw error when current password is incorrect', async () => {
      // Arrange
      const existingUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockPasswordValidator.verifyPassword.mockResolvedValue(false);

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');
      
      expect(mockPasswordValidator.isStrongPassword).not.toHaveBeenCalled();
    });

    it('should throw error when new password is weak', async () => {
      // Arrange
      const existingUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(existingUser);
      mockPasswordValidator.verifyPassword.mockResolvedValue(true);
      mockPasswordValidator.isStrongPassword.mockReturnValue(false);

      // Act & Assert
      await expect(UserService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('New password does not meet security requirements');
      
      expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    const filterOptions = {
      search: 'john',
      role: 'user',
      status: 'active',
      limit: 10,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'desc' as const
    };

    it('should successfully retrieve users with filters', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ id: 'user-1', email: 'john1@example.com' }),
        createTestUser({ id: 'user-2', email: 'john2@example.com' })
      ];
      const mockResult = {
        users: mockUsers,
        total: 2,
        hasMore: false
      };

      mockUserModel.findByFilters.mockResolvedValue(mockResult);

      // Act
      const result = await UserService.getUsers(filterOptions);

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockUserModel.findByFilters).toHaveBeenCalledWith(filterOptions);
      expect(mockLogger.info).toHaveBeenCalledWith('Users retrieved successfully', {
        count: mockUsers.length,
        filters: filterOptions
      });
    });

    it('should handle empty filter options', async () => {
      // Arrange
      const mockResult = {
        users: [],
        total: 0,
        hasMore: false
      };

      mockUserModel.findByFilters.mockResolvedValue(mockResult);

      // Act
      const result = await UserService.getUsers({});

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockUserModel.findByFilters).toHaveBeenCalledWith({});
    });

    it('should handle database errors', async () => {
      // Arrange
      mockUserModel.findByFilters.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(UserService.getUsers(filterOptions))
        .rejects.toThrow('Failed to retrieve users');
    });
  });
});
