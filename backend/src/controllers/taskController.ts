/**
 * Task Controller
 * 
 * REST API endpoints for task management with:
 * - Full CRUD operations
 * - Advanced search and filtering
 * - Bulk operations
 * - Statistics and analytics
 * - Request validation and error handling
 */

/// <reference path="../types/express.d.ts" />

import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/taskService';
import { 
  CreateTaskData, 
  UpdateTaskData, 
  TaskSearchFilters, 
  TaskSortOptions 
} from '../repositories/taskRepository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { validationResult, body, query, param } from 'express-validator';

export class TaskController {

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private static handleValidationErrors(req: Request): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join(', ');
      throw new AppError(`Validation failed: ${errorMessages}`, 400);
    }
  }

  // =====================================================
  // VALIDATION MIDDLEWARE
  // =====================================================

  static validateCreateTask = [
    body('title')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('priority')
      .optional()
      .isIn(['high', 'medium', 'low', 'none'])
      .withMessage('Priority must be one of: high, medium, low, none'),
    body('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'archived'])
      .withMessage('Status must be one of: pending, in_progress, completed, archived'),
    body('due_date')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('estimated_minutes')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Estimated minutes must be a non-negative integer'),
    body('category_id')
      .optional()
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
  ];

  static validateUpdateTask = [
    param('id')
      .isUUID()
      .withMessage('Task ID must be a valid UUID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('priority')
      .optional()
      .isIn(['high', 'medium', 'low', 'none'])
      .withMessage('Priority must be one of: high, medium, low, none'),
    body('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'archived'])
      .withMessage('Status must be one of: pending, in_progress, completed, archived')
  ];

  static validateTaskId = [
    param('id')
      .isUUID()
      .withMessage('Task ID must be a valid UUID')
  ];

  // =====================================================
  // CRUD ENDPOINTS
  // =====================================================

  /**
   * Create a new task
   */
  static async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      TaskController.handleValidationErrors(req);

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const taskData: CreateTaskData = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        status: req.body.status,
        due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
        estimated_minutes: req.body.estimated_minutes,
        category_id: req.body.category_id,
        tags: req.body.tags || [],
        metadata: req.body.metadata || {}
      };

      const task = await taskService.createTask(userId, taskData);

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: task
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get task by ID
   */
  static async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      TaskController.handleValidationErrors(req);

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const taskId = req.params.id;
      const task = await taskService.getTaskById(taskId, userId);

      if (!task) {
        throw new AppError('Task not found', 404);
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update task
   */
  static async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      TaskController.handleValidationErrors(req);

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const taskId = req.params.id;
      const updateData: UpdateTaskData = {
        ...req.body,
        due_date: req.body.due_date ? new Date(req.body.due_date) : req.body.due_date
      };

      const task = await taskService.updateTask(taskId, userId, updateData);

      if (!task) {
        throw new AppError('Task not found', 404);
      }

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: task
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete task (soft delete)
   */
  static async deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      TaskController.handleValidationErrors(req);

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const taskId = req.params.id;
      const result = await taskService.deleteTask(taskId, userId);

      if (!result) {
        throw new AppError('Task not found', 404);
      }

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's tasks
   */
  static async getUserTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

      const options: TaskSortOptions = {
        limit: Math.min(parseInt(limit as string) || 20, 100),
        offset: ((parseInt(page as string) || 1) - 1) * (parseInt(limit as string) || 20),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await taskService.getUserTasks(userId, options);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: parseInt(page as string) || 1,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search tasks with advanced filtering
   */
  static async searchTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const {
        search,
        status,
        priority,
        category_id,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const filters: TaskSearchFilters = {
        search: search as string,
        status: status as any,
        priority: priority as any,
        category_id: category_id as string,
        include_archived: false
      };

      const options: TaskSortOptions = {
        limit: Math.min(parseInt(limit as string) || 20, 100),
        offset: ((parseInt(page as string) || 1) - 1) * (parseInt(limit as string) || 20),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await taskService.searchTasks(userId, filters, options);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: parseInt(page as string) || 1,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get task statistics
   */
  static async getTaskStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const stats = await taskService.getTaskStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export the class as default
export default TaskController;
