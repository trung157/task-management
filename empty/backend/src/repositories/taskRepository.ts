/**
 * Task Repository
 * 
 * Comprehensive repository implementation for Task model with:
 * - Full CRUD operations
 * - Advanced filtering and searching
 * - Relationship handling (categories, users)
 * - Performance optimized queries
 * - Transaction support
 * - Pagination and sorting
 */

import { PoolClient } from 'pg';
import { BaseRepository, PaginatedResult, PaginationOptions } from './BaseRepository';
import { getDatabase, query, transaction } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

export interface TaskWithRelations extends Task {
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
    description?: string;
  };
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  subtasks?: Task[];
  dependencies?: Task[];
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
  sort_order?: number;
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
  completed_at?: Date | null;
  completed_by?: string | null;
}

export interface TaskSearchFilters {
  search?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  category_id?: string | string[];
  tags?: string | string[];
  due_date_from?: Date | string;
  due_date_to?: Date | string;
  created_after?: Date | string;
  created_before?: Date | string;
  completed_after?: Date | string;
  completed_before?: Date | string;
  user_id?: string | string[];
  has_due_date?: boolean;
  has_category?: boolean;
  is_overdue?: boolean;
  include_archived?: boolean;
  include_deleted?: boolean;
}

export interface TaskSortOptions extends PaginationOptions {
  sortBy?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'status' | 'title' | 'sort_order';
  sortOrder?: 'ASC' | 'DESC';
}

export interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  archived_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  avg_completion_time_hours?: number;
  tasks_by_priority: Record<TaskPriority, number>;
  tasks_by_category: Array<{
    category_id: string;
    category_name: string;
    task_count: number;
  }>;
  tasks_by_status: Record<TaskStatus, number>;
  upcoming_due: number; // Tasks due in next 7 days
}

export interface BulkUpdateResult {
  updated: number;
  failed: string[];
  errors: Record<string, string>;
}

// =====================================================
// TASK REPOSITORY CLASS
// =====================================================

export class TaskRepository extends BaseRepository {
  constructor() {
    super('tasks');
  }

  // =====================================================
  // CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new task
   */
  async createTask(userId: string, taskData: CreateTaskData): Promise<TaskWithRelations> {
    const taskId = uuidv4();
    const now = new Date();

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
      metadata = {},
      sort_order
    } = taskData;

