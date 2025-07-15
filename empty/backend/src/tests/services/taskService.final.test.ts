/**
 * TaskService Unit Tests - Comprehensive Edition
 * Properly typed test suite with working mocks and edge case coverage
 */

import { TaskService } from '../../services/taskService';
import { taskRepository } from '../../repositories/taskRepository';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { TestDataFactory } from '../utils/testDataFactory';
import type { 
  TaskWithRelations, 
  CreateTaskData, 
  UpdateTaskData, 
  TaskSearchFilters, 
  TaskSortOptions,
  TaskStats,
  TaskPriority,
  TaskStatus 
} from '../../repositories/taskRepository';

// Create mocked versions of dependencies
const mockTaskRepository = {
  createTask: jest.fn(),
  findTaskById: jest.fn(),
  findByIdWithRelations: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getTaskStats: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockNotificationHooks = {
  executeCreateHooks: jest.fn().mockResolvedValue(undefined),
  executeUpdateHooks: jest.fn().mockResolvedValue(undefined),
  executeDeleteHooks: jest.fn().mockResolvedValue(undefined),
  executeStatusChangeHooks: jest.fn().mockResolvedValue(undefined)
};

const mockNotificationService = {
  scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
  cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
  sendTaskNotification: jest.fn().mockResolvedValue(undefined)
};

// Mock modules
jest.mock('../../repositories/taskRepository', () => ({
  taskRepository: mockTaskRepository
}));

jest.mock('../../utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('../../hooks/taskNotificationHooks', () => ({
  TaskNotificationHooks: {
    getInstance: jest.fn().mockReturnValue(mockNotificationHooks)
  }
}));

jest.mock('../../services/advancedTaskNotificationService', () => ({
  AdvancedTaskNotificationService: {
    getInstance: jest.fn().mockReturnValue(mockNotificationService)
  }
}));

