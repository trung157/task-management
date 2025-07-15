/**
 * Modern Task Controller
 * 
 * Comprehensive Express.js controller for task management with:
 * - Full CRUD operations with validation
 * - Comprehensive error handling
 * - Input validation and sanitization
 * - Standardized response formatting
 * - Security middleware integration
 * - Performance optimization
 * - Detailed logging and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { taskService } from '../services/taskService';
import { CreateTaskData, UpdateTaskData, TaskSearchFilters } from '../repositories/taskRepository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// =====================================================
// VALIDATION RULES
// =====================================================

export const createTaskValidation = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title must be between 1 and 500 characters')
    .escape(),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .escape(),
    
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
    .isISO8601({ strict: true })
    .withMessage('Due date must be a valid ISO 8601 date')
    .custom((value) => {
      if (value && new Date(value) < new Date()) {
        throw new Error('Due date cannot be in the past');
      }
      return true;
    }),
    
  body('start_date')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  body('estimated_minutes')
    .optional()
    .isInt({ min: 0, max: 43200 })
    .withMessage('Estimated minutes must be between 0 and 43200 (30 days)'),
    
  body('category_id')
    .optional()
    .isUUID(4)
    .withMessage('Category ID must be a valid UUID'),
    
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with maximum 20 items')
    .custom((tags) => {
      if (tags && !tags.every((tag: any) => typeof tag === 'string' && tag.length <= 50)) {
        throw new Error('Each tag must be a string with maximum 50 characters');
      }
      return true;
    }),
];

export const updateTaskValidation = [
  param('id')
    .isUUID(4)
    .withMessage('Task ID must be a valid UUID'),
    
  ...createTaskValidation.map(rule => rule.optional()),
];

export const taskIdValidation = [
  param('id')
    .isUUID(4)
    .withMessage('Task ID must be a valid UUID'),
];

export const searchTasksValidation = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search term must not exceed 200 characters'),
    
  query('status')
    .optional()
    .custom((value) => {
      const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];
      if (typeof value === 'string') {
        return validStatuses.includes(value);
      }
      if (Array.isArray(value)) {
        return value.every(status => validStatuses.includes(status));
      }
      return false;
    })
    .withMessage('Status must be a valid status or array of statuses'),
    
  query('priority')
    .optional()
    .custom((value) => {
      const validPriorities = ['high', 'medium', 'low', 'none'];
      if (typeof value === 'string') {
        return validPriorities.includes(value);
      }
      if (Array.isArray(value)) {
        return value.every(priority => validPriorities.includes(priority));
      }
      return false;
    })
    .withMessage('Priority must be a valid priority or array of priorities'),
    
  query('category_id')
    .optional()
    .isUUID(4)
    .withMessage('Category ID must be a valid UUID'),
    
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at', 'due_date', 'priority', 'status', 'title'])
    .withMessage('Sort by must be a valid field'),
    
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Handle validation errors
 */
const handleValidationErrors = (req: Request): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    logger.warn('Validation failed', {
      errors: errorMessages,
      url: req.url,
      method: req.method,
      userId: req.user?.id
    });
    
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }
};

/**
 * Ensure user is authenticated
 */
const ensureAuthenticated = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user.id;
};

/**
 * Format successful response
 */
const formatResponse = (data: any, message?: string, meta?: any) => {
  return {
    success: true,
    message: message || 'Operation completed successfully',
    data,
    meta,
    timestamp: new Date().toISOString()
  };
};

/**
 * Format paginated response
 */
