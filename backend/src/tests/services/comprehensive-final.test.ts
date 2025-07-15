/**
 * Comprehensive Unit Tests for TaskService and UserService
 * Complete test suite with proper mocking, validation, and edge case coverage
 */

import { TestDataFactory } from '../utils/testDataFactory';

// Create comprehensive mocks
const mockTaskRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdWithRelations: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findWithFilters: jest.fn(),
  getTaskStats: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn()
};

const mockUserModel = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateProfile: jest.fn(),
  updatePreferences: jest.fn(),
  changePassword: jest.fn(),
  updateLoginInfo: jest.fn(),
  findWithFilters: jest.fn(),
  getStatistics: jest.fn(),
  getUsers: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockPasswordValidator = {
  validate: jest.fn()
};

const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn()
};

// Apply all mocks
jest.mock('../../repositories/taskRepository', () => ({
  taskRepository: mockTaskRepository
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

jest.mock('bcrypt', () => mockBcrypt);

jest.mock('../../hooks/taskNotificationHooks', () => ({
  TaskNotificationHooks: {
    getInstance: () => ({
      executeCreateHooks: jest.fn().mockResolvedValue(undefined),
      executeUpdateHooks: jest.fn().mockResolvedValue(undefined),
      executeDeleteHooks: jest.fn().mockResolvedValue(undefined),
      executeStatusChangeHooks: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

jest.mock('../../services/advancedTaskNotificationService', () => ({
  AdvancedTaskNotificationService: {
    getInstance: () => ({
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
      sendTaskNotification: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

// Import services after mocking
import { TaskService } from '../../services/taskService';
import { UserService } from '../../services/userService';
import { AppError } from '../../middleware/errorHandler';

describe('TaskService and UserService - Comprehensive Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockPasswordValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
      score: 8
    });
    
    mockBcrypt.hash.mockResolvedValue('hashed-password');
    mockBcrypt.compare.mockResolvedValue(true);
  });

  describe('TaskService Tests', () => {
    let taskService: TaskService;
    
    beforeEach(() => {
      taskService = new TaskService();
    });

    describe('Task Creation', () => {
      it('should create a task with valid data', async () => {
        // Arrange
        const userId = 'user-123';
        const taskData = {
          title: 'Test Task',
          description: 'Test description',
          priority: 'high' as const,
          status: 'pending' as const
        };
        
        const expectedTask = {
          id: 'task-123',
          ...taskData,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.create.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, taskData);

        // Assert
        expect(mockTaskRepository.create).toHaveBeenCalledWith(
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

      it('should validate required fields', async () => {
        // Arrange
        const userId = 'user-123';
        const invalidData = {
          title: '', // Empty title
          priority: 'invalid' as any
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidData))
          .rejects
          .toThrow();

        expect(mockTaskRepository.create).not.toHaveBeenCalled();
      });

      it('should enforce business rules', async () => {
        // Arrange
        const userId = 'user-123';
        const invalidData = {
          title: 'a'.repeat(501), // Too long
          description: 'b'.repeat(5001), // Too long
          tags: Array(25).fill('tag') // Too many tags
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidData))
          .rejects
          .toThrow();

        expect(mockTaskRepository.create).not.toHaveBeenCalled();
      });

      it('should handle repository errors', async () => {
        // Arrange
        const userId = 'user-123';
        const taskData = { title: 'Test Task' };
        const error = new Error('Database error');
        
        mockTaskRepository.create.mockRejectedValue(error);

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to create task',
          expect.objectContaining({
            error: error.message,
            userId
          })
        );
      });
    });

    describe('Task Updates', () => {
      it('should update a task successfully', async () => {
        // Arrange
        const taskId = 'task-123';
        const userId = 'user-123';
        const existingTask = {
          id: taskId,
          title: 'Original Task',
          created_by: userId,
          status: 'pending' as const
        };
        const updateData = {
          title: 'Updated Task',
          status: 'in_progress' as const
        };
        const updatedTask = { ...existingTask, ...updateData };

        mockTaskRepository.findById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, userId, updateData);

        // Assert
        expect(mockTaskRepository.findById).toHaveBeenCalledWith(taskId);
        expect(mockTaskRepository.update).toHaveBeenCalledWith(taskId, updateData);
        expect(result).toEqual(updatedTask);
      });

      it('should reject updates for non-existent tasks', async () => {
        // Arrange
        const taskId = 'nonexistent';
        const userId = 'user-123';
        const updateData = { title: 'Updated' };
        
        mockTaskRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.updateTask(taskId, userId, updateData))
          .rejects
          .toThrow();

        expect(mockTaskRepository.update).not.toHaveBeenCalled();
      });

      it('should validate status transitions', async () => {
        // Arrange
        const taskId = 'task-123';
        const userId = 'user-123';
        const existingTask = {
          id: taskId,
          status: 'completed' as const,
          created_by: userId
        };
        const invalidUpdate = { status: 'pending' as const }; // Invalid transition

        mockTaskRepository.findById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, userId, invalidUpdate))
          .rejects
          .toThrow();

        expect(mockTaskRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('Task Retrieval', () => {
      it('should retrieve a task by ID', async () => {
        // Arrange
        const taskId = 'task-123';
        const userId = 'user-123';
        const task = {
          id: taskId,
          title: 'Test Task',
          priority: 'high' as const,
          due_date: new Date(Date.now() + 86400000)
        };

        mockTaskRepository.findByIdWithRelations.mockResolvedValue(task);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(mockTaskRepository.findByIdWithRelations).toHaveBeenCalledWith(taskId);
        expect(result).toEqual(task);
      });

      it('should handle task not found', async () => {
        // Arrange
        const taskId = 'nonexistent';
        const userId = 'user-123';
        
        mockTaskRepository.findByIdWithRelations.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.getTaskById(taskId, userId))
          .rejects
          .toThrow();
      });
    });

    describe('Task Search', () => {
      it('should search tasks with filters', async () => {
        // Arrange
        const userId = 'user-123';
        const filters = { status: 'pending', priority: 'high' };
        const sortOptions = { sort_by: 'created_at', sort_order: 'desc' };
        const pagination = { page: 1, limit: 20 };
        
        const mockTasks = [
          { id: 'task-1', title: 'Task 1', status: 'pending', priority: 'high' },
          { id: 'task-2', title: 'Task 2', status: 'pending', priority: 'high' }
        ];
        const mockResponse = {
          data: mockTasks,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 }
        };

        mockTaskRepository.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks(filters, sortOptions, pagination);

        // Assert
        expect(mockTaskRepository.findWithFilters).toHaveBeenCalledWith(
          filters,
          sortOptions,
          pagination
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Task Statistics', () => {
      it('should calculate task statistics', async () => {
        // Arrange
        const userId = 'user-123';
        const mockStats = {
          by_status: { pending: 3, in_progress: 4, completed: 3 },
          by_priority: { low: 2, medium: 5, high: 3 },
          overdue: 1,
          due_today: 2,
          due_this_week: 4
        };

        mockTaskRepository.getTaskStats.mockResolvedValue(mockStats);

        // Act
        const result = await taskService.getTaskStats(userId);

        // Assert
        expect(mockTaskRepository.getTaskStats).toHaveBeenCalledWith(userId);
        expect(result).toEqual(mockStats);
      });
    });

    describe('Bulk Operations', () => {
      it('should perform bulk updates', async () => {
        // Arrange
        const userId = 'user-123';
        const taskIds = ['task-1', 'task-2', 'task-3'];
        const updateData = { status: 'completed' as const };
        const mockResult = {
          updated: 3,
          failed: 0,
          updated_tasks: taskIds,
          failed_tasks: []
        };

        mockTaskRepository.bulkUpdate.mockResolvedValue(mockResult);

        // Act
        const result = await taskService.bulkUpdateTasks(taskIds, userId, updateData);

        // Assert
        expect(mockTaskRepository.bulkUpdate).toHaveBeenCalledWith(taskIds, updateData);
        expect(result.updated).toBe(3);
        expect(result.failed).toBe(0);
      });

      it('should enforce bulk operation limits', async () => {
        // Arrange
        const userId = 'user-123';
        const tooManyIds = Array(101).fill(0).map((_, i) => `task-${i}`);
        const updateData = { status: 'completed' as const };

        // Act & Assert
        await expect(taskService.bulkUpdateTasks(tooManyIds, userId, updateData))
          .rejects
          .toThrow();
      });
    });
  });

  describe('UserService Tests', () => {
    describe('User Registration', () => {
      it('should register a new user successfully', async () => {
        // Arrange
        const registrationData = {
          email: 'test@example.com',
          password: 'Password123!',
          first_name: 'John',
          last_name: 'Doe',
          timezone: 'UTC',
          language_code: 'en'
        };
        
        const expectedUser = {
          id: 'user-123',
          email: registrationData.email,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name,
          email_verified: false,
          created_at: new Date()
        };

        mockUserModel.findByEmail.mockResolvedValue(null);
        mockUserModel.create.mockResolvedValue(expectedUser);

        // Act
        const result = await UserService.registerUser(registrationData);

        // Assert
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith(registrationData.email);
        expect(mockBcrypt.hash).toHaveBeenCalledWith(registrationData.password, expect.any(Number));
        expect(mockUserModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: registrationData.email,
            password_hash: 'hashed-password',
            first_name: registrationData.first_name,
            last_name: registrationData.last_name
          })
        );
        expect(result).toEqual(expectedUser);
      });

      it('should reject registration with existing email', async () => {
        // Arrange
        const registrationData = {
          email: 'existing@example.com',
          password: 'Password123!',
          first_name: 'John',
          last_name: 'Doe'
        };
        
        const existingUser = { id: 'existing-user', email: registrationData.email };
        mockUserModel.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Email address is already registered');

        expect(mockUserModel.create).not.toHaveBeenCalled();
      });

      it('should validate password strength', async () => {
        // Arrange
        const registrationData = {
          email: 'test@example.com',
          password: 'weak',
          first_name: 'John',
          last_name: 'Doe'
        };

        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short', 'Missing special characters'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.registerUser(registrationData))
          .rejects
          .toThrow('Password validation failed');

        expect(mockUserModel.create).not.toHaveBeenCalled();
      });
    });

    describe('Profile Management', () => {
      it('should update user profile', async () => {
        // Arrange
        const userId = 'user-123';
        const updateData = {
          first_name: 'Updated',
          last_name: 'Name',
          bio: 'Updated bio'
        };
        
        const existingUser = {
          id: userId,
          email: 'user@example.com',
          first_name: 'Original',
          last_name: 'User'
        };
        
        const updatedUser = { ...existingUser, ...updateData };

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await UserService.updateProfile(userId, updateData);

        // Assert
        expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(userId, updateData);
        expect(result).toEqual(updatedUser);
      });

      it('should validate profile data', async () => {
        // Arrange
        const userId = 'user-123';
        const invalidData = {
          first_name: '', // Empty name
          bio: 'x'.repeat(1001) // Too long
        };

        // Act & Assert
        await expect(UserService.updateProfile(userId, invalidData))
          .rejects
          .toThrow();

        expect(mockUserModel.updateProfile).not.toHaveBeenCalled();
      });
    });

    describe('Password Management', () => {
      it('should change password successfully', async () => {
        // Arrange
        const userId = 'user-123';
        const currentPassword = 'CurrentPassword123!';
        const newPassword = 'NewPassword456!';
        
        const user = {
          id: userId,
          email: 'user@example.com',
          password_hash: 'current-hash'
        };

        mockUserModel.findById.mockResolvedValue(user);
        mockBcrypt.compare.mockResolvedValue(true);
        mockUserModel.changePassword.mockResolvedValue(undefined);

        // Act
        await UserService.changePassword(userId, currentPassword, newPassword);

        // Assert
        expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, user.password_hash);
        expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, expect.any(Number));
        expect(mockUserModel.changePassword).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            old_password_hash: user.password_hash,
            new_password_hash: 'hashed-password'
          })
        );
      });

      it('should reject incorrect current password', async () => {
        // Arrange
        const userId = 'user-123';
        const currentPassword = 'WrongPassword';
        const newPassword = 'NewPassword456!';
        
        const user = { id: userId, password_hash: 'hash' };

        mockUserModel.findById.mockResolvedValue(user);
        mockBcrypt.compare.mockResolvedValue(false);

        // Act & Assert
        await expect(UserService.changePassword(userId, currentPassword, newPassword))
          .rejects
          .toThrow('Current password is incorrect');

        expect(mockUserModel.changePassword).not.toHaveBeenCalled();
      });

      it('should validate new password strength', async () => {
        // Arrange
        const userId = 'user-123';
        const currentPassword = 'CurrentPassword123!';
        const weakPassword = 'weak';
        
        const user = { id: userId, password_hash: 'hash' };

        mockUserModel.findById.mockResolvedValue(user);
        mockBcrypt.compare.mockResolvedValue(true);
        mockPasswordValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Password too short'],
          score: 2
        });

        // Act & Assert
        await expect(UserService.changePassword(userId, currentPassword, weakPassword))
          .rejects
          .toThrow('New password does not meet security requirements');

        expect(mockUserModel.changePassword).not.toHaveBeenCalled();
      });
    });

    describe('User Search and Statistics', () => {
      it('should retrieve user list', async () => {
        // Arrange
        const filters = { status: 'active', page: 1, limit: 20 };
        const users = [
          { id: 'user-1', email: 'user1@example.com', status: 'active' },
          { id: 'user-2', email: 'user2@example.com', status: 'active' }
        ];
        const mockResponse = {
          data: users,
          pagination: { page: 1, limit: 20, total: 2, pages: 1 }
        };

        mockUserModel.getUsers.mockResolvedValue(mockResponse);

        // Act
        const result = await UserService.getUsers(filters);

        // Assert
        expect(mockUserModel.getUsers).toHaveBeenCalledWith(filters);
        expect(result).toEqual(mockResponse);
      });

      it('should calculate user statistics', async () => {
        // Arrange
        const mockStats = {
          total_users: 100,
          active_users: 85,
          verified_users: 90,
          users_by_status: { active: 85, inactive: 15 },
          users_by_role: { user: 90, admin: 10 }
        };

        mockUserModel.getStatistics.mockResolvedValue(mockStats);

        // Act
        const result = await UserService.getUserStatistics();

        // Assert
        expect(mockUserModel.getStatistics).toHaveBeenCalled();
        expect(result).toEqual(mockStats);
      });
    });
  });

  describe('Error Handling and Security', () => {
    let taskService: TaskService;
    
    beforeEach(() => {
      taskService = new TaskService();
    });

    describe('Input Validation', () => {
      it('should validate required parameters', async () => {
        // Arrange & Act & Assert
        await expect(taskService.createTask('', { title: 'Test' }))
          .rejects
          .toThrow();

        await expect(taskService.createTask('user-123', null as any))
          .rejects
          .toThrow();
      });

      it('should validate data types and formats', async () => {
        // Arrange
        const userId = 'user-123';
        const invalidData = {
          title: 123, // Should be string
          priority: 'invalid-priority',
          due_date: 'not-a-date'
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidData as any))
          .rejects
          .toThrow();
      });
    });

    describe('Database Error Handling', () => {
      it('should handle connection timeouts', async () => {
        // Arrange
        const timeoutError = new Error('Connection timeout');
        timeoutError.name = 'TimeoutError';
        mockTaskRepository.findWithFilters.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(taskService.searchTasks({}))
          .rejects
          .toThrow();

        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle constraint violations', async () => {
        // Arrange
        const constraintError = new Error('duplicate key violation');
        constraintError.name = 'UniqueViolationError';
        mockTaskRepository.create.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(taskService.createTask('user-123', { title: 'Test' }))
          .rejects
          .toThrow();
      });
    });

    describe('Security Tests', () => {
      it('should sanitize HTML input', async () => {
        // Arrange
        const userId = 'user-123';
        const maliciousData = {
          first_name: '<script>alert("xss")</script>',
          last_name: '"><img src=x onerror=alert(1)>',
          bio: 'Normal content'
        };
        const existingUser = { id: userId, email: 'user@example.com' };

        mockUserModel.findById.mockResolvedValue(existingUser);
        mockUserModel.updateProfile.mockResolvedValue(existingUser);

        // Act
        await UserService.updateProfile(userId, maliciousData);

        // Assert - Input should be sanitized
        expect(mockUserModel.updateProfile).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            first_name: expect.not.stringMatching(/<script>/),
            last_name: expect.not.stringMatching(/<img/)
          })
        );
      });

      it('should prevent SQL injection in search', async () => {
        // Arrange
        const maliciousSearch = "'; DROP TABLE users; --";
        const filters = { search: maliciousSearch };

        mockUserModel.getUsers.mockResolvedValue({
          data: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });

        // Act
        await UserService.getUsers(filters);

        // Assert - Should sanitize the input
        expect(mockUserModel.getUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: expect.not.stringContaining('DROP TABLE')
          })
        );
      });
    });

    describe('Performance and Scalability', () => {
      it('should handle large result sets', async () => {
        // Arrange
        const largeDataset = Array(1000).fill(0).map((_, i) => ({
          id: `task-${i}`,
          title: `Task ${i}`,
          status: 'pending'
        }));
        
        const mockResponse = {
          data: largeDataset,
          pagination: { page: 1, limit: 1000, total: 1000, pages: 1 }
        };

        mockTaskRepository.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks({}, {}, { page: 1, limit: 1000 });

        // Assert
        expect(result.data).toHaveLength(1000);
        expect(mockTaskRepository.findWithFilters).toHaveBeenCalledTimes(1);
      });

      it('should enforce pagination limits', async () => {
        // Arrange
        const extremePagination = { page: 1, limit: 50000 };

        // Act & Assert
        await expect(taskService.searchTasks({}, {}, extremePagination))
          .rejects
          .toThrow();
      });
    });
  });
});