    // Calculate sort_order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const maxOrderResult = await this.query<{ max_order: number }>(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as max_order FROM tasks WHERE user_id = $1 AND deleted_at IS NULL',
        [userId]
      );
      finalSortOrder = maxOrderResult.rows[0]?.max_order || 1;
    }

    const insertQuery = `
      INSERT INTO tasks (
        id, user_id, category_id, title, description, priority, status,
        due_date, reminder_date, start_date, estimated_minutes, tags,
        sort_order, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *
    `;

    const values = [
      taskId,
      userId,
      category_id || null,
      title,
      description || null,
      priority,
      status,
      due_date ? new Date(due_date) : null,
      reminder_date ? new Date(reminder_date) : null,
      start_date ? new Date(start_date) : null,
      estimated_minutes || null,
      JSON.stringify(tags),
      finalSortOrder,
      JSON.stringify(metadata),
      now,
      now
    ];

    try {
      const result = await this.query<Task>(insertQuery, values);
      const task = this.transformTask(result.rows[0]);
      
      logger.info('Task created successfully', {
        taskId: task.id,
        userId,
        title: task.title
      });

      const foundTask = await this.findByIdWithRelations(task.id, userId);
      if (!foundTask) {
        throw new Error('Failed to create task');
      }
      return foundTask;
    } catch (error) {
      logger.error('Error creating task', { error, userId, taskData });
      throw error;
    }
  }

  /**
   * Find task by ID
   */
  async findTaskById(id: string, userId: string, includeDeleted = false): Promise<Task | null> {
    const deletedCondition = includeDeleted ? '' : 'AND deleted_at IS NULL';
    
    const query = `
      SELECT * FROM tasks 
      WHERE id = $1 AND user_id = $2 ${deletedCondition}
    `;

    const result = await this.query<Task>(query, [id, userId]);
    return result.rows.length > 0 ? this.transformTask(result.rows[0]) : null;
  }

  /**
   * Find task by ID with relations (category, user)
   */
  async findByIdWithRelations(id: string, userId: string, includeDeleted = false): Promise<TaskWithRelations | null> {
    const deletedCondition = includeDeleted ? '' : 'AND t.deleted_at IS NULL';
    
    const query = `
      SELECT 
        t.*,
        c.id as category_id_rel,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        c.description as category_description,
        u.id as user_id_rel,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = $1 AND t.user_id = $2 ${deletedCondition}
    `;

    const result = await this.query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.transformTaskWithRelations(result.rows[0]);
  }

  /**
   * Update task
   */
  async update(id: string, userId: string, updateData: UpdateTaskData): Promise<TaskWithRelations | null> {
    const task = await this.findTaskById(id, userId);
    if (!task) {
      return null;
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        switch (key) {
          case 'due_date':
          case 'reminder_date':
          case 'start_date':
          case 'completed_at':
            updateFields.push(`${key} = $${paramCount}`);
            if (value && (typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
              values.push(new Date(value));
            } else {
              values.push(null);
            }
            break;
          case 'tags':
            updateFields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
            break;
          case 'metadata':
            updateFields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
            break;
          default:
            updateFields.push(`${key} = $${paramCount}`);
            values.push(value);
        }
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return await this.findByIdWithRelations(id, userId);
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    // Auto-set completed_at when status changes to completed
    if (updateData.status === 'completed' && !updateData.completed_at && task.status !== 'completed') {
      updateFields.push(`completed_at = $${paramCount}`);
      values.push(new Date());
      paramCount++;
      
      updateFields.push(`completed_by = $${paramCount}`);
      values.push(userId);
      paramCount++;
    } else if (updateData.status && updateData.status !== 'completed') {
      // Clear completed_at when status changes from completed
      updateFields.push(`completed_at = NULL, completed_by = NULL`);
    }

    values.push(id, userId);

    const updateQuery = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    try {
      const result = await this.query<Task>(updateQuery, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Task updated successfully', {
        taskId: id,
        userId,
        updatedFields: Object.keys(updateData)
      });

      return await this.findByIdWithRelations(id, userId);
    } catch (error) {
      logger.error('Error updating task', { error, taskId: id, userId, updateData });
      throw error;
    }
  }

  /**
   * Soft delete task
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const deleteQuery = `
      UPDATE tasks 
      SET deleted_at = $1, updated_at = $1
      WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
    `;

    const result = await this.query(deleteQuery, [new Date(), id, userId]);
    
    if (result.rowCount > 0) {
      logger.info('Task soft deleted', { taskId: id, userId });
      return true;
    }
    
    return false;
  }

  /**
   * Hard delete task (permanent)
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const deleteQuery = `
      DELETE FROM tasks 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.query(deleteQuery, [id, userId]);
    
    if (result.rowCount > 0) {
      logger.info('Task permanently deleted', { taskId: id, userId });
      return true;
    }
    
    return false;
  }

  /**
   * Restore soft deleted task
   */
  async restore(id: string, userId: string): Promise<TaskWithRelations | null> {
    const restoreQuery = `
      UPDATE tasks 
      SET deleted_at = NULL, updated_at = $1
      WHERE id = $2 AND user_id = $3 AND deleted_at IS NOT NULL
    `;

    const result = await this.query(restoreQuery, [new Date(), id, userId]);
    
    if (result.rowCount > 0) {
      logger.info('Task restored', { taskId: id, userId });
      return await this.findByIdWithRelations(id, userId);
    }
    
    return null;
  }

  // =====================================================
  // SEARCH AND FILTERING
  // =====================================================

  /**
   * Find tasks with advanced filtering and pagination
   */
  async findMany(
    userId: string,
    filters: TaskSearchFilters = {},
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const { whereClause, whereValues } = this.buildWhereClause(userId, filters);
    
    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      ${filters.category_id || filters.search ? 'LEFT JOIN categories c ON t.category_id = c.id' : ''}
      ${whereClause}
    `;

    // Data query with relations
    const dataQuery = `
      SELECT 
        t.*,
        c.id as category_id_rel,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        c.description as category_description,
        u.id as user_id_rel,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      ${whereClause}
      ORDER BY ${this.buildOrderClause(sortBy, sortOrder)}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        this.query<{ total: string }>(countQuery, whereValues),
        this.query(dataQuery, [...whereValues, limit, offset])
      ]);

      const total = parseInt(countResult.rows[0]?.total || '0');
      const tasks = dataResult.rows.map(row => this.transformTaskWithRelations(row));

      return {
        data: tasks,
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrevious: offset > 0
      };
    } catch (error) {
      logger.error('Error finding tasks', { error, userId, filters, options });
      throw error;
    }
  }

  /**
   * Search tasks by text (title, description, tags)
   */
  async searchTasks(
    userId: string,
    searchTerm: string,
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const filters: TaskSearchFilters = {
      search: searchTerm,
      include_archived: false
    };

    return this.findMany(userId, filters, options);
  }

  /**
   * Get tasks by status
   */
  async findByStatus(
    userId: string,
    status: TaskStatus | TaskStatus[],
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const filters: TaskSearchFilters = { status };
    return this.findMany(userId, filters, options);
  }

  /**
   * Get tasks by priority
   */
  async findByPriority(
    userId: string,
    priority: TaskPriority | TaskPriority[],
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const filters: TaskSearchFilters = { priority };
    return this.findMany(userId, filters, options);
  }

  /**
   * Get tasks by category
   */
  async findByCategory(
    userId: string,
    categoryId: string,
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const filters: TaskSearchFilters = { category_id: categoryId };
    return this.findMany(userId, filters, options);
  }

  /**
   * Get overdue tasks
   */
  async findOverdue(
    userId: string,
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const filters: TaskSearchFilters = {
      is_overdue: true,
      status: ['pending', 'in_progress']
    };
    return this.findMany(userId, filters, options);
  }

  /**
   * Get tasks due soon (within specified days)
   */
  async findDueSoon(
    userId: string,
    daysAhead = 7,
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const filters: TaskSearchFilters = {
      due_date_from: new Date().toISOString(),
      due_date_to: endDate.toISOString(),
      status: ['pending', 'in_progress']
    };

    return this.findMany(userId, filters, {
      ...options,
      sortBy: 'due_date',
      sortOrder: 'ASC'
    });
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * Bulk update tasks
   */
  async bulkUpdate(
    userId: string,
    taskIds: string[],
    updateData: Partial<UpdateTaskData>
  ): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      updated: 0,
      failed: [],
      errors: {}
    };

    if (taskIds.length === 0) {
      return result;
    }

    // First, verify all tasks belong to the user
    const verifyQuery = `
      SELECT id FROM tasks 
      WHERE id = ANY($1) AND user_id = $2 AND deleted_at IS NULL
    `;

    const verifyResult = await this.query<{ id: string }>(verifyQuery, [taskIds, userId]);
    const validTaskIds = verifyResult.rows.map(row => row.id);
    const invalidTaskIds = taskIds.filter(id => !validTaskIds.includes(id));

    // Mark invalid task IDs as failed
    invalidTaskIds.forEach(id => {
      result.failed.push(id);
      result.errors[id] = 'Task not found or access denied';
    });

    if (validTaskIds.length === 0) {
      return result;
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        switch (key) {
          case 'due_date':
          case 'reminder_date':
          case 'start_date':
          case 'completed_at':
            updateFields.push(`${key} = $${paramCount}`);
            if (value && (typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
              values.push(new Date(value));
            } else {
              values.push(null);
            }
            break;
          case 'tags':
            updateFields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
            break;
          case 'metadata':
            updateFields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
            break;
          default:
            updateFields.push(`${key} = $${paramCount}`);
            values.push(value);
        }
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return result;
    }

    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    values.push(validTaskIds, userId);

    const bulkUpdateQuery = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = ANY($${paramCount}) AND user_id = $${paramCount + 1} AND deleted_at IS NULL
    `;

    try {
      const updateResult = await this.query(bulkUpdateQuery, values);
      result.updated = updateResult.rowCount;

      logger.info('Bulk update completed', {
        userId,
        requestedCount: taskIds.length,
        updated: result.updated,
        failed: result.failed.length
      });

      return result;
    } catch (error) {
      logger.error('Error in bulk update', { error, userId, taskIds, updateData });
      throw error;
    }
  }

  /**
   * Bulk delete tasks
   */
  async bulkDelete(userId: string, taskIds: string[]): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      updated: 0,
      failed: [],
      errors: {}
    };

    if (taskIds.length === 0) {
      return result;
    }

    const deleteQuery = `
      UPDATE tasks 
      SET deleted_at = $1, updated_at = $1
      WHERE id = ANY($2) AND user_id = $3 AND deleted_at IS NULL
    `;

    try {
      const deleteResult = await this.query(deleteQuery, [new Date(), taskIds, userId]);
      result.updated = deleteResult.rowCount;

      const deletedIds = taskIds.slice(0, result.updated);
      const failedIds = taskIds.slice(result.updated);

      failedIds.forEach(id => {
        result.failed.push(id);
        result.errors[id] = 'Task not found or already deleted';
      });

      logger.info('Bulk delete completed', {
        userId,
        requestedCount: taskIds.length,
        deleted: result.updated,
        failed: result.failed.length
      });

      return result;
    } catch (error) {
      logger.error('Error in bulk delete', { error, userId, taskIds });
      throw error;
    }
  }

  // =====================================================
  // STATISTICS AND ANALYTICS
  // =====================================================

  /**
   * Get task statistics for a user
   */
  async getTaskStats(userId: string): Promise<TaskStats> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_tasks,
        COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed', 'archived') THEN 1 END) as overdue_tasks,
        COUNT(CASE WHEN due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' 
                   AND status NOT IN ('completed', 'archived') THEN 1 END) as upcoming_due,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
        COUNT(CASE WHEN priority = 'none' THEN 1 END) as none_priority,
        AVG(CASE WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
                 THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_completion_time_hours
      FROM tasks 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;

    const categoryStatsQuery = `
      SELECT 
        c.id as category_id,
        c.name as category_name,
        COUNT(t.id) as task_count
      FROM categories c
      LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = $1 AND t.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY task_count DESC
    `;

    try {
      const [statsResult, categoryResult] = await Promise.all([
        this.query<any>(statsQuery, [userId]),
        this.query<any>(categoryStatsQuery, [userId])
      ]);

      const stats = statsResult.rows[0];
      const categoryStats = categoryResult.rows;

      const totalTasks = parseInt(stats.total_tasks) || 0;
      const completedTasks = parseInt(stats.completed_tasks) || 0;

      return {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        pending_tasks: parseInt(stats.pending_tasks) || 0,
        in_progress_tasks: parseInt(stats.in_progress_tasks) || 0,
        archived_tasks: parseInt(stats.archived_tasks) || 0,
        overdue_tasks: parseInt(stats.overdue_tasks) || 0,
        upcoming_due: parseInt(stats.upcoming_due) || 0,
        completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        avg_completion_time_hours: stats.avg_completion_time_hours ? parseFloat(stats.avg_completion_time_hours) : undefined,
        tasks_by_priority: {
          high: parseInt(stats.high_priority) || 0,
          medium: parseInt(stats.medium_priority) || 0,
          low: parseInt(stats.low_priority) || 0,
          none: parseInt(stats.none_priority) || 0
        },
        tasks_by_status: {
          pending: parseInt(stats.pending_tasks) || 0,
          in_progress: parseInt(stats.in_progress_tasks) || 0,
          completed: completedTasks,
          archived: parseInt(stats.archived_tasks) || 0
        },
        tasks_by_category: categoryStats.map(cat => ({
          category_id: cat.category_id,
          category_name: cat.category_name,
          task_count: parseInt(cat.task_count) || 0
        }))
      };
    } catch (error) {
      logger.error('Error getting task statistics', { error, userId });
      throw error;
    }
  }

  // =====================================================
  // RELATIONSHIP OPERATIONS
  // =====================================================

  /**
   * Get tasks with category information
   */
  async findWithCategories(
    userId: string,
    options: TaskSortOptions = {}
  ): Promise<PaginatedResult<TaskWithRelations>> {
    return this.findMany(userId, {}, options);
  }

  /**
   * Get all tasks for a specific category
   */
  async findByCategoryWithStats(
    userId: string,
    categoryId: string
  ): Promise<{ tasks: TaskWithRelations[]; stats: TaskStats }> {
    const tasks = await this.findByCategory(userId, categoryId, { limit: 1000 });
    const stats = await this.getTaskStats(userId);

    return {
      tasks: tasks.data,
      stats
    };
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Check if task exists and belongs to user
   */
  async taskExists(id: string, userId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL';
    const result = await this.query(query, [id, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get next sort order for user's tasks
   */
  async getNextSortOrder(userId: string): Promise<number> {
    const query = 'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM tasks WHERE user_id = $1 AND deleted_at IS NULL';
    const result = await this.query<{ next_order: number }>(query, [userId]);
    return result.rows[0]?.next_order || 1;
  }

  /**
   * Reorder tasks
   */
  async reorderTasks(userId: string, taskOrders: Array<{ id: string; sort_order: number }>): Promise<void> {
    const client = await getDatabase().connect();
    
    try {
      await client.query('BEGIN');

      for (const { id, sort_order } of taskOrders) {
        await client.query(
          'UPDATE tasks SET sort_order = $1, updated_at = $2 WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL',
          [sort_order, new Date(), id, userId]
        );
      }

      await client.query('COMMIT');
      logger.info('Tasks reordered successfully', { userId, count: taskOrders.length });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reordering tasks', { error, userId, taskOrders });
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Transform database row to Task object
   */
  private transformTask(row: any): Task {
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
      metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
      due_date: row.due_date ? new Date(row.due_date) : undefined,
      reminder_date: row.reminder_date ? new Date(row.reminder_date) : undefined,
      start_date: row.start_date ? new Date(row.start_date) : undefined,
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }

  /**
   * Transform database row to TaskWithRelations object
   */
  private transformTaskWithRelations(row: any): TaskWithRelations {
    const task = this.transformTask(row);
    
    const result: TaskWithRelations = { ...task };

    // Add category if present
    if (row.category_id_rel) {
      result.category = {
        id: row.category_id_rel,
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
        description: row.category_description
      };
    }

    // Add user if present
    if (row.user_id_rel) {
      result.user = {
        id: row.user_id_rel,
        email: row.user_email,
        first_name: row.user_first_name,
        last_name: row.user_last_name
      };
    }

    return result;
  }

  /**
   * Build WHERE clause for filtering
   */
  private buildWhereClause(userId: string, filters: TaskSearchFilters): { whereClause: string; whereValues: any[] } {
    const conditions = ['t.user_id = $1'];
    const values = [userId];
    let paramCount = 2;

    // Include deleted tasks only if explicitly requested
    if (!filters.include_deleted) {
      conditions.push('t.deleted_at IS NULL');
    }

    // Search in title, description, and tags
    if (filters.search) {
      conditions.push(`(
        t.title ILIKE $${paramCount} OR 
        t.description ILIKE $${paramCount} OR 
        EXISTS (
          SELECT 1 FROM unnest(t.tags) as tag 
          WHERE tag ILIKE $${paramCount}
        )
      )`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    // Status filter
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (!filters.include_archived) {
        const filteredStatuses = statuses.filter(s => s !== 'archived');
        if (filteredStatuses.length > 0) {
          conditions.push(`t.status = ANY($${paramCount})`);
          values.push(filteredStatuses as any);
          paramCount++;
        }
      } else {
        conditions.push(`t.status = ANY($${paramCount})`);
        values.push(statuses as any);
        paramCount++;
      }
    } else if (!filters.include_archived) {
      conditions.push(`t.status != 'archived'`);
    }

    // Priority filter
    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      conditions.push(`t.priority = ANY($${paramCount})`);
      values.push(priorities as any);
      paramCount++;
    }

    // Category filter
    if (filters.category_id) {
      const categoryIds = Array.isArray(filters.category_id) ? filters.category_id : [filters.category_id];
      conditions.push(`t.category_id = ANY($${paramCount})`);
      values.push(categoryIds as any);
      paramCount++;
    }

    // Tags filter
    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      conditions.push(`t.tags && $${paramCount}`);
      values.push(JSON.stringify(tags));
      paramCount++;
    }

    // Date range filters
    if (filters.due_date_from) {
      conditions.push(`t.due_date >= $${paramCount}`);
      values.push(new Date(filters.due_date_from) as any);
      paramCount++;
    }

    if (filters.due_date_to) {
      conditions.push(`t.due_date <= $${paramCount}`);
      values.push(new Date(filters.due_date_to) as any);
      paramCount++;
    }

    if (filters.created_after) {
      conditions.push(`t.created_at >= $${paramCount}`);
      values.push(new Date(filters.created_after) as any);
      paramCount++;
    }

    if (filters.created_before) {
      conditions.push(`t.created_at <= $${paramCount}`);
      values.push(new Date(filters.created_before) as any);
      paramCount++;
    }

    if (filters.completed_after) {
      conditions.push(`t.completed_at >= $${paramCount}`);
      values.push(new Date(filters.completed_after) as any);
      paramCount++;
    }

    if (filters.completed_before) {
      conditions.push(`t.completed_at <= $${paramCount}`);
      values.push(new Date(filters.completed_before) as any);
      paramCount++;
    }

    // Boolean filters
    if (filters.has_due_date !== undefined) {
      conditions.push(filters.has_due_date ? 't.due_date IS NOT NULL' : 't.due_date IS NULL');
    }

    if (filters.has_category !== undefined) {
      conditions.push(filters.has_category ? 't.category_id IS NOT NULL' : 't.category_id IS NULL');
    }

    if (filters.is_overdue) {
      conditions.push(`t.due_date < NOW() AND t.status NOT IN ('completed', 'archived')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, whereValues: values };
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderClause(sortBy: string, sortOrder: string): string {
    const validSortFields = [
      'created_at', 'updated_at', 'due_date', 'priority', 'status', 'title', 'sort_order'
    ];

    const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Special handling for priority ordering
    if (field === 'priority') {
      return `
        CASE t.priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
          WHEN 'none' THEN 4 
        END ${order}`;
    }

    return `t.${field} ${order}`;
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();
export default taskRepository;
