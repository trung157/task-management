import express, { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import { logger } from '../utils/logger';

const router = express.Router();
const notificationService = NotificationService.getInstance();

// =====================================================
// VALIDATION RULES
// =====================================================

const validateNotificationId = [
  param('id').isUUID().withMessage('Invalid notification ID format')
];

const validateGetNotifications = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  query('unreadOnly').optional().isBoolean().withMessage('UnreadOnly must be a boolean')
];

const validateSendReminder = [
  body('taskId').isUUID().withMessage('Invalid task ID format'),
  body('userId').optional().isUUID().withMessage('Invalid user ID format')
];

const validateTaskAssignment = [
  body('taskId').isUUID().withMessage('Invalid task ID format'),
  body('assigneeId').isUUID().withMessage('Invalid assignee ID format'),
  body('assignerId').isUUID().withMessage('Invalid assigner ID format')
];

// =====================================================
// ROUTES
// =====================================================

/**
 * @route GET /api/notifications
 * @desc Get user notifications with pagination
 * @access Private
 */
router.get('/', 
  authMiddleware,
  validateGetNotifications,
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.getUserNotifications(userId, {
        limit,
        offset,
        unreadOnly
      });

      logger.info('User notifications retrieved', { 
        userId, 
        count: result.notifications.length,
        total: result.total 
      });

      res.json({
        success: true,
        data: {
          notifications: result.notifications,
          pagination: {
            total: result.total,
            limit,
            offset,
            hasMore: offset + limit < result.total
          }
        }
      });
    } catch (error) {
      logger.error('Error retrieving user notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics for user
 * @access Private
 */
router.get('/stats',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await notificationService.getNotificationStats(userId);

      logger.info('User notification stats retrieved', { userId, stats });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error retrieving notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification statistics',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a specific notification as read
 * @access Private
 */
router.put('/:id/read',
  authMiddleware,
  validateNotificationId,
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id;

      await notificationService.markNotificationAsRead(notificationId, userId);

      logger.info('Notification marked as read', { userId, notificationId });

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read for the user
 * @access Private
 */
router.put('/read-all',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      await notificationService.markAllNotificationsAsRead(userId);

      logger.info('All notifications marked as read', { userId });

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route POST /api/notifications/send-reminder
 * @desc Send immediate due date reminder for a task
 * @access Private
 */
router.post('/send-reminder',
  authMiddleware,
  validateSendReminder,
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { taskId, userId } = req.body;
      const requesterId = req.user!.id;

      // Use provided userId or default to requester
      const targetUserId = userId || requesterId;

      // TODO: Add permission check - users should only send reminders for their own tasks
      // or tasks they have permission to manage

      await notificationService.sendDueDateReminder(taskId, targetUserId);

      logger.info('Due date reminder sent', { taskId, targetUserId, requesterId });

      res.json({
        success: true,
        message: 'Due date reminder sent successfully'
      });
    } catch (error) {
      logger.error('Error sending due date reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send due date reminder',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route POST /api/notifications/task-assignment
 * @desc Send task assignment notification
 * @access Private
 */
router.post('/task-assignment',
  authMiddleware,
  validateTaskAssignment,
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { taskId, assigneeId, assignerId } = req.body;
      const requesterId = req.user!.id;

      // TODO: Add permission check - users should only assign tasks they own or have permission to manage

      await notificationService.sendTaskAssignmentNotification(taskId, assigneeId, assignerId || requesterId);

      logger.info('Task assignment notification sent', { taskId, assigneeId, assignerId, requesterId });

      res.json({
        success: true,
        message: 'Task assignment notification sent successfully'
      });
    } catch (error) {
      logger.error('Error sending task assignment notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send task assignment notification',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route POST /api/notifications/daily-summary
 * @desc Send daily summary to user
 * @access Private
 */
router.post('/daily-summary',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      await notificationService.sendDailySummary(userId);

      logger.info('Daily summary sent', { userId });

      res.json({
        success: true,
        message: 'Daily summary sent successfully'
      });
    } catch (error) {
      logger.error('Error sending daily summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send daily summary',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * @route GET /api/notifications/health
 * @desc Check notification service health
 * @access Private (Admin only)
 */
router.get('/health',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // TODO: Add admin role check
      const isInitialized = notificationService['isInitialized'];
      const cronJobsCount = notificationService['cronJobs']?.size || 0;

      res.json({
        success: true,
        data: {
          service: 'NotificationService',
          status: isInitialized ? 'running' : 'not_initialized',
          cronJobs: cronJobsCount,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error checking notification service health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check service health',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

export default router;