const formatPaginatedResponse = (result: any, page: number, limit: number) => {
  const totalPages = Math.ceil(result.total / limit);
  
  return formatResponse(result.data, 'Tasks retrieved successfully', {
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
};

// =====================================================
// CONTROLLER METHODS
// =====================================================

/**
 * Create a new task
 * POST /api/tasks
 */
export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);

    const taskData: CreateTaskData = {
      title: req.body.title,
      description: req.body.description || undefined,
      priority: req.body.priority || 'none',
      status: req.body.status || 'pending',
      due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
      start_date: req.body.start_date ? new Date(req.body.start_date) : undefined,
      estimated_minutes: req.body.estimated_minutes || undefined,
      category_id: req.body.category_id || undefined,
      tags: req.body.tags || [],
      metadata: req.body.metadata || {}
    };

    // Validate business rules
    if (taskData.start_date && taskData.due_date && taskData.start_date > taskData.due_date) {
      throw new AppError('Start date cannot be after due date', 400, 'INVALID_DATE_RANGE');
    }

    const task = await taskService.createTask(userId, taskData);

    logger.info('Task created successfully', {
      taskId: task.id,
      userId,
      title: task.title
    });

    res.status(201).json(formatResponse(task, 'Task created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific task
 * GET /api/tasks/:id
 */
export const getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);
    const taskId = req.params.id;

    const task = await taskService.getTaskById(taskId, userId);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    res.json(formatResponse(task, 'Task retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update a task
 * PUT/PATCH /api/tasks/:id
 */
export const updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);
    const taskId = req.params.id;

    const updateData: UpdateTaskData = {};
    const allowedFields = [
      'title', 'description', 'priority', 'status', 'due_date', 
      'start_date', 'estimated_minutes', 'actual_minutes', 
      'category_id', 'tags', 'metadata'
    ];

    // Only include fields that are provided in the request
    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        if (field === 'due_date' || field === 'start_date') {
          (updateData as any)[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          (updateData as any)[field] = req.body[field];
        }
      }
    });

    // Validate business rules
    if (updateData.start_date && updateData.due_date && 
        updateData.start_date > updateData.due_date) {
      throw new AppError('Start date cannot be after due date', 400, 'INVALID_DATE_RANGE');
    }

    const task = await taskService.updateTask(taskId, userId, updateData);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    logger.info('Task updated successfully', {
      taskId,
      userId,
      updatedFields: Object.keys(updateData)
    });

    res.json(formatResponse(task, 'Task updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a task (soft delete)
 * DELETE /api/tasks/:id
 */
export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);
    const taskId = req.params.id;

    const success = await taskService.deleteTask(taskId, userId);

    if (!success) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    logger.info('Task deleted successfully', {
      taskId,
      userId
    });

    res.json(formatResponse(null, 'Task deleted successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's tasks with pagination and filtering
 * GET /api/tasks
 */
export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);

    // Parse pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Parse filters
    const filters: TaskSearchFilters = {};
    
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    
    if (req.query.status) {
      filters.status = req.query.status as any;
    }
    
    if (req.query.priority) {
      filters.priority = req.query.priority as any;
    }
    
    if (req.query.category_id) {
      filters.category_id = req.query.category_id as string;
    }
    
    if (req.query.tags) {
      filters.tags = Array.isArray(req.query.tags) 
        ? req.query.tags as string[]
        : [req.query.tags as string];
    }

    // Parse sort options
    const sortOptions = {
      sortBy: (req.query.sort_by as any) || 'created_at',
      sortOrder: (req.query.sort_order as any) || 'DESC',
      limit,
      offset
    };

    const result = await taskService.searchTasks(userId, filters, sortOptions);

    res.json(formatPaginatedResponse(result, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * Search tasks with advanced filters
 * GET /api/tasks/search
 */
export const searchTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    handleValidationErrors(req);
    const userId = ensureAuthenticated(req);

    // Parse pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Parse advanced filters
    const filters: TaskSearchFilters = {};
    
    // Basic filters
    if (req.query.search) filters.search = req.query.search as string;
    if (req.query.status) filters.status = req.query.status as any;
    if (req.query.priority) filters.priority = req.query.priority as any;
    if (req.query.category_id) filters.category_id = req.query.category_id as string;
    
    // Date range filters
    if (req.query.due_date_from) {
      filters.due_date_from = new Date(req.query.due_date_from as string);
    }
    if (req.query.due_date_to) {
      filters.due_date_to = new Date(req.query.due_date_to as string);
    }
    if (req.query.created_after) {
      filters.created_after = new Date(req.query.created_after as string);
    }
    if (req.query.created_before) {
      filters.created_before = new Date(req.query.created_before as string);
    }
    
    // Boolean filters
    if (req.query.is_overdue !== undefined) {
      filters.is_overdue = req.query.is_overdue === 'true';
    }
    if (req.query.include_archived !== undefined) {
      filters.include_archived = req.query.include_archived === 'true';
    }
    if (req.query.include_deleted !== undefined) {
      filters.include_deleted = req.query.include_deleted === 'true';
    }

    // Tags filter
    if (req.query.tags) {
      filters.tags = Array.isArray(req.query.tags) 
        ? req.query.tags as string[]
        : [req.query.tags as string];
    }

    // Sort options
    const sortOptions = {
      sortBy: (req.query.sort_by as any) || 'created_at',
      sortOrder: (req.query.sort_order as any) || 'DESC',
      limit,
      offset
    };

    const result = await taskService.searchTasks(userId, filters, sortOptions);

    logger.info('Advanced search performed', {
      userId,
      filters: Object.keys(filters),
      resultsCount: result.total
    });

    res.json(formatPaginatedResponse(result, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * Get task statistics
 * GET /api/tasks/stats
 */
export const getTaskStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);

    const stats = await taskService.getTaskStats(userId);

    res.json(formatResponse(stats, 'Task statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update tasks
 * PATCH /api/tasks/bulk
 */
export const bulkUpdateTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);
    const { task_ids, updates } = req.body;

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      throw new AppError('Task IDs array is required', 400, 'INVALID_INPUT');
    }

    if (!updates || typeof updates !== 'object') {
      throw new AppError('Updates object is required', 400, 'INVALID_INPUT');
    }

    // Validate task IDs
    const invalidIds = task_ids.filter(id => typeof id !== 'string' || id.length !== 36);
    if (invalidIds.length > 0) {
      throw new AppError('All task IDs must be valid UUIDs', 400, 'INVALID_TASK_IDS');
    }

    const result = await taskService.bulkUpdateTasks(userId, task_ids, updates);

    logger.info('Bulk update completed', {
      userId,
      taskCount: task_ids.length,
      updated: result.updated,
      failed: result.failed.length
    });

    res.json(formatResponse(result, 'Bulk update completed'));
  } catch (error) {
    next(error);
  }
};

/**
 * Export tasks
 * GET /api/tasks/export
 */
export const exportTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = ensureAuthenticated(req);
    const format = req.query.format as string || 'json';

    if (!['json', 'csv'].includes(format)) {
      throw new AppError('Invalid export format. Supported: json, csv', 400, 'INVALID_FORMAT');
    }

    // Get all user tasks
    const result = await taskService.searchTasks(userId, {}, { 
      limit: 10000, 
      offset: 0, 
      sortBy: 'created_at', 
      sortOrder: 'DESC' 
    });

    const tasks = result.data;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.json"`);
      res.json(formatResponse(tasks, 'Tasks exported successfully'));
    } else if (format === 'csv') {
      // Simple CSV export
      const csvHeader = 'ID,Title,Description,Priority,Status,Due Date,Created At\n';
      const csvRows = tasks.map((task: any) => 
        `"${task.id}","${task.title}","${task.description || ''}","${task.priority}","${task.status}","${task.due_date || ''}","${task.created_at}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.csv"`);
      res.send(csvContent);
    }

    logger.info('Tasks exported', {
      userId,
      format,
      taskCount: tasks.length
    });

  } catch (error) {
    next(error);
  }
};

// =====================================================
// EXPORT CONTROLLER
// =====================================================

export const TaskController = {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTasks,
  searchTasks,
  getTaskStats,
  bulkUpdateTasks,
  exportTasks
};

export default TaskController;