describe('TaskService - Comprehensive Unit Tests', () => {
  let taskService: TaskService;
  let userId: string;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementations
    Object.values(mockTaskRepository).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockReset();
      }
    });
    
    taskService = new TaskService();
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  });

  describe('Task Creation', () => {
    describe('Successful Creation', () => {
      it('should create a basic task with required fields only', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: 'Test Task',
          description: 'Test description'
        };

        const expectedTask: TaskWithRelations = {
          id: `task-${Date.now()}`,
          title: taskData.title,
          description: taskData.description,
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.createTask.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, taskData);

        // Assert
        expect(result).toEqual(expectedTask);
        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            title: taskData.title,
            description: taskData.description
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Task created successfully',
          expect.objectContaining({
            taskId: expectedTask.id,
            userId,
            title: expectedTask.title
          })
        );
      });

      it('should create a task with all optional fields', async () => {
        // Arrange
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        const taskData: CreateTaskData = {
          title: 'Complex Task',
          description: 'Detailed description',
          priority: 'high' as TaskPriority,
          status: 'in_progress' as TaskStatus,
          due_date: futureDate,
          category_id: `category-${Date.now()}`,
          tags: ['urgent', 'client-work'],
          metadata: {
            category: 'development',
            client: 'Acme Corp',
            estimated_hours: 8
          }
        };

        const expectedTask: TaskWithRelations = {
          id: `task-${Date.now()}`,
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority!,
          status: taskData.status!,
          due_date: futureDate,
          category_id: taskData.category_id,
          tags: taskData.tags!,
          metadata: taskData.metadata!,
          user_id: userId,
          sort_order: 1,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.createTask.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, taskData);

        // Assert
        expect(result).toEqual(expectedTask);
        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
          userId,
          expect.objectContaining(taskData)
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject task with empty title', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: '',
          description: 'Valid description'
        };

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject task with title too long', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: 'a'.repeat(501), // Exceeds max length
          description: 'Valid description'
        };

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject task with past due date by default', async () => {
        // Arrange
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const taskData: CreateTaskData = {
          title: 'Test Task',
          due_date: pastDate
        };

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow(AppError);
      });

      it('should handle repository errors during creation', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: 'Test Task'
        };

        mockTaskRepository.createTask.mockRejectedValue(
          new Error('Database connection failed')
        );

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error creating task',
          expect.objectContaining({
            userId,
            taskData
          })
        );
      });
    });
  });

  describe('Task Retrieval', () => {
    describe('Get Task by ID', () => {
      it('should return task when found', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        const expectedTask: TaskWithRelations = {
          id: taskId,
          title: 'Test Task',
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.findByIdWithRelations.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(result).toEqual(expectedTask);
        expect(mockTaskRepository.findByIdWithRelations).toHaveBeenCalledWith(
          taskId,
          userId
        );
      });

      it('should return null when task not found', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        mockTaskRepository.findByIdWithRelations.mockResolvedValue(null);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle repository errors', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        mockTaskRepository.findByIdWithRelations.mockRejectedValue(
          new Error('Database error')
        );

        // Act & Assert
        await expect(taskService.getTaskById(taskId, userId))
          .rejects
          .toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error getting task',
          expect.objectContaining({
            taskId,
            userId
          })
        );
      });
    });
  });

  describe('Task Updates', () => {
    describe('Successful Updates', () => {
      it('should update task title and description', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        const updateData: UpdateTaskData = {
          title: 'Updated Title',
          description: 'Updated description'
        };

        const existingTask: TaskWithRelations = {
          id: taskId,
          title: 'Original Title',
          description: 'Original description',
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        const updatedTask: TaskWithRelations = {
          id: taskId,
          title: updateData.title!,
          description: updateData.description!,
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, userId, updateData);

        // Assert
        expect(result).toEqual(updatedTask);
        expect(mockTaskRepository.update).toHaveBeenCalledWith(
          taskId,
          userId,
          expect.objectContaining(updateData)
        );
      });

      it('should update task status', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        const statusUpdate: UpdateTaskData = {
          status: 'in_progress' as TaskStatus
        };

        const existingTask: TaskWithRelations = {
          id: taskId,
          title: 'Test Task',
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        const updatedTask: TaskWithRelations = {
          ...existingTask,
          status: 'in_progress' as TaskStatus,
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, userId, statusUpdate);

        // Assert
        expect(result).toEqual(updatedTask);
        expect(result!.status).toBe('in_progress');
      });
    });

    describe('Validation Errors', () => {
      it('should reject updates to non-existent tasks', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        const updateData: UpdateTaskData = {
          title: 'Updated Title'
        };

        mockTaskRepository.findTaskById.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.updateTask(taskId, userId, updateData))
          .rejects
          .toThrow(AppError);
      });

      it('should handle repository update failures', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        const updateData: UpdateTaskData = {
          title: 'Updated Title'
        };

        const existingTask: TaskWithRelations = {
          id: taskId,
          title: 'Original Title',
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.updateTask(taskId, userId, updateData))
          .rejects
          .toThrow(AppError);
      });
    });
  });

  describe('Task Deletion', () => {
    describe('Successful Deletion', () => {
      it('should delete task when validation passes', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        
        const existingTask: TaskWithRelations = {
          id: taskId,
          title: 'Test Task',
          status: 'pending' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
        mockTaskRepository.delete.mockResolvedValue(true);

        // Act
        const result = await taskService.deleteTask(taskId, userId);

        // Assert
        expect(result).toBe(true);
        expect(mockTaskRepository.delete).toHaveBeenCalledWith(taskId, userId);
      });

      it('should force delete when specified', async () => {
        // Arrange
        const taskId = `task-${Date.now()}`;
        mockTaskRepository.delete.mockResolvedValue(true);

        // Act
        const result = await taskService.deleteTask(taskId, userId, true);

        // Assert
        expect(result).toBe(true);
        expect(mockTaskRepository.delete).toHaveBeenCalledWith(taskId, userId);
      });
    });
  });

  describe('Task Search', () => {
    describe('Successful Search', () => {
      it('should search tasks with filters and sorting', async () => {
        // Arrange
        const filters: TaskSearchFilters = {
          status: ['pending', 'in_progress'],
          priority: ['high', 'medium'],
          search: 'important'
        };

        const sortOptions: TaskSortOptions = {
          sortBy: 'due_date',
          sortOrder: 'ASC'
        };

        const mockTasks: TaskWithRelations[] = [
          {
            id: `task-${Date.now()}`,
            title: 'Important Task 1',
            status: 'pending' as TaskStatus,
            priority: 'high' as TaskPriority,
            user_id: userId,
            sort_order: 1,
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        const mockResponse = {
          data: mockTasks,
          total: 1,
          page: 1,
          pageSize: 50,
          hasMore: false
        };

        mockTaskRepository.findMany.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks(userId, filters, sortOptions);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(mockTaskRepository.findMany).toHaveBeenCalledWith(
          userId,
          filters,
          sortOptions
        );
      });

      it('should use default values for empty filters and options', async () => {
        // Arrange
        const mockResponse = {
          data: [],
          total: 0,
          page: 1,
          pageSize: 50,
          hasMore: false
        };

        mockTaskRepository.findMany.mockResolvedValue(mockResponse);

        // Act
        await taskService.searchTasks(userId);

        // Assert
        expect(mockTaskRepository.findMany).toHaveBeenCalledWith(
          userId,
          {},
          {}
        );
      });
    });
  });

  describe('Task Statistics', () => {
    describe('Successful Statistics Retrieval', () => {
      it('should get task statistics for user', async () => {
        // Arrange
        const mockStats: TaskStats = {
          total_tasks: 50,
          completed_tasks: 30,
          pending_tasks: 15,
          in_progress_tasks: 5,
          archived_tasks: 0,
          overdue_tasks: 3,
          completion_rate: 0.6,
          avg_completion_time_hours: 24,
          tasks_by_priority: {
            high: 10,
            medium: 25,
            low: 15,
            none: 0
          },
          tasks_by_category: [
            {
              category_id: 'dev',
              category_name: 'Development',
              task_count: 20
            }
          ],
          tasks_by_status: {
            pending: 15,
            in_progress: 5,
            completed: 30,
            archived: 0
          },
          upcoming_due: 7
        };

        mockTaskRepository.getTaskStats.mockResolvedValue(mockStats);

        // Act
        const result = await taskService.getTaskStats(userId);

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total_tasks).toBe(50);
        expect(result.completion_rate).toBe(0.6);
        expect(mockTaskRepository.getTaskStats).toHaveBeenCalledWith(userId);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const taskData: CreateTaskData = {
        title: 'Test Task'
      };

      mockTaskRepository.createTask.mockRejectedValue(
        new Error('Unexpected database error')
      );

      // Act & Assert
      await expect(taskService.createTask(userId, taskData))
        .rejects
        .toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should preserve AppError instances', async () => {
      // Arrange
      const taskData: CreateTaskData = {
        title: 'Test Task'
      };

      const appError = new AppError('Custom business rule violation', 400);
      mockTaskRepository.createTask.mockRejectedValue(appError);

      // Act & Assert
      await expect(taskService.createTask(userId, taskData))
        .rejects
        .toThrow(AppError);
    });
  });
});
