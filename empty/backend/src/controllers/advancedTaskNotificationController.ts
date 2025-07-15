/**
 * Advanced Task Notification Controller
 * 
 * RESTful API controller for managing task notifications:
 * - Get user notifications
 * - Update notification preferences
 * - Mark notifications as read
 * - Get notification statistics
 * - Trigger immediate notifications (admin)
 */

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AdvancedTaskNotificationService } from '../services/advancedTaskNotificationService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// =====================================================
// EXTENDED REQUEST INTERFACES
// =====================================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

// =====================================================
// VALIDATION RULES
// =====================================================

export const notificationValidationRules = {
  getNotifications: [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be a boolean'),
  ],

  updatePreferences: [
    body('due_date_reminders').optional().isBoolean(),
    body('reminder_intervals').optional().isArray(),
    body('reminder_intervals.*').optional().isIn(['15min', '1hour', '1day', '3days', '1week']),
    body('task_assignments').optional().isBoolean(),
    body('task_completions').optional().isBoolean(),
    body('status_changes').optional().isBoolean(),
    body('priority_changes').optional().isBoolean(),
    body('comment_notifications').optional().isBoolean(),
    body('daily_summaries').optional().isBoolean(),
    body('weekly_summaries').optional().isBoolean(),
    body('preferred_channels').optional().isArray(),
    body('preferred_channels.*').optional().isIn(['email', 'push', 'in_app', 'sms']),
    body('quiet_hours_enabled').optional().isBoolean(),
    body('quiet_start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quiet_end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quiet_timezone').optional().isString(),
    body('batch_notifications').optional().isBoolean(),
    body('instant_notifications').optional().isBoolean(),
    body('digest_frequency').optional().isIn(['immediate', 'hourly', 'daily', 'weekly']),
  ],

  markAsRead: [
    param('notificationId').isUUID().withMessage('Valid notification ID is required'),
  ],

  scheduleNotification: [
    body('user_id').isUUID().withMessage('Valid user ID is required'),
    body('task_id').optional().isUUID().withMessage('Valid task ID is required'),
    body('type').isIn([
      'task_due_reminder',
      'task_overdue_alert', 
      'task_assignment',
      'task_completion',
      'task_status_change',
      'daily_task_summary',
      'weekly_task_summary',
      'task_comment',
      'task_priority_change'
    ]).withMessage('Valid notification type is required'),
    body('channel').isIn(['email', 'push', 'in_app', 'sms']).withMessage('Valid channel is required'),
    body('title').isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('scheduled_for').optional().isISO8601().withMessage('Valid scheduled date is required'),
  ],
};

// =====================================================
// CONTROLLER CLASS
// =====================================================

export class AdvancedTaskNotificationController {
  private notificationService: AdvancedTaskNotificationService;

  constructor() {
    this.notificationService = AdvancedTaskNotificationService.getInstance();
  }

  // =====================================================
  // NOTIFICATION RETRIEVAL ENDPOINTS
  // =====================================================

  /**
   * Get user's notifications
   */
  public getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === 'true';

