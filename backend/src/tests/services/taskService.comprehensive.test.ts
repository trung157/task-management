/**
 * TaskService Comprehensive Unit Tests
 * Full test suite with advanced mocking, edge cases, and performance testing
 */

import { TaskService } from '../../services/taskService';
import { taskRepository } from '../../repositories/taskRepository';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { TestDataFactory } from '../utils/testDataFactory';

// Mock all dependencies
jest.mock('../../repositories/taskRepository');
jest.mock('../../utils/logger');
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

const mockTaskRepository = taskRepository as jest.Mocked<typeof taskRepository>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('TaskService - Comprehensive Test Suite', () => {
  let taskService: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    taskService = new TaskService();
  });

  describe('Task Creation', () => {
    const userId = testUtils.generateTestId();

    describe('Successful Creation', () => {
      it('should create a basic task with required fields only', async () => {
        // Arrange
        const minimalTaskData = {
          title: 'Basic Task'
        };
        const expectedTask = TestDataFactory.createTask({
          ...minimalTaskData,
          created_by: userId,
          status: 'pending',
          priority: 'medium'
        });

        mockTaskRepository.create.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, minimalTaskData);

        // Assert
        expect(mockTaskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: minimalTaskData.title,
            created_by: userId,
            status: 'pending',
            priority: 'medium'
          })
        );
        expect(result).toEqual(expectedTask);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Task created successfully',
          expect.any(Object)
        );
      });

      it('should create a complex task with all optional fields', async () => {
        // Arrange
        const complexTaskData = {
          title: 'Complex Task',
          description: 'Detailed description with multiple paragraphs',
          priority: 'high',
          status: 'todo',
          due_date: testUtils.createTestDate(7),
          assignee_id: testUtils.generateTestId(),
          project_id: testUtils.generateTestId(),
          tags: ['urgent', 'client-work', 'development'],
          metadata: {
            category: 'development',
            client: 'ACME Corp',
            estimated_hours: 8
          }
        };
        const expectedTask = TestDataFactory.createTask({
          ...complexTaskData,
          created_by: userId
        });

        mockTaskRepository.create.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, complexTaskData);

        // Assert
        expect(mockTaskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining(complexTaskData)
        );
        expect(result).toEqual(expectedTask);
      });

      it('should apply business rules for priority assignment', async () => {
        // Arrange
        const urgentTaskData = {
          title: 'Urgent Bug Fix',
          due_date: testUtils.createTestDate(1), // Due tomorrow
          tags: ['bug', 'production']
        };
        const expectedTask = TestDataFactory.createTask({
          ...urgentTaskData,
          created_by: userId,
          priority: 'high' // Should be auto-elevated due to tags and due date
        });

        mockTaskRepository.create.mockResolvedValue(expectedTask);

        // Act
        await taskService.createTask(userId, urgentTaskData);

        // Assert
        expect(mockTaskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: expect.stringMatching(/high|urgent/)
          })
        );
      });
    });

    describe('Validation and Business Rules', () => {
      it('should enforce maximum title length', async () => {
        // Arrange
        const invalidTaskData = {
          title: 'a'.repeat(501) // Exceeds 500 character limit
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidTaskData))
          .rejects
          .toThrow(AppError);
        
        expect(mockTaskRepository.create).not.toHaveBeenCalled();
      });

      it('should enforce maximum description length', async () => {
        // Arrange
        const invalidTaskData = {
          title: 'Valid Title',
          description: 'b'.repeat(5001) // Exceeds 5000 character limit
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidTaskData))
          .rejects
          .toThrow(AppError);
      });

      it('should enforce maximum tag count', async () => {
        // Arrange
        const invalidTaskData = {
          title: 'Valid Title',
          tags: Array(21).fill('tag') // Exceeds 20 tag limit
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidTaskData))
          .rejects
          .toThrow(AppError);
      });

      it('should reject past due dates by default', async () => {
        // Arrange
        const invalidTaskData = {
          title: 'Valid Title',
          due_date: testUtils.createTestDate(-1) // Yesterday
        };

        // Act & Assert
        await expect(taskService.createTask(userId, invalidTaskData))
          .rejects
          .toThrow('Due date cannot be in the past');
      });

      it('should allow past due dates when explicitly permitted', async () => {
        // Arrange
        const taskDataWithPastDue = {
          title: 'Retroactive Task',
          due_date: testUtils.createTestDate(-1)
        };
        const options = { allowPastDueDates: true };
        const expectedTask = TestDataFactory.createTask({
          ...taskDataWithPastDue,
          created_by: userId
        });

        mockTaskRepository.create.mockResolvedValue(expectedTask);

        // Act
        const result = await taskService.createTask(userId, taskDataWithPastDue, options);

        // Assert
        expect(result).toEqual(expectedTask);
        expect(mockTaskRepository.create).toHaveBeenCalled();
      });

      it('should validate required description when specified', async () => {
        // Arrange
        const taskDataWithoutDescription = {
          title: 'Task Without Description'
        };
        const options = { requireDescription: true };

        // Act & Assert
        await expect(taskService.createTask(userId, taskDataWithoutDescription, options))
          .rejects
          .toThrow('Description is required');
      });
    });

    describe('Error Handling', () => {
      it('should handle database connection errors', async () => {
        // Arrange
        const taskData = TestDataFactory.createTaskData();
        const dbError = new Error('Connection timeout');
        mockTaskRepository.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow('Failed to create task');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to create task',
          expect.objectContaining({
            error: dbError.message,
            userId
          })
        );
      });

      it('should handle constraint violations gracefully', async () => {
        // Arrange
        const taskData = TestDataFactory.createTaskData();
        const constraintError = new Error('duplicate key value violates unique constraint');
        constraintError.name = 'UniqueViolationError';
        mockTaskRepository.create.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(taskService.createTask(userId, taskData))
          .rejects
          .toThrow('Task with this title already exists');
      });

      it('should handle invalid user ID format', async () => {
        // Arrange
        const invalidUserId = 'not-a-uuid';
        const taskData = TestDataFactory.createTaskData();

        // Act & Assert
        await expect(taskService.createTask(invalidUserId, taskData))
          .rejects
          .toThrow('Invalid user ID format');
      });
    });
  });

  describe('Task Updates', () => {
    const userId = testUtils.generateTestId();
    const taskId = testUtils.generateTestId();

    describe('Successful Updates', () => {
      it('should update basic task fields', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          title: 'Original Title',
          status: 'todo'
        });
        const updateData = {
          title: 'Updated Title',
          description: 'Updated description'
        };
        const updatedTask = { ...existingTask, ...updateData };

        mockTaskRepository.findById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, updateData, userId);

        // Assert
        expect(mockTaskRepository.findById).toHaveBeenCalledWith(taskId);
        expect(mockTaskRepository.update).toHaveBeenCalledWith(taskId, updateData);
        expect(result).toEqual(updatedTask);
      });

      it('should handle status transitions correctly', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          status: 'todo'
        });
        const statusUpdate = { status: 'in_progress' };
        const updatedTask = { ...existingTask, ...statusUpdate };

        mockTaskRepository.findById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, statusUpdate, userId);

        // Assert
        expect(result.status).toBe('in_progress');
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Task status changed'),
          expect.any(Object)
        );
      });

      it('should update priority and recalculate metrics', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          priority: 'low'
        });
        const priorityUpdate = { priority: 'urgent' };
        const updatedTask = { ...existingTask, ...priorityUpdate };

        mockTaskRepository.findById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockResolvedValue(updatedTask);

        // Act
        const result = await taskService.updateTask(taskId, priorityUpdate, userId);

        // Assert
        expect(result.priority).toBe('urgent');
        expect(result.computed?.priorityMetrics?.priorityWeight).toBeGreaterThan(0);
      });
    });

    describe('Validation and Business Rules', () => {
      it('should reject invalid status transitions', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          status: 'completed'
        });
        const invalidUpdate = { status: 'todo' }; // Can't go back from completed

        mockTaskRepository.findById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, invalidUpdate, userId))
          .rejects
          .toThrow('Invalid status transition');

        expect(mockTaskRepository.update).not.toHaveBeenCalled();
      });

      it('should handle concurrent updates with optimistic locking', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: userId,
          updated_at: new Date('2024-01-01T12:00:00Z')
        });
        const updateData = {
          title: 'Updated Title',
          expected_version: new Date('2023-12-31T12:00:00Z') // Outdated version
        };

        mockTaskRepository.findById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, updateData, userId))
          .rejects
          .toThrow('Task has been modified by another user');
      });

      it('should validate ownership for non-admin users', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({
          id: taskId,
          created_by: 'other-user-id'
        });
        const updateData = { title: 'Unauthorized Update' };

        mockTaskRepository.findById.mockResolvedValue(existingTask);

        // Act & Assert
        await expect(taskService.updateTask(taskId, updateData, userId))
          .rejects
          .toThrow('Insufficient permissions');
      });
    });

    describe('Error Conditions', () => {
      it('should handle task not found', async () => {
        // Arrange
        const updateData = { title: 'Updated Title' };
        mockTaskRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.updateTask(taskId, updateData, userId))
          .rejects
          .toThrow('Task not found');

        expect(mockTaskRepository.update).not.toHaveBeenCalled();
      });

      it('should handle database update failures', async () => {
        // Arrange
        const existingTask = TestDataFactory.createTask({ id: taskId, created_by: userId });
        const updateData = { title: 'Updated Title' };
        const dbError = new Error('Database update failed');

        mockTaskRepository.findById.mockResolvedValue(existingTask);
        mockTaskRepository.update.mockRejectedValue(dbError);

        // Act & Assert
        await expect(taskService.updateTask(taskId, updateData, userId))
          .rejects
          .toThrow('Failed to update task');
      });
    });
  });

  describe('Task Retrieval', () => {
    const userId = testUtils.generateTestId();

    describe('Single Task Retrieval', () => {
      it('should retrieve task by ID with computed fields', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        const task = TestDataFactory.createTask({
          id: taskId,
          due_date: testUtils.createTestDate(3),
          priority: 'high'
        });

        mockTaskRepository.findByIdWithRelations.mockResolvedValue(task);

        // Act
        const result = await taskService.getTaskById(taskId, userId);

        // Assert
        expect(mockTaskRepository.findByIdWithRelations).toHaveBeenCalledWith(taskId);
        expect(result).toHaveProperty('computed');
        expect(result.computed).toHaveProperty('isOverdue');
        expect(result.computed).toHaveProperty('priorityMetrics');
        expect(result.computed).toHaveProperty('dueDateAnalysis');
      });

      it('should handle task not found', async () => {
        // Arrange
        const taskId = testUtils.generateTestId();
        mockTaskRepository.findByIdWithRelations.mockResolvedValue(null);

        // Act & Assert
        await expect(taskService.getTaskById(taskId, userId))
          .rejects
          .toThrow('Task not found');
      });

      it('should validate UUID format', async () => {
        // Arrange
        const invalidId = 'not-a-uuid';

        // Act & Assert
        await expect(taskService.getTaskById(invalidId, userId))
          .rejects
          .toThrow('Invalid task ID format');
      });
    });

    describe('Task Search and Filtering', () => {
      it('should search tasks with multiple filters', async () => {
        // Arrange
        const filters = {
          status: ['todo', 'in_progress'],
          priority: 'high',
          assignee_id: userId,
          due_date_from: testUtils.createTestDate(-7),
          due_date_to: testUtils.createTestDate(7),
          tags: ['urgent'],
          search: 'bug fix'
        };
        const sortOptions = { sort_by: 'due_date', sort_order: 'asc' };
        const pagination = { page: 1, limit: 20 };

        const mockTasks = TestDataFactory.createTasks(5);
        const mockResponse = TestDataFactory.createMockPaginationResponse(mockTasks);

        mockTaskRepository.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        const result = await taskService.searchTasks(filters, sortOptions, pagination, userId);

        // Assert
        expect(mockTaskRepository.findWithFilters).toHaveBeenCalledWith(
          filters,
          sortOptions,
          pagination
        );
        expect(result).toEqual(mockResponse);
      });

      it('should apply default pagination when not provided', async () => {
        // Arrange
        const filters = { status: 'todo' };
        const mockResponse = TestDataFactory.createMockPaginationResponse([]);

        mockTaskRepository.findWithFilters.mockResolvedValue(mockResponse);

        // Act
        await taskService.searchTasks(filters, {}, undefined, userId);

        // Assert
        expect(mockTaskRepository.findWithFilters).toHaveBeenCalledWith(
          filters,
          {},
          { page: 1, limit: 20 }
        );
      });

      it('should validate pagination limits', async () => {
        // Arrange
        const filters = {};
        const invalidPagination = { page: 0, limit: 1001 };

        // Act & Assert
        await expect(taskService.searchTasks(filters, {}, invalidPagination, userId))
          .rejects
          .toThrow('Invalid pagination parameters');
      });
    });

    describe('Task Statistics', () => {
      it('should calculate comprehensive task statistics', async () => {
        // Arrange
        const mockStats = {
          total: 50,
          by_status: {
            todo: 15,
            in_progress: 20,
            completed: 15
          },
          by_priority: {
            low: 10,
            medium: 25,
            high: 12,
            urgent: 3
          },
          overdue: 8,
          due_today: 3,
          due_this_week: 12,
          completion_rate: 0.3,
          average_completion_time: 72 // hours
        };

        mockTaskRepository.getTaskStats.mockResolvedValue(mockStats);

        // Act
        const result = await taskService.getTaskStats(userId);

        // Assert
        expect(result).toEqual(mockStats);
        expect(result.total).toBe(50);
        expect(result.completion_rate).toBeWithinRange(0, 1);
      });

      it('should handle empty statistics gracefully', async () => {
        // Arrange
        const emptyStats = {
          total: 0,
          by_status: {},
          by_priority: {},
          overdue: 0,
          due_today: 0,
          due_this_week: 0,
          completion_rate: 0,
          average_completion_time: 0
        };

        mockTaskRepository.getTaskStats.mockResolvedValue(emptyStats);

        // Act
        const result = await taskService.getTaskStats(userId);

        // Assert
        expect(result.total).toBe(0);
        expect(result.completion_rate).toBe(0);
      });
    });
  });

  describe('Bulk Operations', () => {
    const userId = testUtils.generateTestId();

    describe('Bulk Updates', () => {
      it('should perform bulk status update successfully', async () => {
        // Arrange
        const taskIds = Array(5).fill(0).map(() => testUtils.generateTestId());
        const updateData = { status: 'completed' };
        const mockResult = {
          updated: 5,
          failed: 0,
          updated_tasks: taskIds,
          failed_tasks: []
        };

        mockTaskRepository.bulkUpdate.mockResolvedValue(mockResult);

        // Act
        const result = await taskService.bulkUpdateTasks(taskIds, updateData, userId);

        // Assert
        expect(mockTaskRepository.bulkUpdate).toHaveBeenCalledWith(taskIds, updateData);
        expect(result.updated).toBe(5);
        expect(result.failed).toBe(0);
      });

      it('should handle partial failures in bulk operations', async () => {
        // Arrange
        const taskIds = Array(3).fill(0).map(() => testUtils.generateTestId());
        const updateData = { priority: 'high' };
        const mockResult = {
          updated: 2,
          failed: 1,
          updated_tasks: [taskIds[0], taskIds[1]],
          failed_tasks: [{ id: taskIds[2], error: 'Permission denied' }]
        };

        mockTaskRepository.bulkUpdate.mockResolvedValue(mockResult);

        // Act
        const result = await taskService.bulkUpdateTasks(taskIds, updateData, userId);

        // Assert
        expect(result.failed).toBe(1);
        expect(result.failed_tasks).toHaveLength(1);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should enforce bulk operation limits', async () => {
        // Arrange
        const tooManyIds = Array(101).fill(0).map(() => testUtils.generateTestId());
        const updateData = { status: 'archived' };

        // Act & Assert
        await expect(taskService.bulkUpdateTasks(tooManyIds, updateData, userId))
          .rejects
          .toThrow('Cannot update more than 100 tasks at once');
      });
    });

    describe('Bulk Deletion', () => {
      it('should perform bulk deletion with confirmation', async () => {
        // Arrange
        const taskIds = Array(3).fill(0).map(() => testUtils.generateTestId());
        const options = { force: true, confirm: true };
        const mockResult = {
          deleted: 3,
          failed: 0,
          deleted_tasks: taskIds,
          failed_tasks: []
        };

        mockTaskRepository.bulkDelete.mockResolvedValue(mockResult);

        // Act
        const result = await taskService.bulkDeleteTasks(taskIds, userId, options);

        // Assert
        expect(mockTaskRepository.bulkDelete).toHaveBeenCalledWith(taskIds);
        expect(result.deleted).toBe(3);
      });

      it('should require confirmation for bulk deletion', async () => {
        // Arrange
        const taskIds = Array(3).fill(0).map(() => testUtils.generateTestId());
        const options = { confirm: false };

        // Act & Assert
        await expect(taskService.bulkDeleteTasks(taskIds, userId, options))
          .rejects
          .toThrow('Bulk deletion requires explicit confirmation');
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    const userId = testUtils.generateTestId();

    it('should handle large result sets efficiently', async () => {
      // Arrange
      const largePagination = { page: 1, limit: 1000 };
      const largeDataset = TestDataFactory.createTasks(1000);
      const mockResponse = TestDataFactory.createMockPaginationResponse(largeDataset);

      mockTaskRepository.findWithFilters.mockResolvedValue(mockResponse);

      // Act
      const result = await taskService.searchTasks({}, {}, largePagination, userId);

      // Assert
      expect(result.data).toHaveLength(1000);
      expect(mockTaskRepository.findWithFilters).toHaveBeenCalledTimes(1);
    });

    it('should handle database timeouts gracefully', async () => {
      // Arrange
      const timeoutError = new Error('Query timeout');
      timeoutError.name = 'TimeoutError';
      mockTaskRepository.findWithFilters.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(taskService.searchTasks({}, {}, {}, userId))
        .rejects
        .toThrow('Request timeout - please try again');
    });

    it('should handle memory constraints for large operations', async () => {
      // Arrange
      const massiveUpdateData = {
        description: 'x'.repeat(10000), // Large description
        metadata: { large_data: 'y'.repeat(50000) }
      };

      // Act & Assert
      await expect(taskService.createTask(userId, massiveUpdateData))
        .rejects
        .toThrow('Request payload too large');
    });

    it('should implement circuit breaker for repeated failures', async () => {
      // Arrange
      const dbError = new Error('Database unavailable');
      mockTaskRepository.create.mockRejectedValue(dbError);

      // Act - Simulate multiple failures
      const promises = Array(10).fill(0).map(() => 
        taskService.createTask(userId, { title: 'Test' }).catch(() => {})
      );
      await Promise.all(promises);

      // Assert - Circuit breaker should be triggered
      await expect(taskService.createTask(userId, { title: 'Test' }))
        .rejects
        .toThrow('Service temporarily unavailable');
    });
  });
});
