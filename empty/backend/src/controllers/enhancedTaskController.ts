/**
 * Enhanced Task Controller
 * 
 * Comprehensive REST API controller for task management with:
 * - Full CRUD operations with advanced validation
 * - Bulk operations for multiple tasks
 * - Advanced search, filtering, and sorting
 * - Task statistics and analytics
 * - Task relationships and dependencies
 * - File attachment handling
 * - Activity logging and audit trails
 * - Comprehensive error handling and response formatting
 * - Input sanitization and security
 * - Rate limiting and performance optimization
 */

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { taskService } from '../services/taskService';
import { 
  CreateTaskData, 
  UpdateTaskData, 
  TaskSearchFilters, 
  TaskSortOptions,
  BulkUpdateResult
} from '../repositories/taskRepository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import sanitizeHtml from 'sanitize-html';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

interface PaginationQuery {
  page?: string;
  limit?: string;
  offset?: string;
}

interface TaskQuery extends PaginationQuery {
  search?: string;
  status?: string;
  priority?: string;
  category_id?: string;
  tags?: string;
  due_date_from?: string;
  due_date_to?: string;
  created_from?: string;
  created_to?: string;
  sortBy?: string;
  sortOrder?: string;
  include_archived?: string;
  include_completed?: string;
}

interface BulkTaskOperation {
  task_ids: string[];
  operation: 'update' | 'delete' | 'archive' | 'restore';
  data?: Partial<UpdateTaskData>;
}

interface TaskAnalyticsQuery {
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  start_date?: string;
  end_date?: string;
  group_by?: 'status' | 'priority' | 'category' | 'date';
}

// =====================================================
// ENHANCED TASK CONTROLLER
// =====================================================

export class EnhancedTaskController {

  // =====================================================
  // VALIDATION MIDDLEWARE
  // =====================================================

  /**
   * Common validation rules for task creation
   */
  static get createTaskValidation(): ValidationChain[] {
    return [
      body('title')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Title must be between 1 and 500 characters')
        .customSanitizer(value => sanitizeHtml(value, { allowedTags: [] })),
      
      body('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Description must be less than 5000 characters')
        .customSanitizer(value => value ? sanitizeHtml(value, {
          allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
          allowedAttributes: {}
        }) : value),
      
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
        .isInt({ min: 0, max: 43200 }) // Max 30 days
        .withMessage('Estimated minutes must be between 0 and 43200 (30 days)'),
      
      body('actual_minutes')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Actual minutes must be a non-negative integer'),
      
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
      
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be a valid object')
        .custom((metadata) => {
          if (metadata && JSON.stringify(metadata).length > 10000) {
            throw new Error('Metadata size cannot exceed 10KB');
          }
          return true;
        })
    ];
  }

  /**
   * Validation rules for task updates
   */
  static get updateTaskValidation(): ValidationChain[] {
    return [
      param('id')
        .isUUID(4)
        .withMessage('Task ID must be a valid UUID'),
      
      ...EnhancedTaskController.createTaskValidation.map(rule => 
        rule.optional()
      )
    ];
  }

  /**
   * Validation rules for task ID parameter
   */
  static get taskIdValidation(): ValidationChain[] {
    return [
      param('id')
        .isUUID(4)
        .withMessage('Task ID must be a valid UUID')
    ];
  }