      const notifications = await this.notificationService.getUserNotifications(req.user.id, {
        limit,
        offset,
        unreadOnly
      });

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            limit,
            offset,
            total: notifications.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get notification statistics
   */
  public getNotificationStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const stats = await this.notificationService.getNotificationStats(req.user.id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark notification as read
   */
  public markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const { notificationId } = req.params;

      await this.notificationService.markNotificationAsRead(notificationId, req.user.id);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark all notifications as read
   */
  public markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // Get all unread notifications and mark them as read
      const unreadNotifications = await this.notificationService.getUserNotifications(req.user.id, { 
        unreadOnly: true 
      });

      for (const notification of unreadNotifications) {
        await this.notificationService.markNotificationAsRead(notification.id, req.user.id);
      }

      res.json({
        success: true,
        message: `Marked ${unreadNotifications.length} notifications as read`
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // PREFERENCE MANAGEMENT ENDPOINTS
  // =====================================================

  /**
   * Get user notification preferences
   */
  public getPreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // Get preferences through the service (it handles defaults)
      const preferences = await (this.notificationService as any).getUserPreferences(req.user.id);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user notification preferences
   */
  public updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const preferences = req.body;

      await this.notificationService.updateUserPreferences(req.user.id, preferences);

      logger.info('User notification preferences updated', {
        userId: req.user.id,
        updatedFields: Object.keys(preferences)
      });

      res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // TASK-SPECIFIC NOTIFICATION ENDPOINTS
  // =====================================================

  /**
   * Schedule task reminders for a specific task
   */
  public scheduleTaskReminders = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const { taskId } = req.params;

      if (!taskId) {
        throw new AppError('Task ID is required', 400, 'MISSING_TASK_ID');
      }

      await this.notificationService.scheduleTaskReminders(taskId, req.user.id);

      res.json({
        success: true,
        message: 'Task reminders scheduled successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Send task assignment notification
   */
  public sendTaskAssignmentNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const { taskId, assigneeId } = req.body;

      if (!taskId || !assigneeId) {
        throw new AppError('Task ID and assignee ID are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      await this.notificationService.sendTaskAssignmentNotification(taskId, assigneeId, req.user.id);

      res.json({
        success: true,
        message: 'Task assignment notification sent successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Trigger daily summary for user
   */
  public triggerDailySummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // This would trigger a daily summary for the current user
      const summary = await (this.notificationService as any).generateDailySummary(req.user.id);

      if (summary.total_tasks === 0) {
        res.json({
          success: true,
          message: 'No tasks to summarize',
          data: summary
        });
        return;
      }

      // Schedule immediate daily summary notification
      await this.notificationService.scheduleNotification({
        user_id: req.user.id,
        task_id: undefined,
        type: 'daily_task_summary',
        channel: 'email',
        title: `Daily Task Summary - ${new Date().toLocaleDateString()}`,
        message: `${summary.due_today} due today, ${summary.overdue} overdue, ${summary.completed} completed`,
        html_content: undefined,
        data: { summary },
        scheduled_for: new Date()
      });

      res.json({
        success: true,
        message: 'Daily summary triggered successfully',
        data: summary
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // ADMIN ENDPOINTS
  // =====================================================

  /**
   * Schedule custom notification (Admin only)
   */
  public scheduleCustomNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const {
        user_id,
        task_id,
        type,
        channel,
        title,
        message,
        html_content,
        data,
        scheduled_for
      } = req.body;

      const notificationId = await this.notificationService.scheduleNotification({
        user_id,
        task_id,
        type,
        channel,
        title,
        message,
        html_content,
        data: data || {},
        scheduled_for: scheduled_for ? new Date(scheduled_for) : new Date()
      });

      logger.info('Custom notification scheduled by admin', {
        adminId: req.user.id,
        notificationId,
        targetUserId: user_id,
        type
      });

      res.json({
        success: true,
        message: 'Custom notification scheduled successfully',
        data: { notificationId }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Trigger overdue alerts check (Admin only)
   */
  public triggerOverdueCheck = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      await this.notificationService.checkAndSendOverdueAlerts();

      logger.info('Overdue alerts check triggered by admin', { adminId: req.user.id });

      res.json({
        success: true,
        message: 'Overdue alerts check completed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Send daily summaries to all users (Admin only)
   */
  public triggerDailySummaries = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      await this.notificationService.sendDailyTaskSummary();

      logger.info('Daily summaries triggered by admin', { adminId: req.user.id });

      res.json({
        success: true,
        message: 'Daily summaries sent successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cleanup old notifications (Admin only)
   */
  public cleanupNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const daysToKeep = parseInt(req.query.days as string) || 30;
      const deletedCount = await this.notificationService.cleanupOldNotifications(daysToKeep);

      logger.info('Notification cleanup performed by admin', { 
        adminId: req.user.id, 
        deletedCount, 
        daysToKeep 
      });

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old notifications`,
        data: { deletedCount, daysToKeep }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get notification system status (Admin only)
   */
  public getSystemStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      // TODO: Implement system status check
      const status = {
        service_status: 'running',
        queue_size: (this.notificationService as any).notificationQueue?.length || 0,
        cron_jobs_active: (this.notificationService as any).cronJobs?.size || 0,
        last_overdue_check: new Date(), // TODO: Track actual last check
        last_daily_summary: new Date(), // TODO: Track actual last summary
        total_notifications_sent_today: 0, // TODO: Calculate actual count
        failed_notifications_today: 0, // TODO: Calculate actual count
      };

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AdvancedTaskNotificationController;
