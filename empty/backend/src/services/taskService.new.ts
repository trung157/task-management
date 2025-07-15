/**
 * Task Service
 * 
 * Business logic layer for task management with:
 * - Task CRUD operations
 * - Business rule validation
 * - Task relationship management
 * - Statistics and analytics
 * - Notification handling
 */

import { taskRepository } from '../repositories/taskRepository';
import { 
  Task, 
  TaskWithRelations, 
  CreateTaskData, 
  UpdateTaskData, 
  TaskSearchFilters, 
  TaskSortOptions, 
  TaskStats,
  BulkUpdateResult
} from '../repositories/taskRepository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class TaskService {
  
  // =====================================================
  // CORE CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new task
   */
  async createTask(userId: string, taskData: CreateTaskData): Promise<TaskWithRelations> {
    try {
      // Validate required fields
      if (!taskData.title?.trim()) {
        throw new AppError('Task title is required', 400);
      }

      // Set default values
      const enrichedTaskData: CreateTaskData = {
        ...taskData,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        tags: taskData.tags || [],
        metadata: taskData.metadata || {}
      };

      // Create task
      const task = await taskRepository.createTask(userId, enrichedTaskData);
      
      logger.info('Task created successfully', {
        taskId: task.id,
        userId,
        title: task.title
      });

      return task;
    } catch (error) {
      logger.error('Error creating task', { error, userId, taskData });
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: string, userId: string): Promise<TaskWithRelations | null> {
    try {
      const task = await taskRepository.findByIdWithRelations(taskId, userId);
      
      if (!task) {
        return null;
      }

      return task;
    } catch (error) {
      logger.error('Error getting task', { error, taskId, userId });
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, userId: string, updateData: UpdateTaskData): Promise<TaskWithRelations | null> {
    try {
      // Check if task exists and belongs to user
      const existingTask = await taskRepository.findTaskById(taskId, userId);
      if (!existingTask) {
        throw new AppError('Task not found', 404);
      }

      // Validate business rules
      await this.validateTaskUpdate(existingTask, updateData);

      // Auto-complete timestamps
      if (updateData.status === 'completed' && !updateData.completed_at) {
        updateData.completed_at = new Date();
        updateData.completed_by = userId;
      }

      // Update task
      const updatedTask = await taskRepository.update(taskId, userId, updateData);
      
      if (!updatedTask) {
        throw new AppError('Failed to update task', 500);
      }

      logger.info('Task updated successfully', {
        taskId,
        userId,
        changes: Object.keys(updateData)
      });

      return updatedTask;
    } catch (error) {
      logger.error('Error updating task', { error, taskId, userId, updateData });
      throw error;
    }
  }

  /**
   * Delete task (soft delete)
   */
  async deleteTask(taskId: string, userId: string): Promise<boolean> {
    try {
      const result = await taskRepository.delete(taskId, userId);
      
      if (result) {
        logger.info('Task deleted successfully', { taskId, userId });
      }

      return result;
    } catch (error) {
      logger.error('Error deleting task', { error, taskId, userId });
      throw error;
    }
  }

  /**
   * Restore deleted task
   */
  async restoreTask(taskId: string, userId: string): Promise<TaskWithRelations | null> {
    try {
      const result = await taskRepository.restore(taskId, userId);
      
      if (result) {
        logger.info('Task restored successfully', { taskId, userId });
        return await this.getTaskById(taskId, userId);
      }

      return null;
    } catch (error) {
      logger.error('Error restoring task', { error, taskId, userId });
      throw error;
    }
  }

  // =====================================================
  // SEARCH AND FILTERING
  // =====================================================

  /**
   * Search tasks with filters and pagination
   */
  async searchTasks(
    userId: string, 
    filters: TaskSearchFilters = {}, 
    options: TaskSortOptions = {}
  ) {
    try {
      // Add user filter (filters already include user_id if needed)
      const result = await taskRepository.findMany(userId, filters, options);
      
      logger.debug('Task search completed', {
        userId,
        filters,
        resultCount: result.data.length,
        total: result.total
      });

      return result;
    } catch (error) {
      logger.error('Error searching tasks', { error, userId, filters, options });
      throw error;
    }
  }

  /**
   * Get user tasks with default filters
   */
  async getUserTasks(userId: string, options: TaskSortOptions = {}) {
    return this.searchTasks(userId, { include_archived: false }, options);
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(userId: string) {
    return this.searchTasks(userId, { is_overdue: true, include_archived: false });
  }

  /**
   * Get upcoming tasks (due in next 7 days)
   */
  async getUpcomingTasks(userId: string) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.searchTasks(userId, {
      due_date_from: new Date(),
      due_date_to: nextWeek,
      include_archived: false
    });
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(userId: string, status: string | string[]) {
    return this.searchTasks(userId, { status: status as any });
  }

  /**
   * Get tasks by category
   */
  async getTasksByCategory(userId: string, categoryId: string) {
    return this.searchTasks(userId, { category_id: categoryId });
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * Bulk update tasks
   */
  async bulkUpdateTasks(
    userId: string, 
    taskIds: string[], 
    updateData: UpdateTaskData
  ): Promise<BulkUpdateResult> {
    try {
      // Validate all tasks belong to user
      const validationPromises = taskIds.map(id => 
        taskRepository.taskExists(id, userId)
      );
      const validations = await Promise.all(validationPromises);
      
      const invalidIds = taskIds.filter((_, index) => !validations[index]);
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid task IDs: ${invalidIds.join(', ')}`, 400);
      }

      const result = await taskRepository.bulkUpdate(userId, taskIds, updateData);
      
      logger.info('Bulk update completed', {
        userId,
        taskCount: taskIds.length,
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
  async bulkDeleteTasks(userId: string, taskIds: string[]): Promise<BulkUpdateResult> {
    try {
      const result = await taskRepository.bulkDelete(userId, taskIds);
      
      logger.info('Bulk delete completed', {
        userId,
        taskCount: taskIds.length,
        deleted: result.updated
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
   * Get user task statistics
   */
  async getTaskStats(userId: string): Promise<TaskStats> {
    try {
      const stats = await taskRepository.getTaskStats(userId);
      
      logger.debug('Task stats retrieved', { userId, stats });

      return stats;
    } catch (error) {
      logger.error('Error getting task stats', { error, userId });
      throw error;
    }
  }

  // =====================================================
  // VALIDATION HELPERS
  // =====================================================

  /**
   * Validate task update business rules
   */
  private async validateTaskUpdate(existingTask: Task, updateData: UpdateTaskData): Promise<void> {
    // Cannot change completed task back to pending without explicit action
    if (existingTask.status === 'completed' && 
        updateData.status && 
        updateData.status !== 'completed' && 
        !updateData.completed_at) {
      // Allow status change but reset completion data
      updateData.completed_at = null;
      updateData.completed_by = null;
    }

    // Cannot set due date in the past (warn but allow)
    if (updateData.due_date && new Date(updateData.due_date) < new Date()) {
      logger.warn('Setting due date in the past', {
        taskId: existingTask.id,
        dueDate: updateData.due_date
      });
    }

    // Validate priority
    if (updateData.priority && !['high', 'medium', 'low', 'none'].includes(updateData.priority)) {
      throw new AppError('Invalid priority value', 400);
    }

    // Validate status
    if (updateData.status && !['pending', 'in_progress', 'completed', 'archived'].includes(updateData.status)) {
      throw new AppError('Invalid status value', 400);
    }
  }
}

// Export singleton instance
export const taskService = new TaskService();
export default taskService;
