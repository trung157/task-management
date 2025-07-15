/**
 * TaskService and UserService Integration Tests
 * Comprehensive test suite with proper mocking and edge case coverage
 */

import { TestDataFactory } from '../utils/testDataFactory';
import { 
  createMockTaskRepository,
  createMockUserModel,
  createMockLogger,
  createMockPasswordValidator
} from '../utils/mockFactory';

// Define mock objects
const mockTaskRepo = createMockTaskRepository();
const mockUserModel = createMockUserModel();
const mockLogger = createMockLogger();
const mockPasswordValidator = createMockPasswordValidator();

// Mock the modules
jest.mock('../../repositories/taskRepository', () => ({
  taskRepository: mockTaskRepo
}));

jest.mock('../../models/user', () => ({
  UserModel: mockUserModel
}));

jest.mock('../../utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('../../validators/passwordValidator', () => ({
  PasswordValidator: mockPasswordValidator
}));

// Additional mocks for dependencies
jest.mock('../../hooks/taskNotificationHooks', () => ({
  TaskNotificationHooks: {
    getInstance: jest.fn().mockReturnValue({
      executeCreateHooks: jest.fn(),
      executeUpdateHooks: jest.fn(),
      executeDeleteHooks: jest.fn(),
      executeStatusChangeHooks: jest.fn()
    })
  }
}));

