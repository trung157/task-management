/**
 * Advanced Task Notification Routes
 * 
 * RESTful routes for task notification management:
 * - User notification retrieval and management
 * - Notification preferences
 * - Task-specific notifications
 * - Admin notification controls
 */

import { Router } from 'express';
import AdvancedTaskNotificationController, { notificationValidationRules } from '../controllers/advancedTaskNotificationController';
import { jwtAuth } from '../middleware/jwtAuth';

const router = Router();
const notificationController = new AdvancedTaskNotificationController();

// =====================================================
// USER NOTIFICATION ROUTES
// =====================================================

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications with pagination
 * @access  Private
 * @query   limit, offset, unreadOnly
 */
router.get(
  '/',
  jwtAuth,
  notificationValidationRules.getNotifications,
  notificationController.getNotifications
);

/**
 * @route   GET /api/v1/notifications/stats
 * @desc    Get user's notification statistics
 * @access  Private
 */
router.get(
  '/stats',
  jwtAuth,
  notificationController.getNotificationStats
);

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    Mark specific notification as read
 * @access  Private
 */
router.put(
  '/:notificationId/read',
  jwtAuth,
  notificationValidationRules.markAsRead,
  notificationController.markAsRead
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put(
  '/read-all',
  jwtAuth,
  notificationController.markAllAsRead
);

// =====================================================
// NOTIFICATION PREFERENCES ROUTES
// =====================================================

/**
 * @route   GET /api/v1/notifications/preferences
 * @desc    Get user's notification preferences
 * @access  Private
 */
router.get(
  '/preferences',
  jwtAuth,
  notificationController.getPreferences
);

/**
 * @route   PUT /api/v1/notifications/preferences
 * @desc    Update user's notification preferences
 * @access  Private
 */
router.put(
  '/preferences',
  jwtAuth,
  notificationValidationRules.updatePreferences,
  notificationController.updatePreferences
);

// =====================================================
// TASK-SPECIFIC NOTIFICATION ROUTES
// =====================================================

/**
 * @route   POST /api/v1/notifications/tasks/:taskId/reminders
 * @desc    Schedule reminders for a specific task
 * @access  Private
 */
router.post(
  '/tasks/:taskId/reminders',
  jwtAuth,
  notificationController.scheduleTaskReminders
);

/**
 * @route   POST /api/v1/notifications/tasks/assignment
 * @desc    Send task assignment notification
 * @access  Private
 * @body    { taskId, assigneeId }
 */
router.post(
  '/tasks/assignment',
  jwtAuth,
  notificationController.sendTaskAssignmentNotification
);

/**
 * @route   POST /api/v1/notifications/daily-summary
 * @desc    Trigger daily summary for current user
 * @access  Private
 */
router.post(
  '/daily-summary',
  jwtAuth,
  notificationController.triggerDailySummary
);

// =====================================================
// ADMIN NOTIFICATION ROUTES
// =====================================================

/**
 * @route   POST /api/v1/notifications/admin/schedule
 * @desc    Schedule custom notification (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/admin/schedule',
  jwtAuth,
  notificationValidationRules.scheduleNotification,
  notificationController.scheduleCustomNotification
);

/**
 * @route   POST /api/v1/notifications/admin/overdue-check
 * @desc    Trigger overdue alerts check (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/admin/overdue-check',
  jwtAuth,
  notificationController.triggerOverdueCheck
);

/**
 * @route   POST /api/v1/notifications/admin/daily-summaries
 * @desc    Send daily summaries to all users (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/admin/daily-summaries',
  jwtAuth,
  notificationController.triggerDailySummaries
);

/**
 * @route   DELETE /api/v1/notifications/admin/cleanup
 * @desc    Cleanup old notifications (Admin only)
 * @access  Private (Admin)
 * @query   days (optional, default: 30)
 */
router.delete(
  '/admin/cleanup',
  jwtAuth,
  notificationController.cleanupNotifications
);

/**
 * @route   GET /api/v1/notifications/admin/status
 * @desc    Get notification system status (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/status',
  jwtAuth,
  notificationController.getSystemStatus
);

export default router;
