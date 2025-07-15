import { Request, Response } from 'express';
import { TaskModel, CreateTaskData, UpdateTaskData, TaskSearchFilters, PaginationOptions, TaskStatus, TaskPriority } from '../models/task';
import { User } from '../models/user';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notificationService';

/**
 * Modern Task Controller using TaskModel
 * Provides comprehensive CRUD operations with proper error handling,
 * logging, and integration with the notification system
 */
export class TaskController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Helper function to validate and cast status values
   */
  private validateStatusArray(statusString: string): TaskStatus[] | undefined {
    if (!statusString) return undefined;
    
    const statuses = statusString.split(',');
    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'archived'];
    
    const validatedStatuses = statuses.filter(status => 
      validStatuses.includes(status as TaskStatus)
    ) as TaskStatus[];
    
    return validatedStatuses.length > 0 ? validatedStatuses : undefined;
  }

  /**
   * Helper function to validate and cast priority values
   */
  private validatePriorityArray(priorityString: string): TaskPriority[] | undefined {
    if (!priorityString) return undefined;
    
    const priorities = priorityString.split(',');
    const validPriorities: TaskPriority[] = ['high', 'medium', 'low', 'none'];
    
    const validatedPriorities = priorities.filter(priority => 
      validPriorities.includes(priority as TaskPriority)
    ) as TaskPriority[];
    
    return validatedPriorities.length > 0 ? validatedPriorities : undefined;
  }

  /**
   * Get all tasks with advanced filtering, search, and pagination
   * GET /api/tasks
   */
  public getTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;
      
      // Parse query parameters for filtering
      const filters: TaskSearchFilters = {
        search: req.query.search as string,
        status: this.validateStatusArray(req.query.status as string),
        priority: this.validatePriorityArray(req.query.priority as string),
        category_id: req.query.category_id as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        due_date_from: req.query.due_date_from ? new Date(req.query.due_date_from as string) : undefined,
        due_date_to: req.query.due_date_to ? new Date(req.query.due_date_to as string) : undefined,
        created_after: req.query.created_after ? new Date(req.query.created_after as string) : undefined,
        created_before: req.query.created_before ? new Date(req.query.created_before as string) : undefined,
        completed: req.query.completed === 'true' ? true : req.query.completed === 'false' ? false : undefined,
        overdue: req.query.overdue === 'true',
        has_due_date: req.query.has_due_date === 'true' ? true : req.query.has_due_date === 'false' ? false : undefined,
        has_category: req.query.has_category === 'true' ? true : req.query.has_category === 'false' ? false : undefined,
      };

      // Parse pagination parameters
      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort_by: (req.query.sort_by as string) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      };

      const result = await TaskModel.list(userId, filters, pagination);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching tasks:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to fetch tasks', 500, 'FETCH_TASKS_FAILED');
    }
  };

  /**
   * Get single task by ID
   * GET /api/tasks/:id
   */
  public getTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;

      const task = await TaskModel.findById(id, userId);
      
      if (!task) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching task:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to fetch task', 500, 'FETCH_TASK_FAILED');
    }
  };

  /**
   * Create new task
   * POST /api/tasks
   */
  public createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;
      const taskData: CreateTaskData = {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status || 'pending',
        priority: req.body.priority || 'medium',
        due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
        reminder_date: req.body.reminder_date ? new Date(req.body.reminder_date) : undefined,
        estimated_minutes: req.body.estimated_minutes,
        category_id: req.body.category_id,
        tags: req.body.tags,
      };

      const task = await TaskModel.create(userId, taskData);

      // Send task assignment notification if assigned to someone else
      if (req.body.assigned_to && req.body.assigned_to !== userId) {
        try {
          await this.notificationService.sendTaskAssignmentNotification(
            task.id, 
            req.body.assigned_to, 
            userId
          );
        } catch (notificationError) {
          logger.warn('Failed to send task assignment notification:', notificationError);
        }
      }

      logger.info('Task created successfully:', { taskId: task.id, userId });

      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully',
      });
    } catch (error) {
      logger.error('Error creating task:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to create task', 500, 'CREATE_TASK_FAILED');
    }
  };

  /**
   * Update existing task
   * PUT /api/tasks/:id
   */
  public updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;

      const updateData: UpdateTaskData = {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        priority: req.body.priority,
        due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
        reminder_date: req.body.reminder_date ? new Date(req.body.reminder_date) : undefined,
        estimated_minutes: req.body.estimated_minutes,
        actual_minutes: req.body.actual_minutes,
        category_id: req.body.category_id,
        tags: req.body.tags,
      };

      const task = await TaskModel.update(id, userId, updateData);

      logger.info('Task updated successfully:', { taskId: id, userId });

      res.json({
        success: true,
        data: task,
        message: 'Task updated successfully',
      });
    } catch (error) {
      logger.error('Error updating task:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to update task', 500, 'UPDATE_TASK_FAILED');
    }
  };

  /**
   * Delete task (soft delete)
   * DELETE /api/tasks/:id
   */
  public deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;

      await TaskModel.delete(id, userId);

      logger.info('Task deleted successfully:', { taskId: id, userId });

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting task:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to delete task', 500, 'DELETE_TASK_FAILED');
    }
  };

  /**
   * Mark task as completed
   * PATCH /api/tasks/:id/complete
   */
  public markCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;
      const { actual_minutes } = req.body;

      const task = await TaskModel.markCompleted(id, userId, actual_minutes);

      logger.info('Task marked as completed:', { taskId: id, userId, actual_minutes });

      res.json({
        success: true,
        data: task,
        message: 'Task marked as completed',
      });
    } catch (error) {
      logger.error('Error marking task as completed:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to mark task as completed', 500, 'COMPLETE_TASK_FAILED');
    }
  };

  /**
   * Mark task as in progress
   * PATCH /api/tasks/:id/start
   */
  public markInProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;

      const task = await TaskModel.markInProgress(id, userId);

      logger.info('Task marked as in progress:', { taskId: id, userId });

      res.json({
        success: true,
        data: task,
        message: 'Task marked as in progress',
      });
    } catch (error) {
      logger.error('Error marking task as in progress:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to mark task as in progress', 500, 'START_TASK_FAILED');
    }
  };

  /**
   * Duplicate task
   * POST /api/tasks/:id/duplicate
   */
  public duplicateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;
      const { new_title } = req.body;

      const task = await TaskModel.duplicate(id, userId, new_title);

      logger.info('Task duplicated successfully:', { originalTaskId: id, newTaskId: task.id, userId });

      res.status(201).json({
        success: true,
        data: task,
        message: 'Task duplicated successfully',
      });
    } catch (error) {
      logger.error('Error duplicating task:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to duplicate task', 500, 'DUPLICATE_TASK_FAILED');
    }
  };

  /**
   * Get task statistics
   * GET /api/tasks/stats
   */
  public getTaskStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;
      const stats = await TaskModel.getStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching task stats:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to fetch task statistics', 500, 'FETCH_STATS_FAILED');
    }
  };

  /**
   * Search tasks
   * GET /api/tasks/search
   */
  public searchTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;
      const { query, filters, sort } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
      }

      const searchFilters: TaskSearchFilters = {
        search: query,
        ...(filters && typeof filters === 'string' ? JSON.parse(filters) : {}),
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        ...(sort && typeof sort === 'string' ? JSON.parse(sort) : {}),
      };

      const result = await TaskModel.search(userId, query, searchFilters, pagination);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error searching tasks:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to search tasks', 500, 'SEARCH_TASKS_FAILED');
    }
  };

  /**
   * Get tasks due soon
   * GET /api/tasks/due-soon
   */
  public getTasksDueSoon = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const filters: TaskSearchFilters = {
        due_date_to: endDate,
        status: ['pending', 'in_progress'],
      };

      const pagination: PaginationOptions = {
        page: 1,
        limit: 50,
        sort_by: 'due_date',
        sort_order: 'asc',
      };

      const result = await TaskModel.list(userId, filters, pagination);

      res.json({
        success: true,
        data: result,
        message: `Tasks due in the next ${days} days`,
      });
    } catch (error) {
      logger.error('Error fetching tasks due soon:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to fetch tasks due soon', 500, 'FETCH_DUE_SOON_FAILED');
    }
  };

  /**
   * Get overdue tasks
   * GET /api/tasks/overdue
   */
  public getOverdueTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user!.id;

      const filters: TaskSearchFilters = {
        overdue: true,
        status: ['pending', 'in_progress'],
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort_by: 'due_date',
        sort_order: 'asc',
      };

      const result = await TaskModel.list(userId, filters, pagination);

      res.json({
        success: true,
        data: result,
        message: 'Overdue tasks',
      });
    } catch (error) {
      logger.error('Error fetching overdue tasks:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to fetch overdue tasks', 500, 'FETCH_OVERDUE_FAILED');
    }
  };

  /**
   * Bulk update task status
   * PATCH /api/tasks/bulk/status
   */
  public bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { task_ids, status } = req.body;
      const userId = (req as any).user!.id;

      if (!Array.isArray(task_ids) || task_ids.length === 0) {
        throw new AppError('Task IDs array is required', 400, 'TASK_IDS_REQUIRED');
      }

      const updatedTasks = [];
      let successCount = 0;
      let errorCount = 0;

      for (const taskId of task_ids) {
        try {
          const updateData: UpdateTaskData = { status };
          const task = await TaskModel.update(taskId, userId, updateData);
          updatedTasks.push(task);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.warn('Failed to update task in bulk operation:', { taskId, error });
        }
      }

      logger.info('Bulk status update completed:', { 
        userId, 
        successCount, 
        errorCount, 
        status 
      });

      res.json({
        success: true,
        data: {
          updated_tasks: updatedTasks,
          success_count: successCount,
          error_count: errorCount,
        },
        message: `Successfully updated ${successCount} task(s) to ${status}`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in bulk status update:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to update task statuses', 500, 'BULK_UPDATE_FAILED');
    }
  };

  /**
   * Bulk delete tasks
   * DELETE /api/tasks/bulk
   */
  public bulkDelete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { task_ids } = req.body;
      const userId = (req as any).user!.id;

      if (!Array.isArray(task_ids) || task_ids.length === 0) {
        throw new AppError('Task IDs array is required', 400, 'TASK_IDS_REQUIRED');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const taskId of task_ids) {
        try {
          await TaskModel.delete(taskId, userId);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.warn('Failed to delete task in bulk operation:', { taskId, error });
        }
      }

      logger.info('Bulk delete completed:', { 
        userId, 
        successCount, 
        errorCount 
      });

      res.json({
        success: true,
        data: {
          success_count: successCount,
          error_count: errorCount,
        },
        message: `Successfully deleted ${successCount} task(s)`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in bulk delete:', { error, userId: (req as any).user!.id });
      throw new AppError('Failed to delete tasks', 500, 'BULK_DELETE_FAILED');
    }
  };

  /**
   * Send manual reminder for a task
   * POST /api/tasks/:id/reminder
   */
  public sendReminder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user!.id;

      // Verify task exists and belongs to user
      const task = await TaskModel.findById(id, userId);
      if (!task) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      await this.notificationService.sendDueDateReminder(id, userId);

      logger.info('Manual reminder sent:', { taskId: id, userId });

      res.json({
        success: true,
        message: 'Reminder sent successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error sending reminder:', { error, taskId: req.params.id, userId: (req as any).user!.id });
      throw new AppError('Failed to send reminder', 500, 'SEND_REMINDER_FAILED');
    }
  };
}