jest.mock('../../services/advancedTaskNotificationService', () => ({
  AdvancedTaskNotificationService: {
    getInstance: jest.fn().mockReturnValue({
      scheduleTaskReminder: jest.fn(),
      cancelTaskReminder: jest.fn(),
      sendTaskNotification: jest.fn()
    })
  }
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

// Import services after mocking
import { TaskService } from '../../services/taskService';
import { UserService } from '../../services/userService';
import { AppError } from '../../middleware/errorHandler';

describe('TaskService and UserService - Comprehensive Integration Tests', () => {
  let taskService: TaskService;
  const bcrypt = require('bcrypt');

  beforeEach(() => {
    jest.clearAllMocks();
    taskService = new TaskService();
    
    // Setup default mock returns
    mockPasswordValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
      score: 8
    });
    
    bcrypt.hash.mockResolvedValue('hashed-password');
    bcrypt.compare.mockResolvedValue(true);
  });

  describe('TaskService Core Functionality', () => {
    const userId = testUtils.generateTestId();

    describe('Task Creation with Validation', () => {
      it('should create task with comprehensive validation', async () => {
        // Arrange
        const taskData = TestDataFactory.createTaskData({
          title: 'Test Task',
          description: 'Test description',
          priority: 'high',
          due_date: testUtils.createTestDate(7)
        });
        
        const expectedTask = TestDataFactory.createTask({
          ...taskData,
          created_by: userId
        });

        mockTaskRepo.create.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, taskData);

        // Assert
        expect(mockTaskRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            created_by: userId
          })
        );
        expect(result).toEqual(expectedTask);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Task created successfully',
          expect.any(Object)
        );
      });

      it('should validate business rules and constraints', async () => {
        // Arrange
        const invalidTaskData = {
          title: 'a'.repeat(501), // Too long
          description: 'b'.repeat(5001), // Too long  
          tags: Array(25).fill('tag') // Too many tags
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidTaskData))
          .rejects
          .toThrow();

        expect(mockTaskRepo.create).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        // Arrange
        const taskData = TestDataFactory.createTaskData();
        const dbError = new Error('Database connection failed');
        mockTaskRepo.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to create task',
          expect.any(Object)
        );
      });
    });

    describe('Task Updates and Status Management', () => {
      const taskId = testUtils.generateTestId();

      it('should update task with proper validation', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          status: 'todo'
        });
        const updateData = { 
          title: 'Updated Title',
          status: 'in_progress',
          priority: 'high'
        };
        const updatedTask = { ...existingTask, ...updateData };

        mockTaskRepo.findById.mockResolvedValue(existingTask);
        mockTaskRepo.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, updateData, userId);

        // Assert
        expect(mockTaskRepo.findById).toHaveBeenCalledWith(taskId);
        expect(mockTaskRepo.update).toHaveBeenCalledWith(taskId, updateData);
        expect(result).toEqual(updatedTask);
      });

      it('should validate status transitions', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          status: 'completed',
          created_by: userId
        });
        const invalidUpdate = { status: 'todo' }; // Invalid transition

        mockTaskRepo.findById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, invalidUpdate, userId))
          .rejects
          .toThrow();

        expect(mockTaskRepo.update).not.toHaveBeenCalled();
      });

      it('should handle task not found', async () => {
        // Arrange
        mockTaskRepo.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.updateTask(taskId, {}, userId))
          .rejects
          .toThrow();
      });
    });

    describe('Task Retrieval and Search', () => {
      it('should retrieve task with computed fields', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        const task = TestDataFactory.createTask({
          id: taskId,
          due_date: testUtils.createTestDate(3),
          priority: 'high'
        });

        mockTaskRepo.findByIdWithRelations.mockResolvedValue(task);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(result).toHaveProperty('computed');
        expect(result.computed).toHaveProperty('isOverdue');
        expect(result.computed).toHaveProperty('priorityMetrics');
      });

      it('should search tasks with filters and pagination', async () => {
        // Arrange
        const filters = {
          status: 'in_progress',
          priority: 'high',
          assignee_id: userId
        };
        const pagination = { page: 1, limit: 20 };
        const mockTasks = TestDataFactory.createTasks(5);
        const mockResponse = TestDataFactory.createMockPaginationResponse(mockTasks);

        mockTaskRepo.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks(filters, {}, pagination, userId);

        // Assert
        expect(mockTaskRepo.findWithFilters).toHaveBeenCalledWith(
          filters,
          {},
          pagination
        );
        expect(result).toEqual(mockResponse);
      });

      it('should calculate task statistics', async () => {
        // Arrange
        const mockStats = {
          total: 50,
          by_status: { todo: 15, in_progress: 20, completed: 15 },
          by_priority: { low: 10, medium: 25, high: 15 },
          overdue: 8,
          due_today: 3,
          due_this_week: 12
        };

        mockTaskRepo.getTaskStats.mockResolvedValue(mockStats);

        // Act
        const result = await taskService.getTaskStats(userId);

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total).toBe(50);
      });
    });

    describe('Bulk Operations', () => {
      it('should perform bulk updates successfully', async () => {
        // Arrange
        const taskIds = Array(5).fill(0).map(() => testUtils.generateTestId());
        const updateData = { status: 'completed' };
        const mockResult = {
          updated: 5,
          failed: 0,
          updated_tasks: taskIds,
          failed_tasks: []
        };

        mockTaskRepo.bulkUpdate.mockResolvedValue(mockResult);

        // Act
        const result = await taskService.bulkUpdateTasks(taskIds, updateData, userId);

        // Assert
        expect(result.updated).toBe(5);
        expect(result.failed).toBe(0);
      });

      it('should enforce bulk operation limits', async () => {
        // Arrange
        const tooManyIds = Array(101).fill(0).map(() => testUtils.generateTestId());

        // Act & Assert
        await expect(taskService.bulkUpdateTasks(tooManyIds, {}, userId))
          .rejects
          .toThrow();
      });
    });
  });

  describe('UserService Core Functionality', () => {
    describe('User Registration and Authentication', () => {
      it('should register user with proper validation', async () => {
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
      });

      it('should reject duplicate email registration', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const existingUser = TestDataFactory.createUser({ email: registrationData.email });

        mockUserModel.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow();

        expect(mockUserModel.create).not.toHaveBeenCalled();
      });

      it('should validate password strength', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData({
          password: 'weak'
        });

        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow();
      });

      it('should hash passwords before storage', async () => {
        // Arrange
        const registrationData = TestDataFactory.createRegistrationData();
        const expectedUser = TestDataFactory.createUser();

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        await UserService.registerUser(registrationData);

        // Assert
        expect(bcrypt.hash).toHaveBeenCalledWith(
          registrationData.password,
          expect.any(Number)
        );
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            password_hash: 'hashed-password'
          })
        );
      });
    });

    describe('Profile Management', () => {
      it('should update user profile with validation', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const updateData = {
          first_name: 'Updated',
          last_name: 'Name',
          bio: 'Updated bio'
        };
        const existingUser = TestDataFactory.createUser({ id: userId });
        const updatedUser = { ...existingUser, ...updateData };

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updateProfile(userId, updateData);

        // Assert
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(userId, updateData);
        expect(result).toEqual(updatedUser);
      });

      it('should validate profile data', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const invalidData = {
          first_name: '', // Empty
          bio: 'x'.repeat(1001) // Too long
        };

        // Act & Assert
        await expect(UserService.updateProfile(userId, invalidData))
          .rejects
          .toThrow();
      });

      it('should update preferences with validation', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const preferencesData = {
          timezone: 'America/New_York',
          language: 'es',
          notifications: { email: false, push: true }
        };
        const existingUser = TestDataFactory.createUser({ id: userId });
        const updatedUser = { ...existingUser, preferences: preferencesData };

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updatePreferences.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updatePreferences(userId, preferencesData);

        // Assert
        expect(mockUserModel.updatePreferences).toHaveBeenCalledWith(userId, preferencesData);
        expect(result.preferences).toEqual(preferencesData);
      });
    });

    describe('Password Management', () => {
      it('should change password with proper validation', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'CurrentPassword123!',
          new_password: 'NewPassword456!'
        };

        mockUserModel.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true); // Current password is correct
        mockUserModel.updatePassword.mockResolvedValue(undefined);

        // Act
        await UserService.changePassword(userId, passwordData);

        // Assert
        expect(bcrypt.compare).toHaveBeenCalledWith(
          passwordData.current_password,
          user.password
        );
        expect(bcrypt.hash).toHaveBeenCalledWith(
          passwordData.new_password,
          expect.any(Number)
        );
        expect(mockUserModel.updatePassword).toHaveBeenCalledWith(
          userId,
          'hashed-password'
        );
      });

      it('should reject incorrect current password', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const user = TestDataFactory.createUser({ id: userId });
        const passwordData = {
          current_password: 'WrongPassword',
          new_password: 'NewPassword456!'
        };

        mockUserModel.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(false); // Wrong password

        // Act & Assert
        await expect(UserService.changePassword(userId, passwordData))
          .rejects
          .toThrow();

        expect(mockUserModel.updatePassword).not.toHaveBeenCalled();
      });
    });

    describe('User Search and Statistics', () => {
      it('should retrieve paginated user list', async () => {
        // Arrange
        const filters = { status: 'active', page: 1, limit: 20 };
        const users = TestDataFactory.createUsers(15);
        const mockResponse = TestDataFactory.createMockPaginationResponse(users);

        mockUserModel.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.getUserList(filters);

        // Assert
        expect(mockUserModel.findWithFilters).toHaveBeenCalledWith(filters);
        expect(result).toEqual(mockResponse);
      });

      it('should calculate user statistics', async () => {
        // Arrange
        const mockStats = {
          total_users: 100,
          active_users: 85,
          verified_users: 90,
          users_by_status: { active: 85, inactive: 15 }
        };

        mockUserModel.getStatistics.mockResolvedValue(mockStats);

        // Act
        const result = await UserService.getUserStatistics();

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total_users).toBe(100);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('Input Validation', () => {
      it('should validate UUID formats', async () => {
        // Arrange
        const invalidId = 'not-a-uuid';

        // Act & Assert
        await expect(taskService.getTaskById(invalidId, testUtils.generateTestId()))
          .rejects
          .toThrow();
      });

      it('should handle malformed data gracefully', async () => {
        // Arrange
        const malformedData = {
          title: null,
          description: undefined,
          priority: 'invalid-priority'
        };

        // Act & Assert
        await expect(taskService.createTask(testUtils.generateTestId(), malformedData))
          .rejects
          .toThrow();
      });
    });

    describe('Database Error Handling', () => {
      it('should handle connection timeouts', async () => {
        // Arrange
        const timeoutError = new Error('Connection timeout');
        timeoutError.name = 'TimeoutError';
        mockTaskRepo.findWithFilters.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(taskService.searchTasks({}, {}, {}, testUtils.generateTestId()))
          .rejects
          .toThrow();
      });

      it('should handle constraint violations', async () => {
        // Arrange
        const constraintError = new Error('duplicate key violation');
        constraintError.name = 'UniqueViolationError';
        mockTaskRepo.create.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(taskService.createTask(
          testUtils.generateTestId(),
          TestDataFactory.createTaskData()
        )).rejects.toThrow();
      });
    });

    describe('Performance and Scalability', () => {
      it('should handle large datasets efficiently', async () => {
        // Arrange
        const largeDataset = TestDataFactory.createTasks(1000);
        const mockResponse = TestDataFactory.createMockPaginationResponse(largeDataset);

        mockTaskRepo.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks(
          {},
          {},
          { page: 1, limit: 1000 },
          testUtils.generateTestId()
        );

        // Assert
        expect(result.data).toHaveLength(1000);
        expect(mockTaskRepo.findWithFilters).toHaveBeenCalledTimes(1);
      });

      it('should enforce reasonable pagination limits', async () => {
        // Arrange
        const extremePagination = { page: 1, limit: 10000 };

        // Act & Assert
        await expect(taskService.searchTasks(
          {},
          {},
          extremePagination,
          testUtils.generateTestId()
        )).rejects.toThrow();
      });
    });

    describe('Security Considerations', () => {
      it('should prevent SQL injection in search queries', async () => {
        // Arrange
        const maliciousSearch = "'; DROP TABLE tasks; --";
        const filters = { search: maliciousSearch };

        // Act - Should not throw but should sanitize
        await taskService.searchTasks(filters, {}, {}, testUtils.generateTestId());

        // Assert - Should have been called with sanitized input
        expect(mockTaskRepo.findWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            search: expect.not.stringContaining('DROP TABLE')
          }),
          expect.any(Object),
          expect.any(Object)
        );
      });

      it('should sanitize user input in profile updates', async () => {
        // Arrange
        const userId = testUtils.generateTestId();
        const maliciousData = {
          first_name: '<script>alert("xss")</script>',
          bio: 'Normal content'
        };
        const existingUser = TestDataFactory.createUser({ id: userId });

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(existingUser);

        // Act
        await UserService.updateProfile(userId, maliciousData);

        // Assert
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            first_name: expect.not.stringContaining('<script>')
          })
        );
      });
    });
  });
});
