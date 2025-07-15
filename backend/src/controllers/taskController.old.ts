import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class TaskController {
  /**
   * Helper method to get authenticated user ID
   */
  private getUserId(req: Request): string {
    if (!req.user?.id) {
      throw new AppError('User authentication required', 401);
    }
    return req.user.id;
  }

  /**
   * Get all tasks with filtering and pagination
   */
  public getTasks = async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      tags,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    const userId = this.getUserId(req);
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT DISTINCT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.created_at,
        t.updated_at,
        t.completed_at,
        ARRAY_AGG(
          DISTINCT jsonb_build_object(
            'id', tag.id,
            'name', tag.name,
            'color', tag.color
          )
        ) FILTER (WHERE tag.id IS NOT NULL) AS tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN tags tag ON tt.tag_id = tag.id
      WHERE t.user_id = $1 AND t.deleted_at IS NULL
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filters
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.search_vector @@ plainto_tsquery($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tags) {
      const tagArray = (tags as string).split(',');
      query += ` AND tag.name = ANY($${paramIndex})`;
      params.push(tagArray);
      paramIndex++;
    }

    // Group by task fields
    query += ` GROUP BY t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.updated_at, t.completed_at`;

    // Order by
    const validSortFields = ['created_at', 'updated_at', 'due_date', 'priority', 'title'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY t.${sortField} ${sortDirection}`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    try {
      const result = await pool.query(query, params);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM tasks t
        LEFT JOIN task_tags tt ON t.id = tt.task_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1 AND t.deleted_at IS NULL
        ${status ? 'AND t.status = $2' : ''}
        ${priority ? `AND t.priority = $${status ? 3 : 2}` : ''}
        ${search ? `AND (t.title ILIKE $${params.length - 2} OR t.description ILIKE $${params.length - 2})` : ''}
        ${tags ? `AND tag.name = ANY($${params.length - 3})` : ''}
      `;

      const countParams: any[] = [userId];
      if (status) countParams.push(String(status));
      if (priority) countParams.push(String(priority));
      if (search) countParams.push(`%${String(search)}%`);
      if (tags) {
        const tagArray = typeof tags === 'string' ? tags.split(',') : [String(tags)];
        countParams.push(tagArray);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        success: true,
        data: {
          tasks: result.rows,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching tasks:', error);
      throw new AppError('Failed to fetch tasks', 500, 'FETCH_TASKS_FAILED');
    }
  };

  /**
   * Get single task by ID
   */
  public getTask = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = this.getUserId(req);

    const query = `
      SELECT DISTINCT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.created_at,
        t.updated_at,
        t.completed_at,
        ARRAY_AGG(
          DISTINCT jsonb_build_object(
            'id', tag.id,
            'name', tag.name,
            'color', tag.color
          )
        ) FILTER (WHERE tag.id IS NOT NULL) AS tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN tags tag ON tt.tag_id = tag.id
      WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL
      GROUP BY t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.updated_at, t.completed_at
    `;

    try {
      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching task:', error);
      throw new AppError('Failed to fetch task', 500, 'FETCH_TASK_FAILED');
    }
  };

  /**
   * Get tasks due soon
   */
  public getTasksDueSoon = async (req: Request, res: Response): Promise<void> => {
    const { days = 3 } = req.query;
    const userId = this.getUserId(req);
    const daysAhead = Number(days);

    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.priority,
        t.due_date,
        t.status,
        ARRAY_AGG(
          DISTINCT jsonb_build_object(
            'id', tag.id,
            'name', tag.name,
            'color', tag.color
          )
        ) FILTER (WHERE tag.id IS NOT NULL) AS tags
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN tags tag ON tt.tag_id = tag.id
      WHERE t.user_id = $1 
        AND t.deleted_at IS NULL 
        AND t.status != 'completed'
        AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysAhead} days'
      GROUP BY t.id, t.title, t.description, t.priority, t.due_date, t.status
      ORDER BY t.due_date ASC, t.priority DESC
    `;

    try {
      const result = await pool.query(query, [userId]);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Error fetching tasks due soon:', error);
      throw new AppError('Failed to fetch tasks due soon', 500, 'FETCH_DUE_SOON_FAILED');
    }
  };

  /**
   * Create new task
   */
  public createTask = async (req: Request, res: Response): Promise<void> => {
    const { title, description, priority = 'medium', status = 'pending', due_date, tags = [] } = req.body;
    const userId = this.getUserId(req);
    const taskId = uuidv4();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert task
      const taskQuery = `
        INSERT INTO tasks (id, user_id, title, description, priority, status, due_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;

      const taskResult = await client.query(taskQuery, [
        taskId,
        userId,
        title,
        description,
        priority,
        status,
        due_date,
      ]);

      const task = taskResult.rows[0];

      // Handle tags
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          // Insert or get tag
          const tagQuery = `
            INSERT INTO tags (id, user_id, name, created_at, updated_at) 
            VALUES ($1, $2, $3, NOW(), NOW()) 
            ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `;
          const tagResult = await client.query(tagQuery, [uuidv4(), userId, tagName]);
          
          let tagId = tagResult.rows[0]?.id;
          
          if (!tagId) {
            // Tag already exists, get its ID
            const getTagQuery = 'SELECT id FROM tags WHERE name = $1 AND user_id = $2';
            const existingTag = await client.query(getTagQuery, [tagName, userId]);
            tagId = existingTag.rows[0].id;
          }

          // Link task to tag
          await client.query(
            'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [taskId, tagId]
          );
        }
      }

      await client.query('COMMIT');

      // Get the created task with tags
      const finalQuery = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date,
          t.created_at,
          t.updated_at,
          t.completed_at,
          ARRAY_AGG(
            DISTINCT jsonb_build_object(
              'id', tag.id,
              'name', tag.name,
              'color', tag.color
            )
          ) FILTER (WHERE tag.id IS NOT NULL) AS tags
        FROM tasks t
        LEFT JOIN task_tags tt ON t.id = tt.task_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.id = $1
        GROUP BY t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.updated_at, t.completed_at
      `;

      const finalResult = await client.query(finalQuery, [taskId]);

      logger.info('Task created successfully:', { taskId, userId });

      res.status(201).json({
        success: true,
        data: finalResult.rows[0],
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating task:', error);
      throw new AppError('Failed to create task', 500, 'CREATE_TASK_FAILED');
    } finally {
      client.release();
    }
  };

  /**
   * Update task
   */
  public updateTask = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, description, priority, status, due_date, tags } = req.body;
    const userId = this.getUserId(req);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if task exists and belongs to user
      const checkQuery = 'SELECT id FROM tasks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL';
      const checkResult = await client.query(checkQuery, [id, userId]);

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex}`);
        updateValues.push(title);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateValues.push(description);
        paramIndex++;
      }

      if (priority !== undefined) {
        updateFields.push(`priority = $${paramIndex}`);
        updateValues.push(priority);
        paramIndex++;
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(status);
        paramIndex++;

        // Handle completion
        if (status === 'completed') {
          updateFields.push(`completed_at = NOW()`);
        } else {
          updateFields.push(`completed_at = NULL`);
        }
      }

      if (due_date !== undefined) {
        updateFields.push(`due_date = $${paramIndex}`);
        updateValues.push(due_date);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length > 1) { // More than just updated_at
        updateValues.push(id);
        const updateQuery = `
          UPDATE tasks 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;

        await client.query(updateQuery, updateValues);
      }

      // Handle tags update
      if (tags !== undefined) {
        // Remove existing tags
        await client.query('DELETE FROM task_tags WHERE task_id = $1', [id]);

        // Add new tags
        if (tags.length > 0) {
          for (const tagName of tags) {
            const tagQuery = `
              INSERT INTO tags (id, user_id, name, created_at, updated_at) 
              VALUES ($1, $2, $3, NOW(), NOW()) 
              ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW()
              RETURNING id
            `;
            const tagResult = await client.query(tagQuery, [uuidv4(), userId, tagName]);
            
            let tagId = tagResult.rows[0]?.id;
            
            if (!tagId) {
              const getTagQuery = 'SELECT id FROM tags WHERE name = $1 AND user_id = $2';
              const existingTag = await client.query(getTagQuery, [tagName, userId]);
              tagId = existingTag.rows[0].id;
            }

            await client.query(
              'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [id, tagId]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Return updated task
      const finalQuery = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date,
          t.created_at,
          t.updated_at,
          t.completed_at,
          ARRAY_AGG(
            DISTINCT jsonb_build_object(
              'id', tag.id,
              'name', tag.name,
              'color', tag.color
            )
          ) FILTER (WHERE tag.id IS NOT NULL) AS tags
        FROM tasks t
        LEFT JOIN task_tags tt ON t.id = tt.task_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.id = $1
        GROUP BY t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.updated_at, t.completed_at
      `;

      const finalResult = await client.query(finalQuery, [id]);

      logger.info('Task updated successfully:', { taskId: id, userId });

      res.json({
        success: true,
        data: finalResult.rows[0],
      });

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating task:', error);
      throw new AppError('Failed to update task', 500, 'UPDATE_TASK_FAILED');
    } finally {
      client.release();
    }
  };

  /**
   * Delete task (soft delete)
   */
  public deleteTask = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = this.getUserId(req);

    const query = `
      UPDATE tasks 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      logger.info('Task deleted successfully:', { taskId: id, userId });

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting task:', error);
      throw new AppError('Failed to delete task', 500, 'DELETE_TASK_FAILED');
    }
  };

  /**
   * Update task status
   */
  public updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = this.getUserId(req);

    const query = `
      UPDATE tasks 
      SET 
        status = $1,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [status, id, userId]);

      if (result.rows.length === 0) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      logger.info('Task status updated successfully:', { taskId: id, status, userId });

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating task status:', error);
      throw new AppError('Failed to update task status', 500, 'UPDATE_STATUS_FAILED');
    }
  };

  /**
   * Get task statistics
   */
  public getTaskStats = async (req: Request, res: Response): Promise<void> => {
    const userId = this.getUserId(req);

    const query = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'completed') as overdue_tasks,
        COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status != 'completed') as due_today_tasks
      FROM tasks 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await pool.query(query, [userId]);

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error fetching task stats:', error);
      throw new AppError('Failed to fetch task statistics', 500, 'FETCH_STATS_FAILED');
    }
  };

  /**
   * Bulk update task status
   */
  public bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
    const { taskIds, status } = req.body;
    const userId = this.getUserId(req);

    const query = `
      UPDATE tasks 
      SET 
        status = $1,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ANY($2) AND user_id = $3 AND deleted_at IS NULL
      RETURNING id, title, status
    `;

    try {
      const result = await pool.query(query, [status, taskIds, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError('No tasks found to update', 404, 'TASKS_NOT_FOUND');
      }

      logger.info('Bulk status update completed:', { 
        userId, 
        updatedCount: result.rowCount, 
        status 
      });

      res.json({
        success: true,
        data: {
          updatedTasks: result.rows,
          updatedCount: result.rowCount,
        },
        message: `Successfully updated ${result.rowCount} task(s) to ${status}`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in bulk status update:', error);
      throw new AppError('Failed to update task statuses', 500, 'BULK_UPDATE_FAILED');
    }
  };

  /**
   * Bulk delete tasks (soft delete)
   */
  public bulkDelete = async (req: Request, res: Response): Promise<void> => {
    const { taskIds } = req.body;
    const userId = this.getUserId(req);

    const query = `
      UPDATE tasks 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1) AND user_id = $2 AND deleted_at IS NULL
      RETURNING id, title
    `;

    try {
      const result = await pool.query(query, [taskIds, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError('No tasks found to delete', 404, 'TASKS_NOT_FOUND');
      }

      logger.info('Bulk delete completed:', { 
        userId, 
        deletedCount: result.rowCount 
      });

      res.json({
        success: true,
        data: {
          deletedTasks: result.rows,
          deletedCount: result.rowCount,
        },
        message: `Successfully deleted ${result.rowCount} task(s)`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in bulk delete:', error);
      throw new AppError('Failed to delete tasks', 500, 'BULK_DELETE_FAILED');
    }
  };

  /**
   * Archive old completed tasks
   */
  public archiveOldTasks = async (req: Request, res: Response): Promise<void> => {
    const { daysOld = 30 } = req.body;
    const userId = this.getUserId(req);

    const query = `
      UPDATE tasks 
      SET status = 'archived', updated_at = NOW()
      WHERE user_id = $1 
        AND status = 'completed' 
        AND completed_at < CURRENT_DATE - INTERVAL '${daysOld} days'
        AND deleted_at IS NULL
      RETURNING id, title
    `;

    try {
      const result = await pool.query(query, [userId]);

      logger.info('Old completed tasks archived:', { 
        userId, 
        archivedCount: result.rowCount 
      });

      res.json({
        success: true,
        data: {
          archivedTasks: result.rows,
          archivedCount: result.rowCount,
        },
        message: `Successfully archived ${result.rowCount} old completed task(s)`,
      });
    } catch (error) {
      logger.error('Error archiving old completed tasks:', error);
      throw new AppError('Failed to archive old completed tasks', 500, 'ARCHIVE_FAILED');
    }
  };
}
