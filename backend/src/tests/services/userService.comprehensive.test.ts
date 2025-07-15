/**
 * UserService Comprehensive Unit Tests
 * Full test suite with advanced mocking, security testing, and edge cases
 */

import { UserService } from '../../services/userService';
import { UserModel } from '../../models/user';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { PasswordValidator } from '../../validators/passwordValidator';
import { TestDataFactory } from '../utils/testDataFactory';

// Mock all dependencies
jest.mock('../../models/user');
jest.mock('../../utils/logger');
jest.mock('../../validators/passwordValidator');
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

const mockUserModel = UserModel as jest.MockedClass<typeof UserModel>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockPasswordValidator = PasswordValidator as jest.MockedClass<typeof PasswordValidator>;

describe('UserService - Comprehensive Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
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
        const expectedUser = TestDataFactory.createUser({
          email: registrationData.email,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name
        });

        mockUserModel.findByEmail.mockResolvedValue(null); // User doesn't exist
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        const result = await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registrationData.email);
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: registrationData.email,
            first_name: registrationData.first_name,
            last_name: registrationData.last_name
          })
        );
        expect(result).toEqual(expectedUser);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User registered successfully',
          expect.objectContaining({
            userId: expectedUser.id,
            email: registrationData.email
          })
        );
      });

      it('should normalize email to lowercase', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData({
          email: 'Test.User@EXAMPLE.COM'
        });
        const expectedUser = TestDataFactory.createUser({
          email: 'test.user@example.com'
        });

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test.user@example.com'
          })
        );
      });

      it('should hash password before storing', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const expectedUser = TestDataFactory.createUser();

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            password_hash: expect.not.stringMatching(registrationData.password)
          })
        );
      });

      it('should set default preferences for new users', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const expectedUser = TestDataFactory.createUser();

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              timezone: 'UTC',
              language: 'en',
              notifications: expect.any(Object)
            })
          })
        );
      });
    });

    describe('Validation and Security', () => {
      it('should reject registration with existing email', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const existingUser = TestDataFactory.createUser({
          email: registrationData.email
        });

        mockUserModel.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Email address is already registered');

        expect(mockUserModel.create).not.toHaveBeenCalled();
      });

      it('should validate password strength', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData({
          password: 'weak'
        });

        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short', 'Missing uppercase letter'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Password validation failed');

        expect(mockUserModel.create).not.toHaveBeenCalled();
      });

      it('should validate email format', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData({
          email: 'invalid-email-format'
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Invalid email format');
      });

      it('should enforce minimum name lengths', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData({
          first_name: '',
          last_name: 'a'
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('First name and last name are required');
      });

      it('should prevent SQL injection in email field', async () => {
        // Arrange
        const maliciousData = TestDataFactory.createRegistrationData({
          email: "test@example.com'; DROP TABLE users; --"
        });

        // Act & Assert
        await expect(UserService.registerUser(maliciousData))
          .rejects
          .toThrow('Invalid email format');

        expect(mockUserModel.findByEmail).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle database connection errors', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const dbError = new Error('Database connection failed');

        mockUserModel.findByEmail.mockRejectedValue(dbError);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Failed to register user');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'User registration failed',
          expect.objectContaining({
            error: dbError.message,
            email: registrationData.email
          })
        );
      });

      it('should handle password hashing failures', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const hashError = new Error('Hashing algorithm failed');

        mockUserModel.findByEmail.mockResolvedValue(null);
        jest.spyOn(require('bcrypt'), 'hash').mockRejectedValue(hashError);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Failed to process password');
      });
    });
  });

  describe('User Authentication', () => {
    describe('Successful Login', () => {
      it('should authenticate user with valid credentials', async () => {
        // Arrange
        const user = TestDataFactory.createUser();
        const loginData = TestDataFactory.createLoginData(user);

        mockUserModel.findByEmail.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

        // Act
        const result = await UserService.authenticateUser(loginData.email, loginData.password);

        // Assert
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith(loginData.email);
        expect(result).toEqual(user);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User authenticated successfully',
          expect.objectContaining({
            userId: user.id,
            email: user.email
          })
        );
      });

      it('should update last login timestamp', async () => {
        // Arrange
        const user = TestDataFactory.createUser();
        const loginData = TestDataFactory.createLoginData(user);

        mockUserModel.findByEmail.mockResolvedValue(user);
        mockUserModel.updateLoginInfo.mockResolvedValue(undefined);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

        // Act
        await UserService.authenticateUser(loginData.email, loginData.password);

        // Assert
        expect(mockUserModel.updateLoginInfo).toHaveBeenCalledWith(
          user.id,
          expect.objectContaining({
            last_login_at: expect.any(Date),
            login_count: expect.any(Number)
          })
        );
      });
    });

    describe('Authentication Failures', () => {
      it('should reject login with non-existent email', async () => {
        // Arrange
        const loginData = { email: 'nonexistent@example.com', password: 'password' };
        mockUserModel.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.authenticateUser(loginData.email, loginData.password))
          .rejects
          .toThrow('Invalid email or password');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Login attempt with non-existent email',
          expect.objectContaining({
            email: loginData.email
          })
        );
      });

      it('should reject login with incorrect password', async () => {
        // Arrange
        const user = TestDataFactory.createUser();
        const loginData = { email: user.email, password: 'wrongpassword' };

        mockUserModel.findByEmail.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

        // Act & Assert
        await expect(UserService.authenticateUser(loginData.email, loginData.password))
          .rejects
          .toThrow('Invalid email or password');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Login attempt with incorrect password',
          expect.objectContaining({
            userId: user.id,
            email: user.email
          })
        );
      });

      it('should reject login for inactive users', async () => {
        // Arrange
        const inactiveUser = TestDataFactory.createUser({ status: 'inactive' });
        const loginData = TestDataFactory.createLoginData(inactiveUser);

        mockUserModel.findByEmail.mockResolvedValue(inactiveUser);

        // Act & Assert
        await expect(UserService.authenticateUser(loginData.email, loginData.password))
          .rejects
          .toThrow('Account is inactive');
      });

      it('should reject login for unverified emails when required', async () => {
        // Arrange
        const unverifiedUser = TestDataFactory.createUser({ email_verified: false });
        const loginData = TestDataFactory.createLoginData(unverifiedUser);

        mockUserModel.findByEmail.mockResolvedValue(unverifiedUser);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

        // Act & Assert
        await expect(UserService.authenticateUser(
          loginData.email, 
          loginData.password, 
          { requireEmailVerification: true }
        )).rejects.toThrow('Email verification required');
      });

      it('should implement rate limiting for failed attempts', async () => {
        // Arrange
        const user = TestDataFactory.createUser();
        const loginData = { email: user.email, password: 'wrongpassword' };

        mockUserModel.findByEmail.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

        // Simulate multiple failed attempts
        for (let i = 0; i < 5; i++) {
          try {
            await UserService.authenticateUser(loginData.email, loginData.password);
          } catch (error) {
            // Expected to fail
          }
        }

        // Act & Assert - 6th attempt should be rate limited
        await expect(UserService.authenticateUser(loginData.email, loginData.password))
          .rejects
          .toThrow('Too many failed login attempts');
      });
    });
  });

  describe('User Profile Management', () => {
    describe('Profile Updates', () => {
      it('should update user profile successfully', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const updateData = {
          first_name: 'Updated',
          last_name: 'Name',
          bio: 'Updated bio',
          avatar_url: 'https://example.com/new-avatar.jpg'
        };
        const updatedUser = TestDataFactory.createUser({ id: userId, ...updateData });

        mockUserModel.findById.mockResolvedValue(TestDataFactory.createUser({ id: userId }));
        mockUserModel.updateProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updateProfile(userId, updateData);

        // Assert
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(userId, updateData);
        expect(result).toEqual(updatedUser);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User profile updated',
          expect.objectContaining({ userId })
        );
      });

      it('should validate profile data before update', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const invalidData = {
          first_name: '', // Empty name
          bio: 'x'.repeat(1001), // Too long
          avatar_url: 'not-a-valid-url'
        };

        // Act & Assert
        await expect(UserService.updateProfile(userId, invalidData))
          .rejects
          .toThrow('Invalid profile data');

        expect(mockUserModel.updateProfile).not.toHaveBeenCalled();
      });

      it('should sanitize input data', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const maliciousData = {
          first_name: '<script>alert("xss")</script>',
          bio: 'Normal bio content'
        };
        const sanitizedUser = TestDataFactory.createUser({
          id: userId,
          first_name: 'scriptalert("xss")/script', // Sanitized
          bio: 'Normal bio content'
        });

        mockUserModel.findById.mockResolvedValue(TestDataFactory.createUser({ id: userId }));
        mockUserModel.updateProfile.mockResolvedValue(sanitizedUser);

        // Act
        const result = await UserService.updateProfile(userId, maliciousData);

        // Assert
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            first_name: expect.not.stringContaining('<script>')
          })
        );
      });
    });

    describe('Preferences Management', () => {
      it('should update user preferences', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const preferencesData = {
          timezone: 'America/New_York',
          language: 'es',
          notifications: {
            email: false,
            push: true,
            desktop: false
          },
          theme: 'dark'
        };

        const updatedUser = TestDataFactory.createUser({
          id: userId,
          preferences: preferencesData
        });

        mockUserModel.findById.mockResolvedValue(TestDataFactory.createUser({ id: userId }));
        mockUserModel.updatePreferences.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updatePreferences(userId, preferencesData);

        // Assert
        expect(mockUserModel.updatePreferences).toHaveBeenCalledWith(userId, preferencesData);
        expect(result.preferences).toEqual(preferencesData);
      });

      it('should validate timezone values', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const invalidData = {
          timezone: 'Invalid/Timezone'
        };

        // Act & Assert
        await expect(UserService.updatePreferences(userId, invalidData))
          .rejects
          .toThrow('Invalid timezone');
      });

      it('should validate language codes', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const invalidData = {
          language: 'invalid-lang-code'
        };

        // Act & Assert
        await expect(UserService.updatePreferences(userId, invalidData))
          .rejects
          .toThrow('Invalid language code');
      });
    });
  });

  describe('Password Management', () => {
    describe('Password Changes', () => {
      it('should change password with valid current password', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'CurrentPassword123!',
          new_password: 'NewPassword456!'
        };

        mockUserModel.findById.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
        mockUserModel.updatePassword.mockResolvedValue(undefined);

        // Act
        await UserService.changePassword(userId, passwordData);

        // Assert
        expect(mockUserModel.updatePassword).toHaveBeenCalledWith(
          userId,
          expect.not.stringMatching(passwordData.new_password) // Should be hashed
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Password changed successfully',
          expect.objectContaining({ userId })
        );
      });

      it('should reject password change with incorrect current password', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'WrongPassword',
          new_password: 'NewPassword456!'
        };

        mockUserModel.findById.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow('Current password is incorrect');

        expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
      });

      it('should validate new password strength', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'CurrentPassword123!',
          new_password: 'weak'
        };

        mockUserModel.findById.mockResolvedValue(user);
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow('New password does not meet security requirements');
      });

      it('should prevent reusing recent passwords', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'CurrentPassword123!',
          new_password: 'PreviousPassword123!' // Recently used password
        };

        mockUserModel.findById.mockResolvedValue(user);
        mockUserModel.getPasswordHistory.mockResolvedValue([
          { password_hash: 'hash1', created_at: new Date() },
          { password_hash: 'hash2', created_at: new Date() }
        ]);
        jest.spyOn(require('bcrypt'), 'compare')
          .mockResolvedValueOnce(true) // Current password check
          .mockResolvedValueOnce(true); // Password history check

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow('Cannot reuse recent passwords');
      });
    });

    describe('Password Reset', () => {
      it('should initiate password reset for valid email', async () => {
        // Arrange
        const user = TestDataFactory.createUser();
        const resetToken = 'secure-reset-token';

        mockUserModel.findByEmail.mockResolvedValue(user);
        mockUserModel.createPasswordResetToken.mockResolvedValue(resetToken);

        // Act
        await UserService.initiatePasswordReset(user.email);

        // Assert
        expect(mockUserModel.createPasswordResetToken).toHaveBeenCalledWith(user.id);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Password reset initiated',
          expect.objectContaining({
            userId: user.id,
            email: user.email
          })
        );
      });

      it('should not reveal if email exists during reset', async () => {
        // Arrange
        const nonExistentEmail = 'nonexistent@example.com';
        mockUserModel.findByEmail.mockResolvedValue(null);

        // Act
        await UserService.initiatePasswordReset(nonExistentEmail);

        // Assert - Should not throw error to prevent email enumeration
        expect(mockUserModel.createPasswordResetToken).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Password reset requested for non-existent email',
          expect.objectContaining({ email: nonExistentEmail })
        );
      });

      it('should reset password with valid token', async () => {
        // Arrange
        const resetToken = 'valid-reset-token';
        const newPassword = 'NewSecurePassword123!';
        const user = TestDataFactory.createUser();

        mockUserModel.findByPasswordResetToken.mockResolvedValue(user);
        mockUserModel.resetPassword.mockResolvedValue(undefined);

        // Act
        await UserService.resetPassword(resetToken, newPassword);

        // Assert
        expect(mockUserModel.resetPassword).toHaveBeenCalledWith(
          user.id,
          expect.not.stringMatching(newPassword), // Should be hashed
          resetToken
        );
      });

      it('should reject expired reset tokens', async () => {
        // Arrange
        const expiredToken = 'expired-token';
        const newPassword = 'NewPassword123!';

        mockUserModel.findByPasswordResetToken.mockResolvedValue(null);

        // Act & Assert
        await expect(UserService.resetPassword(expiredToken, newPassword))
          .rejects
          .toThrow('Invalid or expired reset token');
      });
    });
  });

  describe('User Search and Filtering', () => {
    describe('User Lists', () => {
      it('should retrieve paginated user list', async () => {
        // Arrange
        const filters = {
          status: 'active',
          role: 'member',
          search: 'john',
          page: 1,
          limit: 20
        };
        const users = TestDataFactory.createUsers(15);
        const mockResponse = TestDataFactory.createMockPaginationResponse(users, 1, 20, 15);

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.getUserList(filters);

        // Assert
        expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(filters);
        expect(result).toEqual(mockResponse);
        expect(result.data).toHaveLength(15);
      });

      it('should apply security filters for non-admin users', async () => {
        // Arrange
        const filters = { page: 1, limit: 10 };
        const requestingUserId = testUtils.generateTestId();
        const users = TestDataFactory.createUsers(5);
        const mockResponse = TestDataFactory.createMockPaginationResponse(users);

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        await UserService.getUserList(filters, requestingUserId, false); // Not admin

        // Assert
        expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            exclude_sensitive: true
          })
        );
      });

      it('should handle search with special characters safely', async () => {
        // Arrange
        const maliciousSearch = "'; DROP TABLE users; --";
        const filters = { search: maliciousSearch };

        // Act & Assert
        await expect(UserService.getUserList(filters))
          .not.toThrow(); // Should handle gracefully

        expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            search: expect.not.stringContaining('DROP TABLE')
          })
        );
      });
    });

    describe('User Statistics', () => {
      it('should calculate user statistics correctly', async () => {
        // Arrange
        const mockStats = {
          total_users: 100,
          active_users: 85,
          verified_users: 90,
          admin_users: 5,
          users_by_status: {
            active: 85,
            inactive: 10,
            suspended: 3,
            pending_verification: 2
          },
          users_by_role: {
            user: 90,
            admin: 8,
            super_admin: 2
          },
          recent_registrations: 12,
          recent_logins: 45
        };

        mockUserModel.getStatistics.mockResolvedValue(mockStats);

        // Act
        const result = await UserService.getUserStatistics();

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total_users).toBe(100);
        expect(result.users_by_status.active).toBe(85);
      });

      it('should handle empty statistics gracefully', async () => {
        // Arrange
        const emptyStats = {
          total_users: 0,
          active_users: 0,
          verified_users: 0,
          admin_users: 0,
          users_by_status: {},
          users_by_role: {},
          recent_registrations: 0,
          recent_logins: 0
        };

        mockUserModel.getStatistics.mockResolvedValue(emptyStats);

        // Act
        const result = await UserService.getUserStatistics();

        // Assert
        expect(result.total_users).toBe(0);
        expect(Object.keys(result.users_by_status)).toHaveLength(0);
      });
    });
  });

  describe('Security and Edge Cases', () => {
    describe('Input Validation', () => {
      it('should validate UUID formats for user IDs', async () => {
        // Arrange
        const invalidId = 'not-a-uuid';

        // Act & Assert
        await expect(UserService.getUserById(invalidId))
          .rejects
          .toThrow('Invalid user ID format');
      });

      it('should sanitize all string inputs', async () => {
        // Arrange
        const maliciousData = {
          first_name: '<script>alert("xss")</script>',
          last_name: '"><img src=x onerror=alert(1)>',
          bio: 'Normal content'
        };

        // Mock sanitization
        jest.spyOn(require('validator'), 'escape').mockImplementation((str) => 
          str.replace(/[<>"'&]/g, '')
        );

        // Act
        const sanitized = UserService.sanitizeUserInput(maliciousData);

        // Assert
        expect(sanitized.first_name).not.toContain('<script>');
        expect(sanitized.last_name).not.toContain('<img');
        expect(sanitized.bio).toBe('Normal content');
      });

      it('should enforce rate limits on sensitive operations', async () => {
        // Arrange
        const userId = testUtils.generateTestId();

        // Simulate multiple password change attempts
        const promises = Array(10).fill(0).map(() =>
          UserService.changePassword(userId, {
            current_password: 'wrong',
            new_password: 'new'
          }).catch(() => {})
        );

        await Promise.all(promises);

        // Act & Assert
        await expect(UserService.changePassword(userId, {
          current_password: 'correct',
          new_password: 'new'
        })).rejects.toThrow('Rate limit exceeded');
      });
    });

    describe('Performance and Scalability', () => {
      it('should handle large user datasets efficiently', async () => {
        // Arrange
        const largeFilters = { limit: 1000 };
        const largeUserSet = TestDataFactory.createUsers(1000);
        const mockResponse = TestDataFactory.createMockPaginationResponse(largeUserSet);

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.getUserList(largeFilters);

        // Assert
        expect(result.data).toHaveLength(1000);
        expect(mockUserModel.findWithFilters).toHaveBeenCalledTimes(1);
      });

      it('should implement caching for frequently accessed data', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });

        mockUserModel.findById.mockResolvedValue(user);

        // Act - Multiple calls
        await UserService.getUserById(userId);
        await UserService.getUserById(userId);
        await UserService.getUserById(userId);

        // Assert - Should cache after first call
        expect(mockUserModel.findById).toHaveBeenCalledTimes(1);
      });

      it('should handle concurrent user operations safely', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });

        mockUserModel.findById.mockResolvedValue(user);
        mockUserModel.updateProfile.mockResolvedValue(user);

        // Act - Simulate concurrent updates
        const promises = Array(5).fill(0).map((_, i) =>
          UserService.updateProfile(userId, { first_name: `Name${i}` })
        );

        // Assert - Should handle without conflicts
        await expect(Promise.all(promises)).resolves.toBeDefined();
      });

      it('should handle database timeouts gracefully', async () => {
        // Arrange
        const timeoutError = new Error('Query timeout');
        timeoutError.name = 'TimeoutError';
        mockUserModel.findWithFilters.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(UserService.getUserList({}))
          .rejects
          .toThrow('Request timeout - please try again');
      });
    });

    describe('Data Privacy and Compliance', () => {
      it('should exclude sensitive data from public endpoints', async () => {
        // Arrange
        const user = TestDataFactory.createUser({
          password: 'hashed-password',
          email: 'user@example.com'
        });

        mockUserModel.findById.mockResolvedValue(user);

        // Act
        const result = await UserService.getPublicProfile(user.id);

        // Assert
        expect(result).not.toHaveProperty('password');
        expect(result).not.toHaveProperty('password_hash');
        expect(result).toHaveProperty('first_name');
        expect(result).toHaveProperty('last_name');
      });

      it('should implement data retention policies', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        mockUserModel.anonymizeUser.mockResolvedValue(undefined);

        // Act
        await UserService.deleteUserData(userId, { anonymize: true });

        // Assert
        expect(mockUserModel.anonymizeUser).toHaveBeenCalledWith(userId);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User data anonymized',
          expect.objectContaining({ userId })
        );
      });

      it('should audit all admin operations', async () => {
        // Arrange
        const adminId = testUtils.generateTestId();
        const targetUserId = testUtils.generateTestId();

        // Act
        await UserService.updateUserRole(targetUserId, 'admin', adminId);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Admin operation performed',
          expect.objectContaining({
            adminId,
            targetUserId,
            operation: 'role_change',
            newRole: 'admin'
          })
        );
      });
    });
  });
});
