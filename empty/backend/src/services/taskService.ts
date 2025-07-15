/**
 * Enhanced Task Service
 * 
 * Comprehensive business logic layer for task management with:
 * - Advanced CRUD operations with validation
 * - Business rule enforcement
 * - Priority and due date management
 * - Task relationship handling
 * - Statistics and analytics
 * - Notification scheduling
 * - Performance optimization
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
import { TaskNotificationHooks } from '../hooks/taskNotificationHooks';
import { AdvancedTaskNotificationService } from './advancedTaskNotificationService';

// Enhanced types for business logic
export interface TaskValidationOptions {
  allowPastDueDates?: boolean;
  requireDescription?: boolean;
  maxTitleLength?: number;
  maxTagCount?: number;
}

export interface TaskPriorityMetrics {
  urgencyScore: number;
  priorityWeight: number;
  dueDateFactor: number;
  finalScore: number;
}

export interface DueDateAnalysis {
  daysUntilDue: number;
  isOverdue: boolean;
  isUpcoming: boolean;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
}

export interface TaskBusinessRules {
  maxDescriptionLength: number;
  maxTitleLength: number;
  maxTagCount: number;
  defaultReminderMinutes: number;
  priorityWeights: Record<string, number>;
  statusTransitions: Record<string, string[]>;
}

export class TaskService {
  private readonly notificationHooks: TaskNotificationHooks;
  private readonly notificationService: AdvancedTaskNotificationService;
  
  constructor() {
    this.notificationHooks = TaskNotificationHooks.getInstance();
    this.notificationService = AdvancedTaskNotificationService.getInstance();
  }
  
  private readonly businessRules: TaskBusinessRules = {
    maxDescriptionLength: 5000,
    maxTitleLength: 500,
    maxTagCount: 20,
    defaultReminderMinutes: 60,
    priorityWeights: {
      'high': 7,
      'medium': 5,
      'low': 3,
      'none': 1
    },
    statusTransitions: {
      'pending': ['in_progress', 'completed', 'archived'],
      'in_progress': ['completed', 'pending', 'archived'],
      'completed': ['archived'],
      'archived': []
    }
  };

  // =====================================================
  // ENHANCED CRUD OPERATIONS
  // =====================================================

  /**
   * Create a new task with comprehensive validation and business logic
   */
  async createTask(userId: string, taskData: CreateTaskData, options: TaskValidationOptions = {}): Promise<TaskWithRelations> {
    try {
      // Validate input data
      await this.validateTaskData(taskData, options);

      // Enrich task data with business logic
      const enrichedTaskData = await this.enrichTaskData(userId, taskData);

      // Create task
      const task = await taskRepository.createTask(userId, enrichedTaskData);
      
      // Post-creation actions
      await this.handlePostCreationActions(task);

      logger.info('Task created successfully', {
        taskId: task.id,
        userId,
        title: task.title,
        priority: task.priority,
        dueDate: task.due_date
      });

      return task;
    } catch (error) {
      logger.error('Error creating task', { error, userId, taskData });
      throw error;
    }
  }

  /**
   * Get task by ID with business context
   */
  async getTaskById(taskId: string, userId: string): Promise<TaskWithRelations | null> {
    try {
      const task = await taskRepository.findByIdWithRelations(taskId, userId);
      
      if (!task) {
        return null;
      }

      // Add computed business fields
      return this.enhanceTaskWithBusinessData(task);
    } catch (error) {
      logger.error('Error getting task', { error, taskId, userId });
      throw error;
    }
  }

  /**
   * Update task with advanced validation and business rules
   */
  async updateTask(
    taskId: string, 
    userId: string, 
    updateData: UpdateTaskData, 
    options: TaskValidationOptions = {}
  ): Promise<TaskWithRelations | null> {
    try {
      // Get existing task
      const existingTask = await taskRepository.findTaskById(taskId, userId);
      if (!existingTask) {
        throw new AppError('Task not found', 404);
      }

      // Validate update data
      await this.validateTaskUpdate(existingTask, updateData, options);

      // Apply business logic to update data
      const processedUpdateData = await this.processTaskUpdate(existingTask, updateData);

      // Perform update
      const updatedTask = await taskRepository.update(taskId, userId, processedUpdateData);
      
      if (!updatedTask) {
        throw new AppError('Failed to update task', 500);
      }

      // Handle post-update actions
      await this.handlePostUpdateActions(existingTask, updatedTask);

      logger.info('Task updated successfully', {
        taskId,
        userId,
        changes: Object.keys(updateData),
        statusChange: existingTask.status !== updatedTask.status
      });

      return this.enhanceTaskWithBusinessData(updatedTask);
    } catch (error) {
      logger.error('Error updating task', { error, taskId, userId, updateData });
      throw error;
    }
  }

  /**
   * Delete task with validation
   */
  async deleteTask(taskId: string, userId: string, force: boolean = false): Promise<boolean> {
    try {
      // Validate deletion
      if (!force) {
        await this.validateTaskDeletion(taskId, userId);
      }

      const result = await taskRepository.delete(taskId, userId);
      
      if (result) {
        await this.handlePostDeletionActions(taskId, userId);
        logger.info('Task deleted successfully', { taskId, userId, force });
      }

      return result;
    } catch (error) {
      logger.error('Error deleting task', { error, taskId, userId });
      throw error;
    }
  }

  // =====================================================
  // PRIORITY MANAGEMENT
  // =====================================================

  /**
   * Calculate task priority metrics
   */
  calculatePriorityMetrics(task: Task): TaskPriorityMetrics {
    const priorityWeight = this.businessRules.priorityWeights[task.priority] || 1;
    
    let dueDateFactor = 1;
    let urgencyScore = priorityWeight;

    if (task.due_date) {
      const daysUntilDue = this.calculateDaysUntilDue(task.due_date);
      
      if (daysUntilDue < 0) {
        // Overdue
        dueDateFactor = 3;
        urgencyScore += Math.abs(daysUntilDue) * 0.5;
      } else if (daysUntilDue <= 1) {
        // Due today or tomorrow
        dueDateFactor = 2.5;
      } else if (daysUntilDue <= 3) {
        // Due this week
        dueDateFactor = 2;
      } else if (daysUntilDue <= 7) {
        // Due next week
        dueDateFactor = 1.5;
      }
    }

    const finalScore = priorityWeight * dueDateFactor + urgencyScore;

    return {
      urgencyScore,
      priorityWeight,
      dueDateFactor,
      finalScore
    };
  }

  /**
   * Auto-adjust task priorities based on due dates and completion status
   */
  async autoAdjustPriorities(userId: string): Promise<number> {
    try {
      const tasks = await this.searchTasks(userId, { 
        status: ['pending', 'in_progress'],
        include_archived: false 
      });

      let adjustedCount = 0;

      for (const task of tasks.data) {
        const metrics = this.calculatePriorityMetrics(task);
        let newPriority = task.priority;

        // Suggest priority adjustments based on urgency
        if (metrics.finalScore >= 20 && task.priority !== 'high') {
          newPriority = 'high';
        } else if (metrics.finalScore >= 15 && task.priority === 'low') {
          newPriority = 'medium';
        } else if (metrics.finalScore >= 10 && task.priority === 'none') {
          newPriority = 'low';
        }

        if (newPriority !== task.priority) {
          await this.updateTask(task.id, userId, { priority: newPriority });
          adjustedCount++;
        }
      }

      logger.info('Auto-adjusted task priorities', { userId, adjustedCount });
      return adjustedCount;
    } catch (error) {
      logger.error('Error auto-adjusting priorities', { error, userId });
      throw error;
    }
  }

  /**
   * Get priority recommendations for a task
   */
  getPriorityRecommendation(task: Task): {
    recommended: string;
    reason: string;
    confidence: number;
  } {
    const metrics = this.calculatePriorityMetrics(task);
    const dueAnalysis = this.analyzeDueDate(task.due_date);

    let recommended = task.priority;
    let reason = 'Current priority is appropriate';
    let confidence = 0.7;

    if (dueAnalysis.isOverdue) {
      recommended = 'high';
      reason = 'Task is overdue and needs immediate attention';
      confidence = 0.95;
    } else if (dueAnalysis.urgencyLevel === 'critical' && task.priority !== 'high') {
      recommended = 'high';
      reason = 'Due date is very soon';
      confidence = 0.9;
    } else if (dueAnalysis.urgencyLevel === 'high' && ['low', 'none'].includes(task.priority)) {
      recommended = 'medium';
      reason = 'Due date requires higher priority';
      confidence = 0.8;
    }

    return { recommended, reason, confidence };
  }

  // =====================================================
  // DUE DATE MANAGEMENT
  // =====================================================

  /**
   * Analyze due date and provide insights
   */
  analyzeDueDate(dueDate?: Date): DueDateAnalysis {
    if (!dueDate) {
      return {
        daysUntilDue: Infinity,
        isOverdue: false,
        isUpcoming: false,
        urgencyLevel: 'low',
        recommendedAction: 'Consider setting a due date for better planning'
      };
    }

    const daysUntilDue = this.calculateDaysUntilDue(dueDate);
    const isOverdue = daysUntilDue < 0;
    const isUpcoming = daysUntilDue >= 0 && daysUntilDue <= 3;

    let urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
    let recommendedAction: string;

    if (isOverdue) {
      urgencyLevel = 'critical';
      recommendedAction = 'Task is overdue - prioritize immediately';
    } else if (daysUntilDue <= 1) {
      urgencyLevel = 'critical';
      recommendedAction = 'Due soon - work on this today';
    } else if (daysUntilDue <= 3) {
      urgencyLevel = 'high';
      recommendedAction = 'Due this week - schedule time to work on this';
    } else if (daysUntilDue <= 7) {
      urgencyLevel = 'medium';
      recommendedAction = 'Due next week - plan accordingly';
    } else {
      urgencyLevel = 'low';
      recommendedAction = 'Good lead time - continue as planned';
    }

    return {
      daysUntilDue,
      isOverdue,
      isUpcoming,
      urgencyLevel,
      recommendedAction
    };
  }

  /**
   * Get tasks requiring attention based on due dates
   */
  async getTasksRequiringAttention(userId: string) {
    try {
      const tasks = await this.searchTasks(userId, {
        status: ['pending', 'in_progress'],
        include_archived: false
      });

      const categorized = {
        overdue: [] as any[],
        dueToday: [] as any[],
        dueTomorrow: [] as any[],
        dueThisWeek: [] as any[],
        needsScheduling: [] as any[]
      };

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      for (const task of tasks.data) {
        if (!task.due_date) {
          if (task.priority !== 'none') {
            categorized.needsScheduling.push(task);
          }
          continue;
        }

        const analysis = this.analyzeDueDate(task.due_date);
        
        if (analysis.isOverdue) {
          categorized.overdue.push(task);
        } else if (this.isSameDay(task.due_date, today)) {
          categorized.dueToday.push(task);
        } else if (this.isSameDay(task.due_date, tomorrow)) {
          categorized.dueTomorrow.push(task);
        } else if (task.due_date <= endOfWeek) {
          categorized.dueThisWeek.push(task);
        }
      }

      return categorized;
    } catch (error) {
      logger.error('Error getting tasks requiring attention', { error, userId });
      throw error;
    }
  }

  /**
   * Suggest optimal due dates for tasks without them
   */
  async suggestDueDates(userId: string): Promise<Array<{taskId: string, suggestedDate: Date, reason: string}>> {
    try {
      const tasks = await this.searchTasks(userId, {
        has_due_date: false,
        status: ['pending', 'in_progress'],
        include_archived: false
      });

      const suggestions = [];
      const baseDate = new Date();

      for (const task of tasks.data) {
        let suggestedDate: Date;
        let reason: string;

        switch (task.priority) {
          case 'high':
            suggestedDate = new Date(baseDate);
            suggestedDate.setDate(suggestedDate.getDate() + 3);
            reason = 'High priority tasks should be completed within a few days';
            break;
          case 'medium':
            suggestedDate = new Date(baseDate);
            suggestedDate.setDate(suggestedDate.getDate() + 7);
            reason = 'Medium priority allows for weekly planning';
            break;
          default:
            suggestedDate = new Date(baseDate);
            suggestedDate.setDate(suggestedDate.getDate() + 14);
            reason = 'Low priority can be scheduled for later';
        }

        suggestions.push({
          taskId: task.id,
          suggestedDate,
          reason
        });
      }

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting due dates', { error, userId });
      throw error;
    }
  }

  // =====================================================
  // ADVANCED SEARCH AND FILTERING
  // =====================================================

  /**
   * Search tasks with enhanced filters and business logic
   */
  async searchTasks(
    userId: string, 
    filters: TaskSearchFilters = {}, 
    options: TaskSortOptions = {}
  ) {
    try {
      const result = await taskRepository.findMany(userId, filters, options);
      
      // Enhance each task with business data
      const enhancedTasks = result.data.map(task => this.enhanceTaskWithBusinessData(task));
      
      return {
        ...result,
        data: enhancedTasks
      };
    } catch (error) {
      logger.error('Error searching tasks', { error, userId, filters, options });
      throw error;
    }
  }

  /**
   * Get smart task recommendations
   */
  async getSmartRecommendations(userId: string) {
    try {
      const tasks = await this.searchTasks(userId, {
        status: ['pending', 'in_progress'],
        include_archived: false
      });

      const recommendations = {
        urgent: [] as any[],
        quickWins: [] as any[],
        focusTime: [] as any[],
        review: [] as any[]
      };

      for (const task of tasks.data) {
        const metrics = this.calculatePriorityMetrics(task);
        const dueAnalysis = this.analyzeDueDate(task.due_date);

        if (dueAnalysis.isOverdue || dueAnalysis.urgencyLevel === 'critical') {
          recommendations.urgent.push(task);
        } else if (task.estimated_minutes && task.estimated_minutes <= 30) {
          recommendations.quickWins.push(task);
        } else if (task.estimated_minutes && task.estimated_minutes >= 120) {
          recommendations.focusTime.push(task);
        } else if (task.status === 'completed') {
          recommendations.review.push(task);
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error getting smart recommendations', { error, userId });
      throw error;
    }
  }

  // =====================================================
  // BUSINESS LOGIC VALIDATION
  // =====================================================

  /**
   * Validate task data according to business rules
   */
  private async validateTaskData(taskData: CreateTaskData, options: TaskValidationOptions = {}): Promise<void> {
    // Title validation
    if (!taskData.title?.trim()) {
      throw new AppError('Task title is required', 400);
    }

    const maxTitleLength = options.maxTitleLength || this.businessRules.maxTitleLength;
    if (taskData.title.length > maxTitleLength) {
      throw new AppError(`Task title cannot exceed ${maxTitleLength} characters`, 400);
    }

    // Description validation
    if (options.requireDescription && !taskData.description?.trim()) {
      throw new AppError('Task description is required', 400);
    }

    if (taskData.description && taskData.description.length > this.businessRules.maxDescriptionLength) {
      throw new AppError(`Task description cannot exceed ${this.businessRules.maxDescriptionLength} characters`, 400);
    }

    // Due date validation
    if (taskData.due_date && !options.allowPastDueDates) {
      const dueDate = new Date(taskData.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        throw new AppError('Due date cannot be in the past', 400);
      }
    }

    // Tags validation
    const maxTagCount = options.maxTagCount || this.businessRules.maxTagCount;
    if (taskData.tags && taskData.tags.length > maxTagCount) {
      throw new AppError(`Cannot have more than ${maxTagCount} tags`, 400);
    }

    // Priority validation
    if (taskData.priority && !Object.keys(this.businessRules.priorityWeights).includes(taskData.priority)) {
      throw new AppError('Invalid priority value', 400);
    }

    // Time validation
    if (taskData.estimated_minutes && taskData.estimated_minutes < 0) {
      throw new AppError('Estimated minutes cannot be negative', 400);
    }

    if (taskData.estimated_minutes && taskData.estimated_minutes > 60000) {
      throw new AppError('Estimated minutes seems unrealistic (max 60000 minutes)', 400);
    }
  }

  /**
   * Validate task update with business rules
   */
  private async validateTaskUpdate(
    existingTask: Task, 
    updateData: UpdateTaskData, 
    options: TaskValidationOptions = {}
  ): Promise<void> {
    // Run basic validation if new data provided
    if (updateData.title || updateData.description || updateData.due_date || updateData.tags) {
      await this.validateTaskData({
        title: updateData.title || existingTask.title,
        description: updateData.description,
        due_date: updateData.due_date || undefined,
        tags: updateData.tags,
        priority: updateData.priority,
        estimated_minutes: updateData.estimated_minutes || undefined
      }, options);
    }

    // Status transition validation
    if (updateData.status && updateData.status !== existingTask.status) {
      const allowedTransitions = this.businessRules.statusTransitions[existingTask.status] || [];
      if (!allowedTransitions.includes(updateData.status)) {
        throw new AppError(
          `Cannot change status from '${existingTask.status}' to '${updateData.status}'`, 
          400
        );
      }
    }

    // Completion validation
    if (updateData.status === 'completed') {
      if (existingTask.status === 'pending') {
        // Allow completing from pending, but warn
        logger.warn('Completing task directly from pending status', {
          taskId: existingTask.id
        });
      }
    }

    // Archive validation
    if (updateData.status === 'archived' && existingTask.status !== 'completed') {
      throw new AppError('Can only archive completed tasks', 400);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Enrich task data with business logic defaults
   */
  private async enrichTaskData(userId: string, taskData: CreateTaskData): Promise<CreateTaskData> {
    const enriched = { ...taskData };

    // Set defaults
    enriched.priority = enriched.priority || 'medium';
    enriched.status = enriched.status || 'pending';
    enriched.tags = enriched.tags || [];
    enriched.metadata = enriched.metadata || {};

    // Auto-set reminder date if due date is provided
    if (enriched.due_date && !enriched.reminder_date) {
      const dueDate = new Date(enriched.due_date);
      const reminderDate = new Date(dueDate);
      reminderDate.setMinutes(reminderDate.getMinutes() - this.businessRules.defaultReminderMinutes);
      enriched.reminder_date = reminderDate;
    }

    // Add creation metadata
    enriched.metadata = {
      ...enriched.metadata,
      created_by_service: true,
      creation_timestamp: new Date().toISOString()
    };

    return enriched;
  }

  /**
   * Process task update with business logic
   */
  private async processTaskUpdate(existingTask: Task, updateData: UpdateTaskData): Promise<UpdateTaskData> {
    const processed = { ...updateData };

    // Auto-set completion data
    if (processed.status === 'completed' && existingTask.status !== 'completed') {
      processed.completed_at = processed.completed_at || new Date();
      // Note: completion_percentage is not in the UpdateTaskData interface
      // This would need to be added to the interface if needed
    }

    // Clear completion data if moving away from completed
    if (existingTask.status === 'completed' && processed.status && processed.status !== 'completed') {
      processed.completed_at = null;
      processed.completed_by = null;
      // Note: completion_percentage would be handled here if available
    }

    // Update reminder if due date changed
    if (processed.due_date && processed.due_date !== existingTask.due_date) {
      if (!processed.reminder_date) {
        const dueDate = new Date(processed.due_date);
        const reminderDate = new Date(dueDate);
        reminderDate.setMinutes(reminderDate.getMinutes() - this.businessRules.defaultReminderMinutes);
        processed.reminder_date = reminderDate;
      }
    }

    return processed;
  }

  /**
   * Enhance task with computed business data
   */
  private enhanceTaskWithBusinessData(task: any) {
    const metrics = this.calculatePriorityMetrics(task);
    const dueAnalysis = this.analyzeDueDate(task.due_date);
    const priorityRec = this.getPriorityRecommendation(task);

    return {
      ...task,
      _business: {
        priorityMetrics: metrics,
        dueAnalysis,
        priorityRecommendation: priorityRec,
        isActionable: ['pending', 'in_progress'].includes(task.status),
        needsAttention: dueAnalysis.isOverdue || dueAnalysis.urgencyLevel === 'critical'
      }
    };
  }

  /**
   * Calculate days until due date
   */
  private calculateDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  /**
   * Validate task deletion
   */
  private async validateTaskDeletion(taskId: string, userId: string): Promise<void> {
    const task = await taskRepository.findTaskById(taskId, userId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Add any business rules for deletion
    if (task.status === 'in_progress') {
      logger.warn('Deleting task that is in progress', { taskId, userId });
    }
  }

  /**
   * Handle post-creation actions
   */
  private async handlePostCreationActions(task: TaskWithRelations): Promise<void> {
    // Log metrics
    logger.debug('Task created with metrics', {
      taskId: task.id,
      priority: task.priority,
      hasDueDate: !!task.due_date,
      estimatedMinutes: task.estimated_minutes
    });

    // Trigger notification hooks
    try {
      await this.notificationHooks.onTaskCreated({
        type: 'created',
        task,
        user: { id: task.user_id }
      });
    } catch (error) {
      logger.error('Error triggering task creation notifications:', error);
    }
  }

  /**
   * Handle post-update actions
   */
  private async handlePostUpdateActions(oldTask: Task, newTask: TaskWithRelations): Promise<void> {
    // Log significant changes
    if (oldTask.status !== newTask.status) {
      logger.info('Task status changed', {
        taskId: newTask.id,
        from: oldTask.status,
        to: newTask.status
      });
    }

    if (oldTask.priority !== newTask.priority) {
      logger.info('Task priority changed', {
        taskId: newTask.id,
        from: oldTask.priority,
        to: newTask.priority
      });
    }

    // Trigger notification hooks for updates
    try {
      const changes: Record<string, { old: any; new: any }> = {};
      
      // Track significant changes
      if (oldTask.status !== newTask.status) {
        changes.status = { old: oldTask.status, new: newTask.status };
      }
      if (oldTask.priority !== newTask.priority) {
        changes.priority = { old: oldTask.priority, new: newTask.priority };
      }
      if (oldTask.due_date !== newTask.due_date) {
        changes.due_date = { old: oldTask.due_date, new: newTask.due_date };
      }

      await this.notificationHooks.onTaskUpdated({
        type: 'updated',
        task: newTask,
        user: { id: newTask.user_id },
        changes
      });

      // Handle specific event types
      if (oldTask.status !== newTask.status && newTask.status === 'completed') {
        await this.notificationHooks.onTaskCompleted({
          type: 'completed',
          task: newTask,
          user: { id: newTask.user_id }
        });
      }

      // For priority and due date changes, we can use the general onTaskUpdated
      // which should handle all types of changes based on the changes object

    } catch (error) {
      logger.error('Error triggering task update notifications:', error);
    }
  }

  /**
   * Handle post-deletion actions
   */
  private async handlePostDeletionActions(taskId: string, userId: string): Promise<void> {
    logger.info('Task deleted', { taskId, userId });
    
    // TODO: Cancel any pending notifications for this task
    // The notification service should have a method to cancel task notifications
    // await this.notificationService.cancelTaskNotifications(taskId);
  }

  // =====================================================
  // BULK OPERATIONS (Enhanced from original)
  // =====================================================

  /**
   * Bulk update tasks with validation
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

  // Legacy method compatibility
  async getUserTasks(userId: string, options: TaskSortOptions = {}) {
    return this.searchTasks(userId, { include_archived: false }, options);
  }

  async getOverdueTasks(userId: string) {
    return this.searchTasks(userId, { is_overdue: true, include_archived: false });
  }

  async getUpcomingTasks(userId: string) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.searchTasks(userId, {
      due_date_from: new Date(),
      due_date_to: nextWeek,
      include_archived: false
    });
  }

  async getTasksByStatus(userId: string, status: string | string[]) {
    return this.searchTasks(userId, { status: status as any });
  }

  async getTasksByCategory(userId: string, categoryId: string) {
    return this.searchTasks(userId, { category_id: categoryId });
  }

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
}

// Export singleton instance
export const taskService = new TaskService();
export default taskService;