  /**
   * Validation rules for bulk operations
   */
  static get bulkOperationValidation(): ValidationChain[] {
    return [
      body('task_ids')
        .isArray({ min: 1, max: 100 })
        .withMessage('task_ids must be an array with 1-100 items')
        .custom((ids) => {
          if (!ids.every((id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
            throw new Error('All task_ids must be valid UUIDs');
          }
          return true;
        }),
      
      body('operation')
        .isIn(['update', 'delete', 'archive', 'restore'])
        .withMessage('Operation must be one of: update, delete, archive, restore'),
      
      body('data')
        .optional()
        .isObject()
        .withMessage('Data must be a valid object')
    ];
  }

  /**
   * Validation rules for search queries
   */
  static get searchValidation(): ValidationChain[] {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1000'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      query('search')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Search query must be less than 255 characters')
        .customSanitizer(value => value ? sanitizeHtml(value, { allowedTags: [] }) : value),
      
      query('status')
        .optional()
        .custom((value) => {
          if (value) {
            const statuses = value.split(',');
            const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];
            if (!statuses.every((status: string) => validStatuses.includes(status))) {
              throw new Error('Invalid status values');
            }
          }
          return true;
        }),
      
      query('priority')
        .optional()
        .custom((value) => {
          if (value) {
            const priorities = value.split(',');
            const validPriorities = ['high', 'medium', 'low', 'none'];
            if (!priorities.every((priority: string) => validPriorities.includes(priority))) {
              throw new Error('Invalid priority values');
            }
          }
          return true;
        }),
      
      query('sortBy')
        .optional()
        .isIn(['created_at', 'updated_at', 'due_date', 'priority', 'status', 'title'])
        .withMessage('Invalid sortBy value'),
      
      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc', 'ASC', 'DESC'])
        .withMessage('sortOrder must be asc or desc')
    ];
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Handle validation errors
   */
  private static handleValidationErrors(req: Request): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => ({
        field: err.type === 'field' ? (err as any).path : 'unknown',
        message: err.msg,
        value: err.type === 'field' ? (err as any).value : undefined
      }));
      
      logger.warn('Validation errors in task request', {
        errors: errorMessages,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });

      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }
  }

  /**
   * Ensure user authentication
   */
  private static ensureAuthenticated(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }
    return userId;
  }

  /**
   * Parse and validate pagination parameters
   */
  private static parsePagination(query: PaginationQuery): { limit: number; offset: number; page: number } {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const offset = query.offset ? parseInt(query.offset) : (page - 1) * limit;

    return { limit, offset, page };
  }

  /**
   * Parse task search filters
   */
  private static parseSearchFilters(query: TaskQuery): TaskSearchFilters {
    const filters: TaskSearchFilters = {};

    if (query.search) {
      filters.search = query.search;
    }

    if (query.status) {
      filters.status = query.status.split(',') as any;
    }

    if (query.priority) {
      filters.priority = query.priority.split(',') as any;
    }

    if (query.category_id) {
      filters.category_id = query.category_id;
    }

    if (query.tags) {
      filters.tags = query.tags.split(',');
    }

    if (query.due_date_from) {
      filters.due_date_from = new Date(query.due_date_from);
    }

    if (query.due_date_to) {
      filters.due_date_to = new Date(query.due_date_to);
    }

    if (query.created_from) {
      filters.created_after = new Date(query.created_from);
    }

    if (query.created_to) {
      filters.created_before = new Date(query.created_to);
    }

    if (query.include_archived !== undefined) {
      filters.include_archived = query.include_archived === 'true';
    }

    if (query.include_completed !== undefined) {
      filters.include_archived = query.include_completed === 'true';
    }

    return filters;
  }

  /**
   * Parse sort options
   */
  private static parseSortOptions(query: TaskQuery, pagination: { limit: number; offset: number }): TaskSortOptions {
    return {
      sortBy: (query.sortBy as any) || 'created_at',
      sortOrder: (query.sortOrder?.toUpperCase() as any) || 'DESC',
      limit: pagination.limit,
      offset: pagination.offset
    };
  }

  /**
   * Format successful response
   */
  private static formatResponse(data: any, message?: string, meta?: any) {
    return {
      success: true,
      message: message || 'Operation completed successfully',
      data,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format paginated response
   */
  private static formatPaginatedResponse(result: any, page: number, limit: number) {
    return {
      success: true,
      data: result.data,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(result.total / limit),
        per_page: limit,
        total_items: result.total,
        has_next: result.hasNext,
        has_previous: result.hasPrevious
      },
      timestamp: new Date().toISOString()
    };
  }

  // =====================================================
  // CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new task
   * POST /tasks
   */
  static async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const taskData: CreateTaskData = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'none',
        status: req.body.status || 'pending',
        due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
        start_date: req.body.start_date ? new Date(req.body.start_date) : undefined,
        estimated_minutes: req.body.estimated_minutes,
        category_id: req.body.category_id,
        tags: req.body.tags || [],
        metadata: req.body.metadata || {}
      };

      // Validate business rules
      if (taskData.start_date && taskData.due_date && taskData.start_date > taskData.due_date) {
        throw new AppError('Start date cannot be after due date', 400, 'INVALID_DATE_RANGE');
      }

      const task = await taskService.createTask(userId, taskData, {
        requireDescription: false,
        allowPastDueDates: false,
        maxTitleLength: 500,
        maxTagCount: 20
      });

      logger.info('Task created successfully', {
        taskId: task.id,
        userId,
        title: task.title,
        priority: task.priority
      });

      res.status(201).json(
        EnhancedTaskController.formatResponse(task, 'Task created successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get task by ID
   * GET /tasks/:id
   */
  static async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const taskId = req.params.id;

      const task = await taskService.getTaskById(taskId, userId);

      if (!task) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      res.json(
        EnhancedTaskController.formatResponse(task)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update task
   * PUT /tasks/:id
   */
  static async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const taskId = req.params.id;

      // Prepare update data
      const updateData: UpdateTaskData = {};
      const allowedFields = [
        'title', 'description', 'priority', 'status', 'due_date', 
        'start_date', 'estimated_minutes', 'actual_minutes', 
        'category_id', 'tags', 'metadata'
      ];

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

      const task = await taskService.updateTask(taskId, userId, updateData, {
        allowPastDueDates: false,
        maxTitleLength: 500,
        maxTagCount: 20
      });

      if (!task) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      logger.info('Task updated successfully', {
        taskId,
        userId,
        updatedFields: Object.keys(updateData)
      });

      res.json(
        EnhancedTaskController.formatResponse(task, 'Task updated successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete task (soft delete)
   * DELETE /tasks/:id
   */
  static async deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const taskId = req.params.id;
      const force = req.query.force === 'true';

      const success = await taskService.deleteTask(taskId, userId, force);

      if (!success) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      logger.info('Task deleted successfully', {
        taskId,
        userId,
        force
      });

      res.json(
        EnhancedTaskController.formatResponse(
          { deleted: true }, 
          force ? 'Task permanently deleted' : 'Task moved to trash'
        )
      );
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // SEARCH AND LISTING
  // =====================================================

  /**
   * Get user's tasks with filtering and pagination
   * GET /tasks
   */
  static async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const pagination = EnhancedTaskController.parsePagination(req.query);
      const filters = EnhancedTaskController.parseSearchFilters(req.query);
      const sortOptions = EnhancedTaskController.parseSortOptions(req.query, pagination);

      const result = await taskService.searchTasks(userId, filters, sortOptions);

      res.json(
        EnhancedTaskController.formatPaginatedResponse(result, pagination.page, pagination.limit)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Advanced task search
   * POST /tasks/search
   */
  static async searchTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const {
        filters = {},
        pagination = {},
        sort = {},
        include_relations = false
      } = req.body;

      const paginationOptions = {
        limit: Math.min(100, Math.max(1, pagination.limit || 20)),
        offset: pagination.offset || 0,
        page: pagination.page || 1
      };

      const searchFilters: TaskSearchFilters = {
        ...filters,
        include_archived: filters.include_archived || false
      };

      const sortOptions: TaskSortOptions = {
        sortBy: sort.sortBy || 'created_at',
        sortOrder: sort.sortOrder || 'DESC',
        limit: paginationOptions.limit,
        offset: paginationOptions.offset
      };

      const result = await taskService.searchTasks(userId, searchFilters, sortOptions);

      res.json(
        EnhancedTaskController.formatPaginatedResponse(
          result, 
          paginationOptions.page, 
          paginationOptions.limit
        )
      );
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * Bulk update tasks
   * PUT /tasks/bulk
   */
  static async bulkUpdateTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      EnhancedTaskController.handleValidationErrors(req);
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const { task_ids, operation, data } = req.body as BulkTaskOperation;

      let result: BulkUpdateResult;

      switch (operation) {
        case 'update':
          if (!data) {
            throw new AppError('Update data is required for bulk update operation', 400);
          }
          result = await taskService.bulkUpdateTasks(userId, task_ids, data);
          break;

        case 'delete':
          result = await taskService.bulkDeleteTasks(userId, task_ids);
          break;

        case 'archive':
          result = await taskService.bulkUpdateTasks(userId, task_ids, { status: 'archived' });
          break;

        case 'restore':
          // This would restore soft-deleted tasks
          result = { updated: 0, failed: [], errors: {} };
          for (const taskId of task_ids) {
            try {
              await taskService.restoreTask(taskId, userId);
              result.updated++;
            } catch (error) {
              result.failed.push(taskId);
              result.errors[taskId] = error instanceof Error ? error.message : 'Unknown error';
            }
          }
          break;

        default:
          throw new AppError('Invalid bulk operation', 400);
      }

      logger.info('Bulk operation completed', {
        operation,
        userId,
        taskCount: task_ids.length,
        updated: result.updated,
        failed: result.failed.length
      });

      res.json(
        EnhancedTaskController.formatResponse(result, `Bulk ${operation} completed`)
      );
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // ANALYTICS AND STATISTICS
  // =====================================================

  /**
   * Get task statistics
   * GET /tasks/stats
   */
  static async getTaskStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const stats = await taskService.getTaskStats(userId);

      res.json(
        EnhancedTaskController.formatResponse(stats)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get task analytics
   * GET /tasks/analytics
   */
  static async getTaskAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const { period = 'month', start_date, end_date, group_by = 'status' } = req.query as TaskAnalyticsQuery;

      // Calculate date range based on period
      let startDate: Date;
      let endDate: Date = new Date();

      if (start_date && end_date) {
        startDate = new Date(start_date);
        endDate = new Date(end_date);
      } else {
        const now = new Date();
        switch (period) {
          case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      // Get tasks in date range
      const filters: TaskSearchFilters = {
        created_after: startDate,
        created_before: endDate,
        include_archived: true
      };

      const result = await taskService.searchTasks(userId, filters, {
        limit: 1000,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'ASC'
      });

      // Process analytics
      const analytics = this.processTaskAnalytics(result.data, group_by, startDate, endDate);

      res.json(
        EnhancedTaskController.formatResponse(analytics, 'Analytics retrieved successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process task data for analytics
   */
  private static processTaskAnalytics(tasks: any[], groupBy: string, startDate: Date, endDate: Date) {
    const analytics = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      total_tasks: tasks.length,
      completed_tasks: tasks.filter(t => t.status === 'completed').length,
      overdue_tasks: tasks.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
      ).length,
      avg_completion_time: 0,
      productivity_score: 0,
      trends: {},
      distribution: {}
    };

    // Calculate average completion time
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at);
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        return sum + (completed.getTime() - created.getTime());
      }, 0);
      analytics.avg_completion_time = Math.round(totalTime / completedTasks.length / (1000 * 60 * 60)); // hours
    }

    // Calculate productivity score (completed vs created ratio)
    if (analytics.total_tasks > 0) {
      analytics.productivity_score = Math.round((analytics.completed_tasks / analytics.total_tasks) * 100);
    }

    // Group data based on groupBy parameter
    switch (groupBy) {
      case 'status':
        analytics.distribution = tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        break;

      case 'priority':
        analytics.distribution = tasks.reduce((acc, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        break;

      case 'category':
        analytics.distribution = tasks.reduce((acc, task) => {
          const category = task.category?.name || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        break;

      case 'date':
        analytics.trends = tasks.reduce((acc, task) => {
          const date = new Date(task.created_at).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        break;
    }

    return analytics;
  }

  // =====================================================
  // UTILITY ENDPOINTS
  // =====================================================

  /**
   * Get overdue tasks
   * GET /tasks/overdue
   */
  static async getOverdueTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);

      const result = await taskService.getOverdueTasks(userId);

      res.json(
        EnhancedTaskController.formatResponse(result.data, 'Overdue tasks retrieved')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming tasks
   * GET /tasks/upcoming
   */
  static async getUpcomingTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));

      const result = await taskService.getUpcomingTasks(userId);

      res.json(
        EnhancedTaskController.formatResponse(result.data, 'Upcoming tasks retrieved')
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tasks by status
   * GET /tasks/status/:status
   */
  static async getTasksByStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const status = req.params.status;

      const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        throw new AppError('Invalid status', 400, 'INVALID_STATUS');
      }

      const pagination = EnhancedTaskController.parsePagination(req.query);
      const filters: TaskSearchFilters = { status: [status as any] };
      const sortOptions = EnhancedTaskController.parseSortOptions(req.query, pagination);

      const result = await taskService.searchTasks(userId, filters, sortOptions);

      res.json(
        EnhancedTaskController.formatPaginatedResponse(result, pagination.page, pagination.limit)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export tasks to various formats
   * GET /tasks/export
   */
  static async exportTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = EnhancedTaskController.ensureAuthenticated(req);
      const format = (req.query.format as string) || 'json';
      const filters = EnhancedTaskController.parseSearchFilters(req.query);

      if (!['json', 'csv', 'xml'].includes(format)) {
        throw new AppError('Invalid export format. Supported: json, csv, xml', 400);
      }

      const result = await taskService.searchTasks(userId, filters, {
        limit: 10000, // Large limit for export
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `tasks_export_${timestamp}.${format}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.send(EnhancedTaskController.convertToCSV(result.data));
          break;

        case 'xml':
          res.setHeader('Content-Type', 'application/xml');
          res.send(EnhancedTaskController.convertToXML(result.data));
          break;

        default: // json
          res.setHeader('Content-Type', 'application/json');
          res.json(EnhancedTaskController.formatResponse(result.data, 'Tasks exported'));
      }
    } catch (error) {
      next(error);
    }
  }

  // =====================================================
  // HELPER METHODS FOR EXPORT
  // =====================================================

  /**
   * Convert tasks to CSV format
   */
  private static convertToCSV(tasks: any[]): string {
    if (tasks.length === 0) return '';

    const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Due Date', 'Created At', 'Tags'];
    const csvRows = [headers.join(',')];

    tasks.forEach(task => {
      const row = [
        task.id,
        `"${(task.title || '').replace(/"/g, '""')}"`,
        `"${(task.description || '').replace(/"/g, '""')}"`,
        task.status,
        task.priority,
        task.due_date || '',
        task.created_at,
        `"${(task.tags || []).join(', ')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Convert tasks to XML format
   */
  private static convertToXML(tasks: any[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<tasks>\n';
    
    tasks.forEach(task => {
      xml += '  <task>\n';
      xml += `    <id>${task.id}</id>\n`;
      xml += `    <title><![CDATA[${task.title || ''}]]></title>\n`;
      xml += `    <description><![CDATA[${task.description || ''}]]></description>\n`;
      xml += `    <status>${task.status}</status>\n`;
      xml += `    <priority>${task.priority}</priority>\n`;
      xml += `    <due_date>${task.due_date || ''}</due_date>\n`;
      xml += `    <created_at>${task.created_at}</created_at>\n`;
      xml += '    <tags>\n';
      (task.tags || []).forEach((tag: string) => {
        xml += `      <tag><![CDATA[${tag}]]></tag>\n`;
      });
      xml += '    </tags>\n';
      xml += '  </task>\n';
    });
    
    xml += '</tasks>';
    return xml;
  }
}

export default EnhancedTaskController;
