/**
 * Enhanced Task Repository with Performance Optimizations
 * Integrates caching, bulk operations, and performance monitoring
 */

import { PoolClient } from 'pg';
import { BaseRepository, PaginatedResult, PaginationOptions } from './BaseRepository';
import { Task, TaskWithCategory, TaskFilter, CreateTaskRequest, UpdateTaskRequest } from '../models/task';
import { cacheService, CacheOptions } from '../services/cacheService';
import { performanceMonitor, MonitorQuery } from '../services/performanceMonitor';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EnhancedTaskRepository extends BaseRepository {
  constructor() {
    super('tasks');
  }

  /**
   * Find tasks by user ID with caching and performance optimization
   */
  @MonitorQuery
  async findByUserId(
    userId: string, 
    filters: TaskFilter = {}, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Task>> {
    const cacheKey = this.generateCacheKey('user-tasks', userId, filters, options);
    const cacheOptions: CacheOptions = {
      ttl: 300, // 5 minutes
      tags: [`user:${userId}`, 'tasks'],
    };

    return cacheService.cacheQuery(
      cacheKey,
      async () => {
        const query = this.buildTaskQuery(filters, options);
        const countQuery = this.buildTaskCountQuery(filters);
        
        const params = [userId, ...this.buildQueryParams(filters, options)];
        
        // Execute both queries in parallel
        const [dataResult, countResult] = await Promise.all([
          this.query<Task>(query, params),
          this.query<{ total: number }>(countQuery, [userId, ...this.buildCountParams(filters)])
        ]);

        const total = countResult.rows[0]?.total || 0;
        const { limit = 50, offset = 0 } = options;

        return {
          data: dataResult.rows,
          total,
          limit,
          offset,
          hasNext: offset + limit < total,
          hasPrevious: offset > 0,
        };
      },
      cacheOptions
    );
  }

  /**
   * Find task by ID with relations and caching
   */
  @MonitorQuery
  async findByIdWithRelations(id: string): Promise<TaskWithCategory | null> {
    const cacheKey = `task:${id}:with-relations`;
    const cacheOptions: CacheOptions = {
      ttl: 600, // 10 minutes
      tags: [`task:${id}`, 'tasks'],
    };

    return cacheService.cacheQuery(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            t.*,
            c.name as category_name,
            c.color as category_color,
            u.username as assigned_user_name
          FROM tasks t
          LEFT JOIN categories c ON t.category_id = c.id
          LEFT JOIN users u ON t.assigned_to = u.id
          WHERE t.id = $1 AND t.deleted_at IS NULL
        `;

        const result = await this.query<TaskWithCategory>(query, [id]);
        return result.rows[0] || null;
      },
      cacheOptions
    );
  }

  /**
   * Create task with cache invalidation
   */
  @MonitorQuery
  async createTask(userId: string, data: CreateTaskRequest): Promise<Task> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO tasks (
        id, user_id, title, description, priority, status, 
        due_date, category_id, tags, metadata, 
        created_at, updated_at, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
        COALESCE($13, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE user_id = $2))
      )
      RETURNING *
    `;

    const params = [
      id,
      userId,
      data.title,
      data.description || null,
      data.priority || 'none',
      'pending', // Default status
      data.due_date || null,
      data.category_id || null,
      JSON.stringify(data.tags || []),
      JSON.stringify({}), // Default empty metadata
      now,
      now,
      null, // Default sort_order
    ];

    const result = await this.query<Task>(query, params);
    const task = result.rows[0];

    // Invalidate related caches
    await this.invalidateUserCaches(userId);

    return task;
  }

  /**
   * Update task with optimistic caching
   */
  @MonitorQuery
  async updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'tags' || key === 'metadata') {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(value);
        }
        paramIndex++;
      }
    });

    updateFields.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    paramIndex++;

    params.push(id); // WHERE clause parameter

    const query = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.query<Task>(query, params);
    const task = result.rows[0];

    if (!task) {
      throw new Error('Task not found or already deleted');
    }

    // Invalidate related caches
    await this.invalidateTaskCaches(id, task.user_id);

    return task;
  }

  /**
   * Bulk update tasks for performance
   */
  @MonitorQuery
  async bulkUpdateTasks(updates: Array<{ id: string; data: UpdateTaskRequest }>): Promise<Task[]> {
    return this.transaction(async (client) => {
      const results: Task[] = [];

      for (const { id, data } of updates) {
        const task = await this.updateTaskInTransaction(client, id, data);
        results.push(task);
      }

      // Invalidate caches for all affected users
      const userIds = [...new Set(results.map(t => t.user_id))];
      for (const userId of userIds) {
        await this.invalidateUserCaches(userId);
      }

      return results;
    });
  }

  /**
   * Bulk delete tasks
   */
  @MonitorQuery
  async bulkDeleteTasks(taskIds: string[]): Promise<void> {
    const query = `
      UPDATE tasks 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1) AND deleted_at IS NULL
      RETURNING user_id
    `;

    const result = await this.query<{ user_id: string }>(query, [taskIds]);
    
    // Invalidate caches for affected users
    const userIds = [...new Set(result.rows.map(row => row.user_id))];
    for (const userId of userIds) {
      await this.invalidateUserCaches(userId);
    }
  }

  /**
   * Search tasks with full-text search and caching
   */
  @MonitorQuery
  async searchTasks(
    userId: string, 
    searchTerm: string, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Task>> {
    const cacheKey = this.generateCacheKey('search-tasks', userId, { search: searchTerm }, options);
    const cacheOptions: CacheOptions = {
      ttl: 180, // 3 minutes (shorter for search results)
      tags: [`user:${userId}`, 'tasks', 'search'],
    };

    return cacheService.cacheQuery(
      cacheKey,
      async () => {
        const { limit = 50, offset = 0 } = options;
        
        const query = `
          SELECT *,
                 ts_rank(
                   to_tsvector('english', title || ' ' || COALESCE(description, '')), 
                   plainto_tsquery('english', $2)
                 ) as rank
          FROM tasks
          WHERE user_id = $1 
            AND deleted_at IS NULL
            AND (
              to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $2)
              OR title ILIKE $3
              OR tags::text ILIKE $3
            )
          ORDER BY rank DESC, updated_at DESC
          LIMIT $4 OFFSET $5
        `;

        const countQuery = `
          SELECT COUNT(*) as total
          FROM tasks
          WHERE user_id = $1 
            AND deleted_at IS NULL
            AND (
              to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $2)
              OR title ILIKE $3
              OR tags::text ILIKE $3
            )
        `;

        const likePattern = `%${searchTerm}%`;
        const params = [userId, searchTerm, likePattern];

        const [dataResult, countResult] = await Promise.all([
          this.query<Task>(query, [...params, limit, offset]),
          this.query<{ total: number }>(countQuery, params)
        ]);

        const total = countResult.rows[0]?.total || 0;

        return {
          data: dataResult.rows,
          total,
          limit,
          offset,
          hasNext: offset + limit < total,
          hasPrevious: offset > 0,
        };
      },
      cacheOptions
    );
  }

  /**
   * Get task statistics with caching
   */
  @MonitorQuery
  async getTaskStatistics(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const cacheKey = `task-stats:${userId}`;
    const cacheOptions: CacheOptions = {
      ttl: 600, // 10 minutes
      tags: [`user:${userId}`, 'stats'],
    };

    return cacheService.cacheQuery(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
            COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'archived')) as overdue,
            jsonb_object_agg(
              COALESCE(priority, 'none'), 
              COUNT(*) FILTER (WHERE priority = priority OR (priority IS NULL AND 'none' = 'none'))
            ) as by_priority,
            jsonb_object_agg(
              COALESCE(c.name, 'Uncategorized'), 
              COUNT(*)
            ) as by_category
          FROM tasks t
          LEFT JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = $1 AND t.deleted_at IS NULL
        `;

        const result = await this.query(query, [userId]);
        const stats = result.rows[0];

        return {
          total: parseInt(stats.total) || 0,
          completed: parseInt(stats.completed) || 0,
          pending: parseInt(stats.pending) || 0,
          inProgress: parseInt(stats.in_progress) || 0,
          overdue: parseInt(stats.overdue) || 0,
          byPriority: stats.by_priority || {},
          byCategory: stats.by_category || {},
        };
      },
      cacheOptions
    );
  }

  // Helper methods

  private async updateTaskInTransaction(
    client: PoolClient, 
    id: string, 
    data: UpdateTaskRequest
  ): Promise<Task> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'tags' || key === 'metadata') {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(value);
        }
        paramIndex++;
      }
    });

    updateFields.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    paramIndex++;

    params.push(id);

    const query = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await client.query(query, params);
    return result.rows[0];
  }

  private async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(`user:${userId}`),
      cacheService.invalidateByTag('stats'),
      cacheService.invalidateByTag('search'),
    ]);
  }

  private async invalidateTaskCaches(taskId: string, userId: string): Promise<void> {
    await Promise.all([
      cacheService.invalidateByTag(`task:${taskId}`),
      cacheService.invalidateByTag(`user:${userId}`),
      cacheService.invalidateByTag('stats'),
      cacheService.invalidateByTag('search'),
    ]);
  }

  private generateCacheKey(prefix: string, ...parts: any[]): string {
    return `${prefix}:${parts.map(p => JSON.stringify(p)).join(':')}`;
  }

  private buildTaskQuery(filters: TaskFilter, options: PaginationOptions): string {
    const conditions: string[] = ['user_id = $1', 'deleted_at IS NULL'];
    const { sortBy = 'updated_at', sortOrder = 'DESC', limit = 50, offset = 0 } = options;

    // Add filter conditions
    if (filters.status) conditions.push('status = $' + (conditions.length + 1));
    if (filters.priority) conditions.push('priority = $' + (conditions.length + 1));
    if (filters.category_id) conditions.push('category_id = $' + (conditions.length + 1));
    if (filters.due_date_to) conditions.push('due_date <= $' + (conditions.length + 1));
    if (filters.due_date_from) conditions.push('due_date >= $' + (conditions.length + 1));

    return `
      SELECT * FROM tasks
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  private buildTaskCountQuery(filters: TaskFilter): string {
    const conditions: string[] = ['user_id = $1', 'deleted_at IS NULL'];

    if (filters.status) conditions.push('status = $' + (conditions.length + 1));
    if (filters.priority) conditions.push('priority = $' + (conditions.length + 1));
    if (filters.category_id) conditions.push('category_id = $' + (conditions.length + 1));
    if (filters.due_date_to) conditions.push('due_date <= $' + (conditions.length + 1));
    if (filters.due_date_from) conditions.push('due_date >= $' + (conditions.length + 1));

    return `
      SELECT COUNT(*) as total FROM tasks
      WHERE ${conditions.join(' AND ')}
    `;
  }

  private buildQueryParams(filters: TaskFilter, options: PaginationOptions): any[] {
    const params: any[] = [];

    if (filters.status) params.push(filters.status);
    if (filters.priority) params.push(filters.priority);
    if (filters.category_id) params.push(filters.category_id);
    if (filters.due_date_to) params.push(filters.due_date_to);
    if (filters.due_date_from) params.push(filters.due_date_from);

    return params;
  }

  private buildCountParams(filters: TaskFilter): any[] {
    const params: any[] = [];

    if (filters.status) params.push(filters.status);
    if (filters.priority) params.push(filters.priority);
    if (filters.category_id) params.push(filters.category_id);
    if (filters.due_date_to) params.push(filters.due_date_to);
    if (filters.due_date_from) params.push(filters.due_date_from);

    return params;
  }
}
