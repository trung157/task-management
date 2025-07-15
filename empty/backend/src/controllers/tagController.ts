import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class TagController {
  /**
   * Get all tags for the current user
   */
  public getTags = async (req: Request, res: Response): Promise<void> => {
    const { search } = req.query;
    const userId = req.user!.id;

    let query = `
      SELECT 
        id,
        name,
        color,
        description,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM task_tags tt JOIN tasks t ON tt.task_id = t.id 
         WHERE tt.tag_id = tags.id AND t.deleted_at IS NULL) as task_count
      FROM tags 
      WHERE user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (search) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY name ASC`;

    try {
      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Error fetching tags:', error);
      throw new AppError('Failed to fetch tags', 500, 'FETCH_TAGS_FAILED');
    }
  };

  /**
   * Create a new tag
   */
  public createTag = async (req: Request, res: Response): Promise<void> => {
    const { name, color = '#6366f1', description } = req.body;
    const userId = req.user!.id;
    const tagId = uuidv4();

    // Check if tag with same name already exists for this user
    const existingTag = await pool.query(
      'SELECT id FROM tags WHERE user_id = $1 AND name = $2',
      [userId, name]
    );

    if (existingTag.rows.length > 0) {
      throw new AppError('Tag with this name already exists', 409, 'TAG_EXISTS');
    }

    const query = `
      INSERT INTO tags (id, user_id, name, color, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [tagId, userId, name, color, description]);

      logger.info('Tag created successfully:', { tagId, userId });

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error creating tag:', error);
      throw new AppError('Failed to create tag', 500, 'CREATE_TAG_FAILED');
    }
  };

  /**
   * Update tag
   */
  public updateTag = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, color, description } = req.body;
    const userId = req.user!.id;

    // Check if tag exists and belongs to user
    const existingTag = await pool.query(
      'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingTag.rows.length === 0) {
      throw new AppError('Tag not found', 404, 'TAG_NOT_FOUND');
    }

    // Check if new name conflicts with existing tag
    if (name) {
      const nameConflict = await pool.query(
        'SELECT id FROM tags WHERE user_id = $1 AND name = $2 AND id != $3',
        [userId, name, id]
      );

      if (nameConflict.rows.length > 0) {
        throw new AppError('Tag with this name already exists', 409, 'TAG_EXISTS');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (color !== undefined) {
      updateFields.push(`color = $${paramIndex}`);
      updateValues.push(color);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) { // Only updated_at
      res.json({
        success: true,
        message: 'No changes made',
      });
      return;
    }

    updateValues.push(id);
    const updateQuery = `
      UPDATE tags 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await pool.query(updateQuery, updateValues);

      logger.info('Tag updated successfully:', { tagId: id, userId });

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      logger.error('Error updating tag:', error);
      throw new AppError('Failed to update tag', 500, 'UPDATE_TAG_FAILED');
    }
  };

  /**
   * Delete tag
   */
  public deleteTag = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if tag exists and belongs to user
      const existingTag = await client.query(
        'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (existingTag.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError('Tag not found', 404, 'TAG_NOT_FOUND');
      }

      // Remove tag associations from tasks
      await client.query('DELETE FROM task_tags WHERE tag_id = $1', [id]);

      // Delete the tag
      await client.query('DELETE FROM tags WHERE id = $1', [id]);

      await client.query('COMMIT');

      logger.info('Tag deleted successfully:', { tagId: id, userId });

      res.json({
        success: true,
        message: 'Tag deleted successfully',
      });

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting tag:', error);
      throw new AppError('Failed to delete tag', 500, 'DELETE_TAG_FAILED');
    } finally {
      client.release();
    }
  };

  /**
   * Get single tag by ID
   */
  public getTag = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    const query = `
      SELECT 
        id,
        name,
        color,
        description,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM task_tags tt JOIN tasks t ON tt.task_id = t.id 
         WHERE tt.tag_id = tags.id AND t.deleted_at IS NULL) as task_count
      FROM tags 
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        throw new AppError('Tag not found', 404, 'TAG_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching tag:', error);
      throw new AppError('Failed to fetch tag', 500, 'FETCH_TAG_FAILED');
    }
  };

  /**
   * Get tag statistics
   */
  public getTagStats = async (req: Request, res: Response): Promise<void> => {
    const { period = 'month', limit = 10 } = req.query;
    const userId = req.user!.id;

    const query = `
      SELECT 
        t.id,
        t.name,
        t.color,
        COUNT(tt.task_id) as usage_count,
        COUNT(CASE WHEN ta.status = 'completed' THEN 1 END) as completed_tasks
      FROM tags t
      LEFT JOIN task_tags tt ON t.id = tt.tag_id
      LEFT JOIN tasks ta ON tt.task_id = ta.id AND ta.deleted_at IS NULL
      WHERE t.user_id = $1
      GROUP BY t.id, t.name, t.color
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, Number(limit)]);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Error fetching tag statistics:', error);
      throw new AppError('Failed to fetch tag statistics', 500, 'FETCH_TAG_STATS_FAILED');
    }
  };

  /**
   * Get suggested tags based on task content
   */
  public getSuggestedTags = async (req: Request, res: Response): Promise<void> => {
    const { taskTitle, taskDescription, limit = 5 } = req.query;
    const userId = req.user!.id;

    // Simple suggestion based on existing tags that match keywords
    const searchTerms = [];
    if (taskTitle) searchTerms.push(String(taskTitle));
    if (taskDescription) searchTerms.push(String(taskDescription));
    
    const searchText = searchTerms.join(' ').toLowerCase();
    
    const query = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.color,
        COUNT(tt.task_id) as usage_count
      FROM tags t
      LEFT JOIN task_tags tt ON t.id = tt.tag_id
      WHERE t.user_id = $1
      AND (
        $2 ILIKE '%' || LOWER(t.name) || '%'
        OR LOWER(t.name) = ANY(string_to_array(LOWER($2), ' '))
      )
      GROUP BY t.id, t.name, t.color
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $3
    `;

    try {
      const result = await pool.query(query, [userId, searchText, Number(limit)]);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Error fetching suggested tags:', error);
      throw new AppError('Failed to fetch suggested tags', 500, 'FETCH_SUGGESTED_TAGS_FAILED');
    }
  };

  /**
   * Bulk delete tags
   */
  public bulkDelete = async (req: Request, res: Response): Promise<void> => {
    const { tagIds } = req.body;
    const userId = req.user!.id;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if all tags exist and belong to user
      const existingTags = await client.query(
        'SELECT id FROM tags WHERE id = ANY($1) AND user_id = $2',
        [tagIds, userId]
      );

      if (existingTags.rows.length !== tagIds.length) {
        await client.query('ROLLBACK');
        throw new AppError('Some tags not found', 404, 'TAGS_NOT_FOUND');
      }

      // Remove tag associations from tasks
      await client.query('DELETE FROM task_tags WHERE tag_id = ANY($1)', [tagIds]);

      // Delete the tags
      const deletedTags = await client.query(
        'DELETE FROM tags WHERE id = ANY($1) RETURNING id, name',
        [tagIds]
      );

      await client.query('COMMIT');

      logger.info('Bulk tag deletion completed:', { 
        userId, 
        deletedCount: deletedTags.rowCount 
      });

      res.json({
        success: true,
        data: {
          deletedTags: deletedTags.rows,
          deletedCount: deletedTags.rowCount,
        },
        message: `Successfully deleted ${deletedTags.rowCount} tag(s)`,
      });

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in bulk tag deletion:', error);
      throw new AppError('Failed to delete tags', 500, 'BULK_DELETE_TAGS_FAILED');
    } finally {
      client.release();
    }
  };

  /**
   * Merge tags - move all task associations from source tags to target tag
   */
  public mergeTags = async (req: Request, res: Response): Promise<void> => {
    const { sourceTagIds, targetTagId } = req.body;
    const userId = req.user!.id;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify all tags belong to user
      const allTagIds = [...sourceTagIds, targetTagId];
      const existingTags = await client.query(
        'SELECT id FROM tags WHERE id = ANY($1) AND user_id = $2',
        [allTagIds, userId]
      );

      if (existingTags.rows.length !== allTagIds.length) {
        await client.query('ROLLBACK');
        throw new AppError('Some tags not found', 404, 'TAGS_NOT_FOUND');
      }

      // Move task associations from source tags to target tag
      await client.query(`
        INSERT INTO task_tags (task_id, tag_id)
        SELECT DISTINCT tt.task_id, $1
        FROM task_tags tt
        WHERE tt.tag_id = ANY($2)
        AND NOT EXISTS (
          SELECT 1 FROM task_tags tt2 
          WHERE tt2.task_id = tt.task_id AND tt2.tag_id = $1
        )
      `, [targetTagId, sourceTagIds]);

      // Remove old associations
      await client.query(
        'DELETE FROM task_tags WHERE tag_id = ANY($1)',
        [sourceTagIds]
      );

      // Delete source tags
      const deletedTags = await client.query(
        'DELETE FROM tags WHERE id = ANY($1) RETURNING name',
        [sourceTagIds]
      );

      // Get target tag info
      const targetTag = await client.query(
        'SELECT name FROM tags WHERE id = $1',
        [targetTagId]
      );

      await client.query('COMMIT');

      logger.info('Tag merge completed:', { 
        userId, 
        sourceTagIds, 
        targetTagId,
        mergedCount: deletedTags.rowCount 
      });

      res.json({
        success: true,
        data: {
          targetTag: targetTag.rows[0],
          mergedTags: deletedTags.rows,
          mergedCount: deletedTags.rowCount,
        },
        message: `Successfully merged ${deletedTags.rowCount} tag(s) into ${targetTag.rows[0].name}`,
      });

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in tag merge:', error);
      throw new AppError('Failed to merge tags', 500, 'MERGE_TAGS_FAILED');
    } finally {
      client.release();
    }
  };
}
