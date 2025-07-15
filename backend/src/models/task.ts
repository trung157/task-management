import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export type TaskPriority = 'high' | 'medium' | 'low' | 'none';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export interface Task {
  id: string;
  user_id: string;
  category_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: Date;
  reminder_date?: Date;
  start_date?: Date;
  estimated_minutes?: number;
  actual_minutes?: number;
  completed_at?: Date;
  completed_by?: string;
  tags: string[];
  sort_order: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TaskWithCategory extends Task {
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: Date | string;
  reminder_date?: Date | string;
  start_date?: Date | string;
  estimated_minutes?: number;
  category_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: Date | string | null;
  reminder_date?: Date | string | null;
  start_date?: Date | string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  category_id?: string | null;
  tags?: string[];
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface TaskSearchFilters {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category_id?: string;
  tags?: string[];
  due_date_from?: Date | string;
  due_date_to?: Date | string;
  created_after?: Date | string;
  created_before?: Date | string;
  completed?: boolean;
  overdue?: boolean;
  has_due_date?: boolean;
  has_category?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface TaskListResponse {
  tasks: TaskWithCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats?: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
    completion_rate: number;
  };
}

export interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  avg_completion_time?: number;
  tasks_by_priority: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  tasks_by_category: Array<{
    category_id: string;
    category_name: string;
    task_count: number;
  }>;
}

// =====================================================
// TASK MODEL CLASS
// =====================================================

export class TaskModel {
  /**
   * Create a new task
   */
  static async create(userId: string, taskData: CreateTaskData): Promise<TaskWithCategory> {
    const {
      title,
      description,
      priority = 'none',
      status = 'pending',
      due_date,
      reminder_date,
      start_date,
      estimated_minutes,
      category_id,
      tags = [],
      metadata = {}
    } = taskData;

    // Validate input data
    await this.validateCreateData(taskData);

    // Verify category belongs to user if provided
    if (category_id) {
      await this.validateCategoryOwnership(userId, category_id);
    }

    const taskId = uuidv4();

    // Handle completed status - set completed_at if status is completed
    const now = new Date();
    const actualStatus = status === 'completed' ? 'completed' : status;
    const completedAt = status === 'completed' ? now : null;
    const completedBy = status === 'completed' ? userId : null;

    try {
      const result = await pool.query(`
        INSERT INTO tasks (
          id, user_id, category_id, title, description, priority, status,
          due_date, reminder_date, start_date, estimated_minutes, tags, metadata,
          completed_at, completed_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *
      `, [
        taskId,
        userId,
        category_id,
        title.trim(),
        description?.trim(),
        priority,
        actualStatus,
        due_date ? new Date(due_date) : null,
        reminder_date ? new Date(reminder_date) : null,
        start_date ? new Date(start_date) : null,
        estimated_minutes,
        tags,
        JSON.stringify(metadata),
        completedAt,
        completedBy
      ]);

      const task = result.rows[0];

      logger.info('Task created successfully', {
        taskId: task.id,
        userId,
        title: task.title,
        priority: task.priority,
        status: task.status
      });

      // Fetch the task with category information
      return this.findById(task.id, userId) as Promise<TaskWithCategory>;
    } catch (error) {
      logger.error('Failed to create task', { error, userId, title });
      throw new AppError('Failed to create task', 500, 'TASK_CREATION_FAILED');
    }
  }

  /**
   * Find task by ID
   */
  static async findById(taskId: string, userId: string): Promise<TaskWithCategory | null> {
    try {
      const result = await pool.query(`
        SELECT 
          t.*,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL
      `, [taskId, userId]);

      return result.rows.length > 0 ? this.formatTaskWithCategory(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find task by ID', { error, taskId, userId });
      throw new AppError('Failed to retrieve task', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Find task by ID (internal use only - no user restriction)
   * Used by notification service and other internal services
   */
  static async findByIdInternal(taskId: string): Promise<TaskWithCategory | null> {
    try {
      const result = await pool.query(`
        SELECT 
          t.*,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = $1 AND t.deleted_at IS NULL
      `, [taskId]);

      return result.rows.length > 0 ? this.formatTaskWithCategory(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find task by ID (internal)', { error, taskId });
      throw new AppError('Failed to retrieve task', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Update task
   */
  static async update(taskId: string, userId: string, updateData: UpdateTaskData): Promise<TaskWithCategory> {
    // Validate update data
    await this.validateUpdateData(updateData);

    // Check if task exists and belongs to user
    const existingTask = await this.findById(taskId, userId);
    if (!existingTask) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    // Verify category belongs to user if being updated
    if (updateData.category_id) {
      await this.validateCategoryOwnership(userId, updateData.category_id);
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'due_date' || key === 'reminder_date' || key === 'start_date') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value ? new Date(value) : null);
        } else if (key === 'metadata') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else if (typeof value === 'string') {
          fields.push(`${key} = $${paramCount}`);
          values.push(value.trim());
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return existingTask;
    }

    // Handle completion status change
    if (updateData.status === 'completed' && existingTask.status !== 'completed') {
      fields.push(`completed_at = $${paramCount}`);
      values.push(new Date());
      paramCount++;
      fields.push(`completed_by = $${paramCount}`);
      values.push(userId);
      paramCount++;
    } else if (updateData.status !== 'completed' && existingTask.status === 'completed') {
      fields.push(`completed_at = NULL`);
      fields.push(`completed_by = NULL`);
    }

    // Add updated_at field
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    // Add task ID and user ID for WHERE clause
    values.push(taskId, userId);

    try {
      const result = await pool.query(`
        UPDATE tasks 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      logger.info('Task updated successfully', {
        taskId,
        userId,
        fields: Object.keys(updateData)
      });

      const updatedTask = await this.findById(taskId, userId);
      return updatedTask!;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update task', { error, taskId, userId });
      throw new AppError('Failed to update task', 500, 'UPDATE_FAILED');
    }
  }

  /**
   * Soft delete task
   */
  static async delete(taskId: string, userId: string): Promise<void> {
    const task = await this.findById(taskId, userId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    try {
      await pool.query(`
        UPDATE tasks 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [taskId, userId]);

      logger.info('Task soft deleted', { taskId, userId });
    } catch (error) {
      logger.error('Failed to delete task', { error, taskId, userId });
      throw new AppError('Failed to delete task', 500, 'DELETE_FAILED');
    }
  }

  /**
   * List tasks with filtering and pagination
   */
  static async list(
    userId: string,
    filters: TaskSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<TaskListResponse> {
    const {
      search,
      status,
      priority,
      category_id,
      tags,
      due_date_from,
      due_date_to,
      created_after,
      created_before,
      completed,
      overdue,
      has_due_date,
      has_category
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['t.user_id = $1', 't.deleted_at IS NULL'];
    const values: any[] = [userId];
    let paramCount = 2;

    // Text search
    if (search) {
      conditions.push(`(
        t.title ILIKE $${paramCount} OR 
        t.description ILIKE $${paramCount} OR
        $${paramCount} = ANY(t.tags)
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(`t.status = ANY($${paramCount})`);
      values.push(status);
      paramCount++;
    }

    // Priority filter
    if (priority && priority.length > 0) {
      conditions.push(`t.priority = ANY($${paramCount})`);
      values.push(priority);
      paramCount++;
    }

    // Category filter
    if (category_id) {
      conditions.push(`t.category_id = $${paramCount}`);
      values.push(category_id);
      paramCount++;
    }

    // Tags filter
    if (tags && tags.length > 0) {
      conditions.push(`t.tags && $${paramCount}`);
      values.push(tags);
      paramCount++;
    }

    // Date range filters
    if (due_date_from) {
      conditions.push(`t.due_date >= $${paramCount}`);
      values.push(new Date(due_date_from));
      paramCount++;
    }

    if (due_date_to) {
      conditions.push(`t.due_date <= $${paramCount}`);
      values.push(new Date(due_date_to));
      paramCount++;
    }

    if (created_after) {
      conditions.push(`t.created_at >= $${paramCount}`);
      values.push(new Date(created_after));
      paramCount++;
    }

    if (created_before) {
      conditions.push(`t.created_at <= $${paramCount}`);
      values.push(new Date(created_before));
      paramCount++;
    }

    // Completion status
    if (completed !== undefined) {
      if (completed) {
        conditions.push(`t.status = 'completed'`);
      } else {
        conditions.push(`t.status != 'completed'`);
      }
    }

    // Overdue filter
    if (overdue) {
      conditions.push(`t.due_date < NOW() AND t.status != 'completed'`);
    }

    // Has due date filter
    if (has_due_date !== undefined) {
      if (has_due_date) {
        conditions.push(`t.due_date IS NOT NULL`);
      } else {
        conditions.push(`t.due_date IS NULL`);
      }
    }

    // Has category filter
    if (has_category !== undefined) {
      if (has_category) {
        conditions.push(`t.category_id IS NOT NULL`);
      } else {
        conditions.push(`t.category_id IS NULL`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort field
    const allowedSortFields = [
      'created_at', 'updated_at', 'due_date', 'title', 'priority', 'status', 'sort_order'
    ];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';

    try {
      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) as total 
        FROM tasks t 
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
      `, values);

      const total = parseInt(countResult.rows[0].total, 10);
      const pages = Math.ceil(total / limit);

      // Get tasks
      const result = await pool.query(`
        SELECT 
          t.*,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
        ORDER BY t.${sortField} ${sort_order.toUpperCase()}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]);

      const tasks = result.rows.map(row => this.formatTaskWithCategory(row));

      return {
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      };
    } catch (error) {
      logger.error('Failed to list tasks', { error, userId, filters, pagination });
      throw new AppError('Failed to retrieve tasks', 500, 'LIST_FAILED');
    }
  }

  /**
   * Get task statistics for a user
   */
  static async getStats(userId: string): Promise<TaskStats> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
          COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue_tasks,
          COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
          COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority,
          COUNT(*) FILTER (WHERE priority = 'low') as low_priority,
          COUNT(*) FILTER (WHERE priority = 'none') as none_priority,
          AVG(actual_minutes) FILTER (WHERE status = 'completed' AND actual_minutes IS NOT NULL) as avg_completion_time
        FROM tasks 
        WHERE user_id = $1 AND deleted_at IS NULL
      `, [userId]);

      const stats = result.rows[0];
      const totalTasks = parseInt(stats.total_tasks, 10);
      const completedTasks = parseInt(stats.completed_tasks, 10);
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Get tasks by category
      const categoryResult = await pool.query(`
        SELECT 
          c.id as category_id,
          c.name as category_name,
          COUNT(t.id) as task_count
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id AND t.deleted_at IS NULL
        WHERE c.user_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, c.name
        ORDER BY task_count DESC
      `, [userId]);

      return {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        pending_tasks: parseInt(stats.pending_tasks, 10),
        in_progress_tasks: parseInt(stats.in_progress_tasks, 10),
        overdue_tasks: parseInt(stats.overdue_tasks, 10),
        completion_rate: Math.round(completionRate * 100) / 100,
        avg_completion_time: stats.avg_completion_time ? Math.round(stats.avg_completion_time) : undefined,
        tasks_by_priority: {
          high: parseInt(stats.high_priority, 10),
          medium: parseInt(stats.medium_priority, 10),
          low: parseInt(stats.low_priority, 10),
          none: parseInt(stats.none_priority, 10)
        },
        tasks_by_category: categoryResult.rows.map(row => ({
          category_id: row.category_id,
          category_name: row.category_name,
          task_count: parseInt(row.task_count, 10)
        }))
      };
    } catch (error) {
      logger.error('Failed to get task statistics', { error, userId });
      throw new AppError('Failed to retrieve task statistics', 500, 'STATS_FAILED');
    }
  }

  /**
   * Mark task as completed
   */
  static async markCompleted(taskId: string, userId: string, actualMinutes?: number): Promise<TaskWithCategory> {
    return this.update(taskId, userId, {
      status: 'completed',
      actual_minutes: actualMinutes
    });
  }

  /**
   * Mark task as in progress
   */
  static async markInProgress(taskId: string, userId: string): Promise<TaskWithCategory> {
    return this.update(taskId, userId, {
      status: 'in_progress'
    });
  }

  /**
   * Duplicate a task
   */
  static async duplicate(taskId: string, userId: string, newTitle?: string): Promise<TaskWithCategory> {
    const originalTask = await this.findById(taskId, userId);
    if (!originalTask) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const duplicateData: CreateTaskData = {
      title: newTitle || `Copy of ${originalTask.title}`,
      description: originalTask.description,
      priority: originalTask.priority,
      status: 'pending',
      due_date: originalTask.due_date,
      reminder_date: originalTask.reminder_date,
      start_date: originalTask.start_date,
      estimated_minutes: originalTask.estimated_minutes,
      category_id: originalTask.category_id,
      tags: [...originalTask.tags],
      metadata: { ...originalTask.metadata }
    };

    return this.create(userId, duplicateData);
  }

  /**
   * Search tasks using full-text search
   */
  static async search(
    userId: string,
    query: string,
    filters: TaskSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<TaskListResponse> {
    const searchFilters: TaskSearchFilters = {
      ...filters,
      search: query
    };

    return this.list(userId, searchFilters, pagination);
  }

  /**
   * Get tasks across all users with filters (for notification service)
   */
  static async listAllUsers(
    filters: TaskSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<TaskListResponse> {
    const {
      search,
      status,
      priority,
      category_id,
      tags,
      due_date_from,
      due_date_to,
      created_after,
      created_before,
      completed,
      overdue,
      has_due_date,
      has_category
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions (no user restriction)
    const conditions: string[] = ['t.deleted_at IS NULL'];
    const values: any[] = [];

    let paramIndex = 1;

    // Search in title and description
    if (search) {
      conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Status filter
    if (status && status.length > 0) {
      conditions.push(`t.status = ANY($${paramIndex})`);
      values.push(status);
      paramIndex++;
    }

    // Priority filter
    if (priority && priority.length > 0) {
      conditions.push(`t.priority = ANY($${paramIndex})`);
      values.push(priority);
      paramIndex++;
    }

    // Category filter
    if (category_id) {
      conditions.push(`t.category_id = $${paramIndex}`);
      values.push(category_id);
      paramIndex++;
    }

    // Due date filters
    if (due_date_from) {
      conditions.push(`t.due_date >= $${paramIndex}`);
      values.push(due_date_from);
      paramIndex++;
    }

    if (due_date_to) {
      conditions.push(`t.due_date <= $${paramIndex}`);
      values.push(due_date_to);
      paramIndex++;
    }

    // Created date filters
    if (created_after) {
      conditions.push(`t.created_at >= $${paramIndex}`);
      values.push(created_after);
      paramIndex++;
    }

    if (created_before) {
      conditions.push(`t.created_at <= $${paramIndex}`);
      values.push(created_before);
      paramIndex++;
    }

    // Overdue filter
    if (overdue === true) {
      conditions.push('t.due_date < NOW() AND t.status != \'completed\'');
    }

    // Has due date filter
    if (has_due_date === true) {
      conditions.push('t.due_date IS NOT NULL');
    } else if (has_due_date === false) {
      conditions.push('t.due_date IS NULL');
    }

    // Has category filter
    if (has_category === true) {
      conditions.push('t.category_id IS NOT NULL');
    } else if (has_category === false) {
      conditions.push('t.category_id IS NULL');
    }

    // Build the main query
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        t.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COUNT(*) OVER() as total_count
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause}
      ORDER BY t.${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await pool.query(query, values);
      const tasks = result.rows.map(row => this.formatTaskWithCategory(row));
      const totalCount = result.rows[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        tasks,
        pagination: {
          page,
          limit,
          total: parseInt(totalCount),
          pages: totalPages
        }
      };
    } catch (error) {
      logger.error('Failed to list tasks (all users)', { error, filters, pagination });
      throw new AppError('Failed to retrieve tasks', 500, 'DATABASE_ERROR');
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Format task from database row
   */
  private static formatTask(row: any): Task {
    return {
      id: row.id,
      user_id: row.user_id,
      category_id: row.category_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      reminder_date: row.reminder_date,
      start_date: row.start_date,
      estimated_minutes: row.estimated_minutes,
      actual_minutes: row.actual_minutes,
      completed_at: row.completed_at,
      completed_by: row.completed_by,
      tags: row.tags || [],
      sort_order: row.sort_order || 0,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at
    };
  }

  /**
   * Format task with category information
   */
  private static formatTaskWithCategory(row: any): TaskWithCategory {
    const task = this.formatTask(row);
    
    const taskWithCategory: TaskWithCategory = {
      ...task,
      category: row.category_name ? {
        id: row.category_id,
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon
      } : undefined
    };

    return taskWithCategory;
  }

  /**
   * Validate create task data
   */
  private static async validateCreateData(data: CreateTaskData): Promise<void> {
    const { title, priority, status, estimated_minutes } = data;

    // Validate title
    if (!title || title.trim().length === 0) {
      throw new AppError('Title is required', 400, 'MISSING_TITLE');
    }

    if (title.trim().length > 255) {
      throw new AppError('Title must be less than 255 characters', 400, 'TITLE_TOO_LONG');
    }

    // Validate priority
    if (priority && !['high', 'medium', 'low', 'none'].includes(priority)) {
      throw new AppError('Invalid priority value', 400, 'INVALID_PRIORITY');
    }

    // Validate status
    if (status && !['pending', 'in_progress', 'completed', 'archived'].includes(status)) {
      throw new AppError('Invalid status value', 400, 'INVALID_STATUS');
    }

    // Validate estimated minutes
    if (estimated_minutes !== undefined && (estimated_minutes < 0 || estimated_minutes > 99999)) {
      throw new AppError('Estimated minutes must be between 0 and 99999', 400, 'INVALID_ESTIMATED_MINUTES');
    }
  }

  /**
   * Validate update task data
   */
  private static async validateUpdateData(data: UpdateTaskData): Promise<void> {
    const { title, priority, status, estimated_minutes, actual_minutes } = data;

    // Validate title
    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        throw new AppError('Title cannot be empty', 400, 'INVALID_TITLE');
      }

      if (title.trim().length > 255) {
        throw new AppError('Title must be less than 255 characters', 400, 'TITLE_TOO_LONG');
      }
    }

    // Validate priority
    if (priority && !['high', 'medium', 'low', 'none'].includes(priority)) {
      throw new AppError('Invalid priority value', 400, 'INVALID_PRIORITY');
    }

    // Validate status
    if (status && !['pending', 'in_progress', 'completed', 'archived'].includes(status)) {
      throw new AppError('Invalid status value', 400, 'INVALID_STATUS');
    }

    // Validate estimated minutes
    if (estimated_minutes !== undefined && estimated_minutes !== null && 
        (estimated_minutes < 0 || estimated_minutes > 99999)) {
      throw new AppError('Estimated minutes must be between 0 and 99999', 400, 'INVALID_ESTIMATED_MINUTES');
    }

    // Validate actual minutes
    if (actual_minutes !== undefined && actual_minutes !== null && 
        (actual_minutes < 0 || actual_minutes > 99999)) {
      throw new AppError('Actual minutes must be between 0 and 99999', 400, 'INVALID_ACTUAL_MINUTES');
    }
  }

  /**
   * Validate category ownership
   */
  private static async validateCategoryOwnership(userId: string, categoryId: string): Promise<void> {
    try {
      // First validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(categoryId)) {
        throw new AppError('Invalid category ID format', 400, 'INVALID_CATEGORY_ID');
      }

      const result = await pool.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [categoryId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Category not found or access denied', 404, 'CATEGORY_NOT_FOUND');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to validate category ownership', { error, categoryId, userId });
      throw new AppError('Failed to validate category', 500, 'VALIDATION_ERROR');
    }
  }
}

// =====================================================
// LEGACY INTERFACES (for backward compatibility)
// =====================================================

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  category_id?: string;
  estimated_duration?: number;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string;
  category_id?: string;
  estimated_duration?: number;
  actual_duration?: number;
  tags?: string[];
}

export interface TaskFilter {
  status?: string[];
  priority?: string[];
  category_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  tags?: string[];
  completed?: boolean;
  user_id?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  sort_order?: 'asc' | 'desc';
}
