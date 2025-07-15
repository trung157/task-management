import cron from 'node-cron';
import { ScheduledTask } from 'node-cron';
import { EmailService } from './emailService';
import { TaskModel, Task, TaskWithCategory } from '../models/task';
import { UserModel, User, UserProfile } from '../models/user';
import pool from '../db';
import { logger } from '../utils/logger';
import config from '../config/config';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export type NotificationType = 'due_date_reminder' | 'overdue_alert' | 'task_assignment' | 'daily_summary';
export type NotificationChannel = 'email' | 'push' | 'in_app';
export type ReminderTiming = 'immediate' | '15_minutes' | '1_hour' | '1_day' | '1_week';

export interface NotificationPreferences {
  due_date_reminders: boolean;
  overdue_alerts: boolean;
  daily_summary: boolean;
  task_assignments: boolean;
  reminder_timing: ReminderTiming[];
  preferred_channels: NotificationChannel[];
  quiet_hours: {
    enabled: boolean;
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
    timezone: string;
  };
}

export interface NotificationData {
  id: string;
  user_id: string;
  task_id?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data: Record<string, any>;
  scheduled_for: Date;
  sent_at?: Date;
  read_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DueDateReminderData {
  task: TaskWithCategory;
  user: UserProfile;
  timeUntilDue: string;
  reminderType: 'upcoming' | 'due_today' | 'overdue';
}

export interface DailySummaryData {
  user: UserProfile;
  summary: {
    due_today: TaskWithCategory[];
    overdue: TaskWithCategory[];
    completed_today: TaskWithCategory[];
    total_pending: number;
    high_priority: TaskWithCategory[];
  };
}

export interface TaskAssignmentData {
  task: TaskWithCategory;
  assignee: UserProfile;
  assigner: UserProfile;
}

// =====================================================
// NOTIFICATION SERVICE CLASS
// =====================================================

/**
 * Comprehensive notification service for task reminders and alerts
 */
export class NotificationService {
  private static instance: NotificationService;
  private emailService: EmailService;
  private cronJobs: Map<string, ScheduledTask> = new Map();
  private isInitialized = false;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the notification service and start cron jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.createNotificationTable();
      this.startCronJobs();
      this.isInitialized = true;
      logger.info('NotificationService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize NotificationService:', error);
      throw error;
    }
  }

  /**
   * Create notification table if it doesn't exist
   */
  private async createNotificationTable(): Promise<void> {
    // Check if the table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

    if (tableExists.rows[0].exists) {
      // Table exists, check if it has all required columns
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifications'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      const requiredColumns = ['task_id', 'channel', 'scheduled_for', 'sent_at', 'updated_at'];
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        logger.warn(`Notifications table exists but is missing columns: ${missingColumns.join(', ')}`);
        logger.info('Please run the notification table migration script');
      }
    } else {
      // Create the table from scratch
      const createTableQuery = `
        CREATE TABLE notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          channel VARCHAR(20) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB DEFAULT '{}',
          scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      await pool.query(createTableQuery);
      logger.info('Notification table created successfully');
    }

    // Create indexes (IF NOT EXISTS will handle existing ones)
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
      CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
    `;

    await pool.query(createIndexesQuery);
    logger.info('Notification table indexes verified successfully');
  }

  /**
   * Start all cron jobs for scheduled notifications
   */
  private startCronJobs(): void {
    // Check for due date reminders every 15 minutes
    this.cronJobs.set('due_date_reminders', cron.schedule('*/15 * * * *', () => {
      this.processDueDateReminders().catch(error => {
        logger.error('Error processing due date reminders:', error);
      });
    }));

    // Check for overdue tasks every hour
    this.cronJobs.set('overdue_alerts', cron.schedule('0 * * * *', () => {
      this.processOverdueAlerts().catch(error => {
        logger.error('Error processing overdue alerts:', error);
      });
    }));

    // Send daily summaries at 8 AM
    this.cronJobs.set('daily_summary', cron.schedule('0 8 * * *', () => {
      this.processDailySummaries().catch(error => {
        logger.error('Error processing daily summaries:', error);
      });
    }));

    // Clean up old notifications daily at 2 AM
    this.cronJobs.set('cleanup', cron.schedule('0 2 * * *', () => {
      this.cleanupOldNotifications().catch(error => {
        logger.error('Error cleaning up old notifications:', error);
      });
    }));

    logger.info('Notification cron jobs started successfully');
  }

  /**
   * Stop all cron jobs
   */
  stopCronJobs(): void {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.cronJobs.clear();
  }

  // =====================================================
  // MANUAL NOTIFICATION METHODS
  // =====================================================

  /**
   * Send immediate due date reminder for a specific task
   */
  async sendDueDateReminder(taskId: string, userId: string): Promise<void> {
    try {
      const task = await TaskModel.findByIdInternal(taskId);
      const user = await UserModel.findById(userId);

      if (!task || !user) {
        throw new Error('Task or user not found');
      }

      if (!user.notification_settings?.due_date_reminders) {
        logger.info('User has disabled due date reminders', { userId, taskId });
        return;
      }

      const reminderData: DueDateReminderData = {
        task: task as TaskWithCategory,
        user,
        timeUntilDue: this.getTimeUntilDue(task.due_date),
        reminderType: this.getReminderType(task.due_date)
      };

      await this.sendNotification({
        userId,
        taskId,
        type: 'due_date_reminder',
        channel: 'email',
        title: `Task Due: ${task.title}`,
        message: this.generateDueDateReminderMessage(reminderData),
        data: reminderData,
        scheduledFor: new Date()
      });

      logger.info('Due date reminder sent successfully', { userId, taskId });
    } catch (error) {
      logger.error('Error sending due date reminder:', error);
      throw error;
    }
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(taskId: string, assigneeId: string, assignerId: string): Promise<void> {
    try {
      const task = await TaskModel.findByIdInternal(taskId);
      const assignee = await UserModel.findById(assigneeId);
      const assigner = await UserModel.findById(assignerId);

      if (!task || !assignee || !assigner) {
        throw new Error('Task, assignee, or assigner not found');
      }

      if (!assignee.notification_settings?.task_assignments) {
        logger.info('User has disabled task assignment notifications', { assigneeId, taskId });
        return;
      }

      const assignmentData: TaskAssignmentData = {
        task: task as TaskWithCategory,
        assignee,
        assigner
      };

      await this.sendNotification({
        userId: assigneeId,
        taskId,
        type: 'task_assignment',
        channel: 'email',
        title: `New Task Assigned: ${task.title}`,
        message: this.generateTaskAssignmentMessage(assignmentData),
        data: assignmentData,
        scheduledFor: new Date()
      });

      logger.info('Task assignment notification sent successfully', { assigneeId, taskId, assignerId });
    } catch (error) {
      logger.error('Error sending task assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send daily summary to a specific user
   */
  async sendDailySummary(userId: string): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.notification_settings?.email_notifications) {
        logger.info('User has disabled email notifications', { userId });
        return;
      }

      const summary = await this.generateDailySummary(userId);
      
      const summaryData: DailySummaryData = {
        user,
        summary
      };

      await this.sendNotification({
        userId,
        type: 'daily_summary',
        channel: 'email',
        title: 'Your Daily Task Summary',
        message: this.generateDailySummaryMessage(summaryData),
        data: summaryData,
        scheduledFor: new Date()
      });

      logger.info('Daily summary sent successfully', { userId });
    } catch (error) {
      logger.error('Error sending daily summary:', error);
      throw error;
    }
  }

  // =====================================================
  // SCHEDULED PROCESSING METHODS
  // =====================================================

  /**
   * Process due date reminders for all eligible tasks
   */
  private async processDueDateReminders(): Promise<void> {
    try {
      logger.info('Processing due date reminders...');

      // Get tasks with due dates in the next 24 hours
      const upcomingTasks = await this.getTasksWithUpcomingDueDates();

      for (const task of upcomingTasks) {
        const user = await UserModel.findById(task.user_id);
        if (!user || !user.notification_settings?.due_date_reminders) {
          continue;
        }

        // Check if we've already sent a reminder for this task recently
        const recentReminder = await this.hasRecentReminder(task.id, 'due_date_reminder');
        if (recentReminder) {
          continue;
        }

        await this.sendDueDateReminder(task.id, task.user_id);
      }

      logger.info(`Processed ${upcomingTasks.length} due date reminders`);
    } catch (error) {
      logger.error('Error processing due date reminders:', error);
    }
  }

  /**
   * Process overdue alerts for all overdue tasks
   */
  private async processOverdueAlerts(): Promise<void> {
    try {
      logger.info('Processing overdue alerts...');

      const overdueTasks = await this.getOverdueTasks();

      for (const task of overdueTasks) {
        const user = await UserModel.findById(task.user_id);
        if (!user || !user.notification_settings?.due_date_reminders) {
          continue;
        }

        // Check if we've already sent an overdue alert today
        const recentAlert = await this.hasRecentReminder(task.id, 'due_date_reminder', 24);
        if (recentAlert) {
          continue;
        }

        const reminderData: DueDateReminderData = {
          task: task as TaskWithCategory,
          user,
          timeUntilDue: this.getTimeUntilDue(task.due_date),
          reminderType: 'overdue'
        };

        await this.sendNotification({
          userId: task.user_id,
          taskId: task.id,
          type: 'due_date_reminder',
          channel: 'email',
          title: `Overdue Task: ${task.title}`,
          message: this.generateDueDateReminderMessage(reminderData),
          data: reminderData,
          scheduledFor: new Date()
        });
      }

      logger.info(`Processed ${overdueTasks.length} overdue alerts`);
    } catch (error) {
      logger.error('Error processing overdue alerts:', error);
    }
  }

  /**
   * Process daily summaries for all users
   */
  private async processDailySummaries(): Promise<void> {
    try {
      logger.info('Processing daily summaries...');

      // Get all users who have email notifications enabled
      const users = await this.getUsersWithEmailNotifications();

      for (const user of users) {
        await this.sendDailySummary(user.id);
        // Add small delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Processed ${users.length} daily summaries`);
    } catch (error) {
      logger.error('Error processing daily summaries:', error);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Send notification through appropriate channel
   */
  private async sendNotification(notification: {
    userId: string;
    taskId?: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    message: string;
    data: any;
    scheduledFor: Date;
  }): Promise<void> {
    try {
      // Store notification in database
      await this.storeNotification(notification);

      // Send through appropriate channel
      switch (notification.channel) {
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'push':
          await this.sendPushNotification(notification);
          break;
        case 'in_app':
          await this.sendInAppNotification(notification);
          break;
        default:
          logger.warn(`Unsupported notification channel: ${notification.channel}`);
      }

      // Mark as sent
      await this.markNotificationAsSent(notification);
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Store notification in database
   */
  private async storeNotification(notification: any): Promise<string> {
    const query = `
      INSERT INTO notifications (user_id, task_id, type, channel, title, message, data, scheduled_for)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      notification.userId,
      notification.taskId || null,
      notification.type,
      notification.channel,
      notification.title,
      notification.message,
      JSON.stringify(notification.data),
      notification.scheduledFor
    ];

    const result = await pool.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    const user = await UserModel.findById(notification.userId);
    if (!user) {
      throw new Error('User not found for email notification');
    }

    const emailSubject = notification.title;
    const emailContent = this.generateEmailContent(notification);

    // Use the existing EmailService or create a custom email
    // For now, we'll use a generic email sending approach
    await this.emailService.sendGenericEmail(
      user.email,
      user.first_name,
      emailSubject,
      emailContent,
      notification.type
    );
  }

  /**
   * Send push notification (placeholder - would integrate with push service)
   */
  private async sendPushNotification(notification: any): Promise<void> {
    // TODO: Implement push notification service integration
    logger.info('Push notification sent (placeholder)', { 
      userId: notification.userId, 
      title: notification.title 
    });
  }

  /**
   * Send in-app notification (store for real-time delivery)
   */
  private async sendInAppNotification(notification: any): Promise<void> {
    // TODO: Implement WebSocket or Server-Sent Events for real-time notifications
    logger.info('In-app notification stored', { 
      userId: notification.userId, 
      title: notification.title 
    });
  }

  /**
   * Mark notification as sent
   */
  private async markNotificationAsSent(notification: any): Promise<void> {
    const query = `
      UPDATE notifications 
      SET sent_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND type = $2 AND title = $3 AND sent_at IS NULL
    `;

    await pool.query(query, [notification.userId, notification.type, notification.title]);
  }

  /**
   * Get tasks with upcoming due dates
   */
  private async getTasksWithUpcomingDueDates(): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE due_date IS NOT NULL 
        AND due_date > NOW() 
        AND due_date <= NOW() + INTERVAL '24 hours'
        AND status NOT IN ('completed', 'archived')
        AND deleted_at IS NULL
      ORDER BY due_date ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get overdue tasks
   */
  private async getOverdueTasks(): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE due_date IS NOT NULL 
        AND due_date < NOW() 
        AND status NOT IN ('completed', 'archived')
        AND deleted_at IS NULL
      ORDER BY due_date ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get users with email notifications enabled
   */
  private async getUsersWithEmailNotifications(): Promise<User[]> {
    const query = `
      SELECT * FROM users 
      WHERE notification_settings->>'email_notifications' = 'true'
        AND status = 'active'
        AND deleted_at IS NULL
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Check if there's a recent reminder for a task
   */
  private async hasRecentReminder(taskId: string, type: NotificationType, hoursBack: number = 1): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM notifications 
      WHERE task_id = $1 
        AND type = $2 
        AND sent_at > NOW() - INTERVAL '${hoursBack} hours'
    `;

    const result = await pool.query(query, [taskId, type]);
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Generate daily summary for a user
   */
  private async generateDailySummary(userId: string): Promise<any> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get tasks due today
    const dueToday = await TaskModel.list(
      userId,
      { 
        due_date_from: startOfDay, 
        due_date_to: endOfDay,
        status: ['pending', 'in_progress'] 
      },
      { limit: 100 }
    );

    // Get overdue tasks
    const overdue = await TaskModel.list(
      userId,
      { 
        due_date_to: startOfDay,
        status: ['pending', 'in_progress'],
        overdue: true
      },
      { limit: 100 }
    );

    // Get completed tasks today
    const completedToday = await TaskModel.list(
      userId,
      { 
        created_after: startOfDay,
        status: ['completed']
      },
      { limit: 100 }
    );

    // Get total pending tasks
    const totalPending = await TaskModel.list(
      userId,
      { status: ['pending', 'in_progress'] },
      { limit: 1 }
    );

    // Get high priority tasks
    const highPriority = await TaskModel.list(
      userId,
      { 
        priority: ['high'],
        status: ['pending', 'in_progress']
      },
      { limit: 10 }
    );

    return {
      due_today: dueToday.tasks,
      overdue: overdue.tasks,
      completed_today: completedToday.tasks,
      total_pending: totalPending.pagination.total,
      high_priority: highPriority.tasks
    };
  }

  /**
   * Get time until due date as human readable string
   */
  private getTimeUntilDue(dueDate?: Date): string {
    if (!dueDate) return 'No due date';

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      const overdueDays = Math.abs(diffDays);
      return overdueDays === 0 ? 'Overdue by hours' : `Overdue by ${overdueDays} day(s)`;
    }

    if (diffDays > 0) {
      return `${diffDays} day(s)`;
    } else if (diffHours > 0) {
      return `${diffHours} hour(s)`;
    } else {
      return 'Less than an hour';
    }
  }

  /**
   * Get reminder type based on due date
   */
  private getReminderType(dueDate?: Date): 'upcoming' | 'due_today' | 'overdue' {
    if (!dueDate) return 'upcoming';

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return 'overdue';
    if (diffDays === 0) return 'due_today';
    return 'upcoming';
  }

  /**
   * Generate due date reminder message
   */
  private generateDueDateReminderMessage(data: DueDateReminderData): string {
    const { task, timeUntilDue, reminderType } = data;

    switch (reminderType) {
      case 'overdue':
        return `Your task "${task.title}" is ${timeUntilDue}. Please complete it as soon as possible.`;
      case 'due_today':
        return `Your task "${task.title}" is due today. Don't forget to complete it!`;
      case 'upcoming':
        return `Reminder: Your task "${task.title}" is due in ${timeUntilDue}.`;
      default:
        return `Reminder about your task: "${task.title}"`;
    }
  }

  /**
   * Generate task assignment message
   */
  private generateTaskAssignmentMessage(data: TaskAssignmentData): string {
    const { task, assigner } = data;
    return `${assigner.first_name} ${assigner.last_name} has assigned you a new task: "${task.title}". ` +
           `${task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date set.'}`;
  }

  /**
   * Generate daily summary message
   */
  private generateDailySummaryMessage(data: DailySummaryData): string {
    const { summary } = data;
    return `Daily Summary: ${summary.due_today.length} tasks due today, ` +
           `${summary.overdue.length} overdue tasks, ` +
           `${summary.completed_today.length} completed today. ` +
           `Total pending: ${summary.total_pending}`;
  }

  /**
   * Generate email content for notifications
   */
  private generateEmailContent(notification: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin: 20px 0; }
          .task-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .priority-high { border-left: 4px solid #dc3545; }
          .priority-medium { border-left: 4px solid #ffc107; }
          .priority-low { border-left: 4px solid #28a745; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TaskFlow</h1>
          </div>
          <div class="content">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            ${this.generateTaskInfoHtml(notification.data)}
          </div>
          <div class="footer">
            <p>Best regards,<br>The TaskFlow Team</p>
            <p><a href="${config.app.frontendUrl}">Open TaskFlow</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate task info HTML for email
   */
  private generateTaskInfoHtml(data: any): string {
    if (data.task) {
      const task = data.task;
      const priorityClass = `priority-${task.priority || 'medium'}`;
      return `
        <div class="task-info ${priorityClass}">
          <h3>${task.title}</h3>
          ${task.description ? `<p>${task.description}</p>` : ''}
          <p><strong>Priority:</strong> ${task.priority || 'Medium'}</p>
          <p><strong>Status:</strong> ${task.status || 'Pending'}</p>
          ${task.due_date ? `<p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>` : ''}
          ${task.category ? `<p><strong>Category:</strong> ${task.category.name}</p>` : ''}
        </div>
      `;
    }
    return '';
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const query = `
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `;

      const result = await pool.query(query);
      logger.info(`Cleaned up ${result.rowCount} old notifications`);
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
    }
  }

  // =====================================================
  // PUBLIC API METHODS
  // =====================================================

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}): Promise<{ notifications: NotificationData[]; total: number }> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    let query = `
      SELECT n.*, t.title as task_title FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = $1
    `;

    const params: any[] = [userId];
    let paramCount = 1;

    if (unreadOnly) {
      query += ` AND n.read_at IS NULL`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const [notifications, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(
        `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}`,
        [userId]
      )
    ]);

    return {
      notifications: notifications.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET read_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL
    `;

    await pool.query(query, [notificationId, userId]);
    logger.info('Notification marked as read', { notificationId, userId });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET read_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND read_at IS NULL
    `;

    await pool.query(query, [userId]);
    logger.info('All notifications marked as read', { userId });
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
  }> {
    const [totalResult, unreadResult, byTypeResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]),
      pool.query(`
        SELECT type, COUNT(*) as count 
        FROM notifications 
        WHERE user_id = $1 
        GROUP BY type
      `, [userId])
    ]);

    const byType: Record<NotificationType, number> = {
      due_date_reminder: 0,
      overdue_alert: 0,
      task_assignment: 0,
      daily_summary: 0
    };

    byTypeResult.rows.forEach(row => {
      byType[row.type as NotificationType] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult.rows[0].count),
      unread: parseInt(unreadResult.rows[0].count),
      byType
    };
  }
}

// Add method to EmailService for generic notifications
declare module './emailService' {
  interface EmailService {
    sendGenericEmail(
      email: string,
      name: string,
      subject: string,
      htmlContent: string,
      type: string
    ): Promise<void>;
  }
}

export default NotificationService;
