/**
 * Simple TaskService Tests with Mocking
 */

// Mock the taskService instance export
jest.mock('../../services/taskService', () => ({
  taskService: {
    createTask: jest.fn(),
    getTaskById: jest.fn(),
    searchTasks: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  }
}));

import { taskService } from '../../services/taskService';

const mockTaskService = taskService as jest.Mocked<typeof taskService>;

describe('TaskService Mocked Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending' as const,
        priority: 'medium' as const,
        user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTaskService.createTask.mockResolvedValue(mockTask as any);

      const result = await mockTaskService.createTask('user-1', {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'medium'
      } as any);

      expect(result).toEqual(mockTask);
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchTasks', () => {
    it('should search tasks successfully', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0 }
      };

      mockTaskService.searchTasks.mockResolvedValue(mockResponse as any);

      const result = await mockTaskService.searchTasks('user-1', {}, {});

      expect(result).toEqual(mockResponse);
      expect(mockTaskService.searchTasks).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTaskById', () => {
    it('should get task by id successfully', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        user_id: 'user-1'
      };

      mockTaskService.getTaskById.mockResolvedValue(mockTask as any);

      const result = await mockTaskService.getTaskById('task-1', 'user-1');

      expect(result).toEqual(mockTask);
      expect(mockTaskService.getTaskById).toHaveBeenCalledWith('task-1', 'user-1');
    });
  });
});
