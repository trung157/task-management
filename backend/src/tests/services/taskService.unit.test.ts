/**
 * TaskService Unit Tests
 * Comprehensive test suite with proper mocking, edge cases, and type safety
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

// Mock all dependencies
jest.mock('../../repositories/taskRepository');
jest.mock('../../utils/logger');
jest.mock('../../hooks/taskNotificationHooks', () => ({
  TaskNotificationHooks: {
    getInstance: jest.fn().mockReturnValue({
      executeCreateHooks: jest.fn().mockResolvedValue(undefined),
      executeUpdateHooks: jest.fn().mockResolvedValue(undefined),
      executeDeleteHooks: jest.fn().mockResolvedValue(undefined),
      executeStatusChangeHooks: jest.fn().mockResolvedValue(undefined)
    })
  }
}));
jest.mock('../../services/advancedTaskNotificationService', () => ({
  AdvancedTaskNotificationService: {
    getInstance: jest.fn().mockReturnValue({
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
      sendTaskNotification: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

const mockTaskRepository = taskRepository as jest.Mocked<typeof taskRepository>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('TaskService - Unit Tests', () => {
  let taskService: TaskService;
  let userId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    taskService = new TaskService();
    userId = testUtils.generateTestId();
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
          id: testUtils.generateTestId(),
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
        const taskData: CreateTaskData = {
          title: 'Complex Task',
          description: 'Detailed description',
          priority: 'high' as TaskPriority,
          status: 'in_progress' as TaskStatus,
          due_date: testUtils.createTestDate(7),
          assignee_id: testUtils.generateTestId(),
          project_id: testUtils.generateTestId(),
          tags: ['urgent', 'client-work'],
          metadata: {
            category: 'development',
            client: 'Acme Corp',
            estimated_hours: 8
          }
        };

        const expectedTask: TaskWithRelations = {
          id: testUtils.generateTestId(),
          ...taskData,
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

      it('should apply business rules during creation', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: 'High Priority Task',
          priority: 'high' as TaskPriority,
          due_date: testUtils.createTestDate(1) // Due tomorrow
        };

        const expectedTask: TaskWithRelations = {
          id: testUtils.generateTestId(),
          title: taskData.title,
          priority: taskData.priority,
          due_date: taskData.due_date,
          status: 'pending' as TaskStatus,
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
            priority: 'high'
          })
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
        const taskData: CreateTaskData = {
          title: 'Test Task',
          due_date: testUtils.createTestDate(-1) // Yesterday
        };

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow(AppError);
      });

      it('should allow past due date when explicitly permitted', async () => {
        // Arrange
        const taskData: CreateTaskData = {
          title: 'Historical Task',
          due_date: testUtils.createTestDate(-1)
        };

        const expectedTask: TaskWithRelations = {
          id: testUtils.generateTestId(),
          title: taskData.title,
          due_date: taskData.due_date,
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
        const result = await taskService.createTask(
          userId, 
          taskData, 
          { allowPastDueDates: true }
        );

        // Assert
        expect(result).toEqual(expectedTask);
      });

      it('should reject invalid user ID', async () => {
        // Arrange
        const invalidUserId = '';
        const taskData: CreateTaskData = {
          title: 'Test Task'
        };

        // Act & Assert
        await expect(taskService.createTask(invalidUserId, taskData))
          .rejects
          .toThrow(AppError);
      });
    });

    describe('Repository Errors', () => {
      it('should handle repository failures gracefully', async () => {
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
        const taskId = testUtils.generateTestId();
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
        const taskId = testUtils.generateTestId();
        mockTaskRepository.findByIdWithRelations.mockResolvedValue(null);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle repository errors', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
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
        const taskId = testUtils.generateTestId();
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
          ...existingTask,
          ...updateData,
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
        const taskId = testUtils.generateTestId();
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

      it('should update task priority', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        const priorityUpdate: UpdateTaskData = {
          priority: 'high' as TaskPriority
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
          priority: 'high' as TaskPriority,
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, userId, priorityUpdate);

        // Assert
        expect(result).toEqual(updatedTask);
        expect(result!.priority).toBe('high');
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid status transitions', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        const invalidUpdate: UpdateTaskData = {
          status: 'pending' as TaskStatus // Invalid from completed
        };

        const existingTask: TaskWithRelations = {
          id: taskId,
          title: 'Test Task',
          status: 'completed' as TaskStatus,
          priority: 'medium' as TaskPriority,
          user_id: userId,
          sort_order: 1,
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTaskRepository.findTaskById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, userId, invalidUpdate))
          .rejects
          .toThrow(AppError);
      });

      it('should reject updates to non-existent tasks', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
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
        const taskId = testUtils.generateTestId();
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
        const taskId = testUtils.generateTestId();
        
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
        const taskId = testUtils.generateTestId();
        mockTaskRepository.delete.mockResolvedValue(true);

        // Act
        const result = await taskService.deleteTask(taskId, userId, true);

        // Assert
        expect(result).toBe(true);
        expect(mockTaskRepository.delete).toHaveBeenCalledWith(taskId, userId);
      });
    });

    describe('Validation Errors', () => {
      it('should reject deletion of non-existent task', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        mockTaskRepository.findTaskById.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.deleteTask(taskId, userId))
          .rejects
          .toThrow(AppError);
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
          search: 'important',
          due_date_from: testUtils.createTestDate(-7),
          due_date_to: testUtils.createTestDate(7)
        };

        const sortOptions: TaskSortOptions = {
          field: 'due_date',
          direction: 'asc'
        };

        const mockTasks: TaskWithRelations[] = [
          {
            id: testUtils.generateTestId(),
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
        const result = await taskService.getTaskStatistics(userId);

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
