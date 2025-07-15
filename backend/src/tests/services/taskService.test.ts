import { 
  mockTaskModel, 
  mockUserModel,
  mockLogger, 
  MockAppError, 
  createTestTask,
  createTestUser,
  resetAllMocks 
} from '../mocks';

// Mock dependencies first - these need to be before imports
jest.mock('../../models/task', () => ({
  TaskModel: require('../mocks').mockTaskModel
}));

jest.mock('../../models/user', () => ({
  UserModel: require('../mocks').mockUserModel
}));

jest.mock('../../utils/logger', () => ({
  logger: require('../mocks').mockLogger
}));

jest.mock('../../middleware/errorHandler', () => ({
  AppError: require('../mocks').MockAppError
}));

// Mock the database pool
jest.mock('../../db', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

// Import after mocks
import { TaskService } from '../../services/taskService';

describe('TaskService', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('createTask', () => {
    const userId = 'user-123';
    const taskData = {
      title: 'New Task',
      description: 'Task description',
      priority: 'high' as const,
      status: 'pending' as const,
      due_date: new Date('2024-12-31'),
      category_id: 'cat-123',
      tags: ['urgent', 'important']
    };

    it('should successfully create a new task', async () => {
      // Arrange
      const mockUser = createTestUser({ id: userId });
      const mockTask = createTestTask({ 
        ...taskData,
        user_id: userId,
        created_by: userId
      });

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockTaskModel.create.mockResolvedValue(mockTask);

      // Act
      const result = await TaskService.createTask(userId, taskData);

      // Assert
      expect(result).toEqual(mockTask);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockTaskModel.create).toHaveBeenCalledWith(userId, taskData);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task created successfully',
        { userId, taskId: mockTask.id, title: taskData.title }
      );
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(TaskService.createTask(userId, taskData))
        .rejects.toThrow('User not found');
      
      expect(mockTaskModel.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during task creation', async () => {
      // Arrange
      const mockUser = createTestUser({ id: userId });
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockTaskModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.createTask(userId, taskData))
        .rejects.toThrow('Failed to create task');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating task', 
        expect.objectContaining({
          userId,
          taskData,
          error: expect.any(Error)
        })
      );
    });

    it('should set default values for optional fields', async () => {
      // Arrange
      const minimalTaskData = {
        title: 'Minimal Task'
      };
      const mockUser = createTestUser({ id: userId });
      const mockTask = createTestTask({ 
        title: minimalTaskData.title,
        user_id: userId,
        created_by: userId,
        priority: 'none',
        status: 'pending'
      });

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockTaskModel.create.mockResolvedValue(mockTask);

      // Act
      const result = await TaskService.createTask(userId, minimalTaskData);

      // Assert
      expect(mockTaskModel.create).toHaveBeenCalledWith(userId, minimalTaskData);
    });
  });

  describe('getTaskById', () => {
    const userId = 'user-123';
    const taskId = 'task-456';

    it('should successfully retrieve task by ID', async () => {
      // Arrange
      const mockTask = createTestTask({ id: taskId, user_id: userId });
      mockTaskModel.findById.mockResolvedValue(mockTask);

      // Act
      const result = await TaskService.getTaskById(taskId, userId);

      // Assert
      expect(result).toEqual(mockTask);
      expect(mockTaskModel.findById).toHaveBeenCalledWith(taskId, userId);
    });

    it('should throw error when task not found', async () => {
      // Arrange
      mockTaskModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(TaskService.getTaskById(taskId, userId))
        .rejects.toThrow('Task not found');
    });

    it('should throw error when user tries to access task they do not own', async () => {
      // Arrange - TaskModel.findById should return null for unauthorized access
      mockTaskModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(TaskService.getTaskById(taskId, userId))
        .rejects.toThrow('Task not found');
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.getTaskById(taskId, userId))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('updateTask', () => {
    const userId = 'user-123';
    const taskId = 'task-456';
    const updateData = {
      title: 'Updated Task',
      description: 'Updated description',
      priority: 'medium' as const,
      status: 'in_progress' as const
    };

    it('should successfully update task', async () => {
      // Arrange
      const existingTask = createTestTask({ id: taskId, user_id: userId });
      const updatedTask = createTestTask({ 
        ...existingTask,
        ...updateData,
        updated_at: new Date()
      });

      mockTaskModel.findById.mockResolvedValue(existingTask);
      mockTaskModel.update.mockResolvedValue(updatedTask);

      // Act
      const result = await TaskService.updateTask(taskId, userId, updateData);

      // Assert
      expect(result).toEqual(updatedTask);
      expect(mockTaskModel.findById).toHaveBeenCalledWith(taskId);
      expect(mockTaskModel.update).toHaveBeenCalledWith(taskId, updateData);
      expect(mockLogger.info).toHaveBeenCalledWith('Task updated successfully', {
        userId,
        taskId,
        updatedFields: Object.keys(updateData)
      });
    });

    it('should throw error when task not found', async () => {
      // Arrange
      mockTaskModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(TaskService.updateTask(taskId, userId, updateData))
        .rejects.toThrow('Task not found');
      
      expect(mockTaskModel.update).not.toHaveBeenCalled();
    });

    it('should throw error when user tries to update task they do not own', async () => {
      // Arrange
      const otherUserId = 'other-user-789';
      const existingTask = createTestTask({ id: taskId, user_id: otherUserId });
      mockTaskModel.findById.mockResolvedValue(existingTask);

      // Act & Assert
      await expect(TaskService.updateTask(taskId, userId, updateData))
        .rejects.toThrow('Unauthorized access to task');
      
      expect(mockTaskModel.update).not.toHaveBeenCalled();
    });

    it('should automatically set completion timestamp when status changed to completed', async () => {
      // Arrange
      const existingTask = createTestTask({ id: taskId, user_id: userId, status: 'in_progress' });
      const completionUpdate = { status: 'completed' as const };
      const completedTask = createTestTask({ 
        ...existingTask,
        status: 'completed',
        completed_at: new Date(),
        completed_by: userId
      });

      mockTaskModel.findById.mockResolvedValue(existingTask);
      mockTaskModel.update.mockResolvedValue(completedTask);

      // Act
      const result = await TaskService.updateTask(taskId, userId, completionUpdate);

      // Assert
      expect(mockTaskModel.update).toHaveBeenCalledWith(taskId, 
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(Date),
          completed_by: userId
        })
      );
    });
  });

  describe('deleteTask', () => {
    const userId = 'user-123';
    const taskId = 'task-456';

    it('should successfully delete task (soft delete)', async () => {
      // Arrange
      const existingTask = createTestTask({ id: taskId, user_id: userId });
      mockTaskModel.findById.mockResolvedValue(existingTask);
      mockTaskModel.update.mockResolvedValue({ ...existingTask, status: 'archived' });

      // Act
      await TaskService.deleteTask(taskId, userId);

      // Assert
      expect(mockTaskModel.findById).toHaveBeenCalledWith(taskId);
      expect(mockTaskModel.update).toHaveBeenCalledWith(taskId, 
        expect.objectContaining({
          status: 'archived',
          archived_at: expect.any(Date),
          archived_by: userId
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Task deleted successfully', {
        userId,
        taskId
      });
    });

    it('should throw error when task not found', async () => {
      // Arrange
      mockTaskModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(TaskService.deleteTask(taskId, userId))
        .rejects.toThrow('Task not found');
      
      expect(mockTaskModel.update).not.toHaveBeenCalled();
    });

    it('should throw error when user tries to delete task they do not own', async () => {
      // Arrange
      const otherUserId = 'other-user-789';
      const existingTask = createTestTask({ id: taskId, user_id: otherUserId });
      mockTaskModel.findById.mockResolvedValue(existingTask);

      // Act & Assert
      await expect(TaskService.deleteTask(taskId, userId))
        .rejects.toThrow('Unauthorized access to task');
      
      expect(mockTaskModel.update).not.toHaveBeenCalled();
    });

    it('should handle database errors during deletion', async () => {
      // Arrange
      const existingTask = createTestTask({ id: taskId, user_id: userId });
      mockTaskModel.findById.mockResolvedValue(existingTask);
      mockTaskModel.update.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.deleteTask(taskId, userId))
        .rejects.toThrow('Failed to delete task');
    });
  });

  describe('getUserTasks', () => {
    const userId = 'user-123';
    const filterOptions = {
      status: ['pending', 'in_progress'],
      priority: 'high',
      category_id: 'cat-123',
      search: 'important',
      limit: 10,
      offset: 0,
      sortBy: 'due_date',
      sortOrder: 'asc' as const
    };

    it('should successfully retrieve tasks with filters', async () => {
      // Arrange
      const mockTasks = [
        createTestTask({ id: 'task-1', user_id: userId, title: 'Important Task 1' }),
        createTestTask({ id: 'task-2', user_id: userId, title: 'Important Task 2' })
      ];
      const mockResult = {
        tasks: mockTasks,
        total: 2,
        hasMore: false
      };

      mockTaskModel.findByFilters.mockResolvedValue(mockResult);

      // Act
      const result = await TaskService.getUserTasks(userId, filterOptions);

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockTaskModel.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: userId }),
        filterOptions
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Tasks retrieved successfully', {
        userId,
        count: mockTasks.length,
        filters: filterOptions
      });
    });

    it('should handle empty filter options', async () => {
      // Arrange
      const mockResult = {
        tasks: [],
        total: 0,
        hasMore: false
      };

      mockTaskModel.findByFilters.mockResolvedValue(mockResult);

      // Act
      const result = await TaskService.getUserTasks(userId, {});

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockTaskModel.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: userId }),
        {}
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.findByFilters.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.getUserTasks(userId, filterOptions))
        .rejects.toThrow('Failed to retrieve tasks');
    });
  });

  describe('getEnhancedTaskStatistics', () => {
    const userId = 'user-123';

    it('should successfully retrieve task statistics', async () => {
      // Arrange
      const mockStats = {
        totalTasks: 50,
        completedTasks: 20,
        pendingTasks: 15,
        inProgressTasks: 10,
        archivedTasks: 5,
        tasksByPriority: {
          high: 10,
          medium: 20,
          low: 15,
          none: 5
        },
        tasksByStatus: {
          pending: 15,
          in_progress: 10,
          completed: 20,
          archived: 5
        },
        overdueTasks: 5,
        dueTodayTasks: 3,
        dueThisWeekTasks: 8
      };

      mockTaskModel.getStatistics.mockResolvedValue(mockStats);

      // Act
      const result = await TaskService.getEnhancedTaskStatistics(userId);

      // Assert
      expect(result).toEqual(mockStats);
      expect(mockTaskModel.getStatistics).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith('Task statistics retrieved successfully', { userId });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.getStatistics.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.getEnhancedTaskStatistics(userId))
        .rejects.toThrow('Failed to retrieve task statistics');
    });
  });

  describe('getTasksDueToday', () => {
    const userId = 'user-123';

    it('should successfully retrieve due tasks for today', async () => {
      // Arrange
      const today = new Date();
      const mockTasks = [
        createTestTask({ 
          id: 'task-1', 
          user_id: userId, 
          title: 'Due Today 1',
          due_date: today 
        }),
        createTestTask({ 
          id: 'task-2', 
          user_id: userId, 
          title: 'Due Today 2',
          due_date: today 
        })
      ];

      mockTaskModel.findDueTasks.mockResolvedValue(mockTasks);

      // Act
      const result = await TaskService.getTasksDueToday(userId);

      // Assert
      expect(result).toEqual(mockTasks);
      expect(mockTaskModel.findDueTasks).toHaveBeenCalledWith(userId, expect.any(Date));
      expect(mockLogger.info).toHaveBeenCalledWith('Due tasks retrieved successfully', {
        userId,
        count: mockTasks.length
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.findDueTasks.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.getTasksDueToday(userId))
        .rejects.toThrow('Failed to retrieve due tasks');
    });
  });

  describe('getOverdueTasks', () => {
    const userId = 'user-123';

    it('should successfully retrieve overdue tasks', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const mockTasks = [
        createTestTask({ 
          id: 'task-1', 
          user_id: userId, 
          title: 'Overdue Task 1',
          due_date: yesterday,
          status: 'pending'
        }),
        createTestTask({ 
          id: 'task-2', 
          user_id: userId, 
          title: 'Overdue Task 2',
          due_date: yesterday,
          status: 'in_progress'
        })
      ];

      mockTaskModel.findOverdueTasks.mockResolvedValue(mockTasks);

      // Act
      const result = await TaskService.getOverdueTasks(userId);

      // Assert
      expect(result).toEqual(mockTasks);
      expect(mockTaskModel.findOverdueTasks).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith('Overdue tasks retrieved successfully', {
        userId,
        count: mockTasks.length
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.findOverdueTasks.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.getOverdueTasks(userId))
        .rejects.toThrow('Failed to retrieve overdue tasks');
    });
  });

  describe('bulkUpdateTasks', () => {
    const userId = 'user-123';
    const taskIds = ['task-1', 'task-2', 'task-3'];
    const updateData = {
      status: 'completed' as const,
      priority: 'low' as const
    };

    it('should successfully bulk update tasks', async () => {
      // Arrange
      const mockTasks = taskIds.map(id => createTestTask({ id, user_id: userId }));
      const updatedTasks = taskIds.map(id => createTestTask({ 
        id, 
        user_id: userId,
        ...updateData 
      }));

      mockTaskModel.findByIds.mockResolvedValue(mockTasks);
      mockTaskModel.bulkUpdate.mockResolvedValue(updatedTasks);

      // Act
      const result = await TaskService.bulkUpdateTasks(userId, taskIds, updateData);

      // Assert
      expect(result).toEqual(updatedTasks);
      expect(mockTaskModel.findByIds).toHaveBeenCalledWith(taskIds);
      expect(mockTaskModel.bulkUpdate).toHaveBeenCalledWith(taskIds, updateData);
      expect(mockLogger.info).toHaveBeenCalledWith('Tasks bulk updated successfully', {
        userId,
        taskIds,
        updateData,
        count: updatedTasks.length
      });
    });

    it('should throw error when some tasks do not belong to user', async () => {
      // Arrange
      const mockTasks = [
        createTestTask({ id: 'task-1', user_id: userId }),
        createTestTask({ id: 'task-2', user_id: 'other-user' }),
        createTestTask({ id: 'task-3', user_id: userId })
      ];

      mockTaskModel.findByIds.mockResolvedValue(mockTasks);

      // Act & Assert
      await expect(TaskService.bulkUpdateTasks(userId, taskIds, updateData))
        .rejects.toThrow('Unauthorized access to some tasks');
      
      expect(mockTaskModel.bulkUpdate).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockTaskModel.findByIds.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(TaskService.bulkUpdateTasks(userId, taskIds, updateData))
        .rejects.toThrow('Failed to bulk update tasks');
    });
  });
});
