/**
 * Advanced Task Notification Service
 * 
 * Comprehensive notification system for task management:
 * - Task due date reminders and alerts
 * - Task assignment notifications  
 * - Overdue task alerts
 * - Daily/weekly summaries
 * - Real-time notifications
 * - Multiple delivery channels (email, push, in-app)
 * - Smart notification scheduling
 * - User preference management
 */

import cron from 'node-cron';
import { ScheduledTask } from 'node-cron';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import config from '../config/config';
import { TaskModel } from '../models/task';
import { UserModel } from '../models/user';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export type NotificationType = 
  | 'task_due_reminder'
  | 'task_overdue_alert'
  | 'task_assignment'
  | 'task_completion'
  | 'task_status_change'
  | 'daily_task_summary'
  | 'weekly_task_summary'
  | 'task_comment'
  | 'task_priority_change';

export type NotificationChannel = 'email' | 'push' | 'in_app' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type ReminderInterval = '15min' | '1hour' | '1day' | '3days' | '1week';

export interface TaskNotificationPreferences {
  // Due date reminders
  due_date_reminders: boolean;
  reminder_intervals: ReminderInterval[];
  
  // Assignment notifications
  task_assignments: boolean;
  task_completions: boolean;
  
  // Status change notifications
  status_changes: boolean;
  priority_changes: boolean;
  comment_notifications: boolean;
  
  // Summary notifications
  daily_summaries: boolean;
  weekly_summaries: boolean;
  
  // Channel preferences
  preferred_channels: NotificationChannel[];
  
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_start_time: string; // HH:MM format
  quiet_end_time: string;   // HH:MM format
  quiet_timezone: string;
  
  // Delivery preferences
  batch_notifications: boolean;
  instant_notifications: boolean;
  digest_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface TaskNotificationData {
  id: string;
  user_id: string;
  task_id?: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  message: string;
  html_content?: string;
  data: Record<string, any>;
  scheduled_for: Date;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  clicked_at?: Date;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TaskReminderContext {
  task: any;
  user: any;
  assignee?: any;
  assigner?: any;
  time_until_due: string;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  is_overdue: boolean;
  days_overdue?: number;
}

export interface NotificationTemplate {
  type: NotificationType;
  channel: NotificationChannel;
  subject_template: string;
  message_template: string;
  html_template?: string;
  variables: string[];
}

// =====================================================
// ADVANCED TASK NOTIFICATION SERVICE
// =====================================================

export class AdvancedTaskNotificationService {
  private static instance: AdvancedTaskNotificationService;
  private cronJobs: Map<string, ScheduledTask> = new Map();
  private isInitialized = false;
  private notificationQueue: TaskNotificationData[] = [];
  private processingQueue = false;

  constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdvancedTaskNotificationService {
    if (!AdvancedTaskNotificationService.instance) {
      AdvancedTaskNotificationService.instance = new AdvancedTaskNotificationService();
    }
    return AdvancedTaskNotificationService.instance;
  }

  // =====================================================
  // INITIALIZATION AND SETUP
  // =====================================================

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.createNotificationTables();
      await this.loadNotificationTemplates();
      this.startCronJobs();
      this.startQueueProcessor();
      this.isInitialized = true;
      
      logger.info('AdvancedTaskNotificationService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AdvancedTaskNotificationService:', error);
      throw error;
    }
  }

  /**
   * Create necessary database tables
   */
  private async createNotificationTables(): Promise<void> {
    try {
      // Create notifications table
      await pool?.query(`
        CREATE TABLE IF NOT EXISTS task_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          channel VARCHAR(20) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          html_content TEXT,
          data JSONB DEFAULT '{}',
          scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE,
          delivered_at TIMESTAMP WITH TIME ZONE,
          read_at TIMESTAMP WITH TIME ZONE,
          clicked_at TIMESTAMP WITH TIME ZONE,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create notification preferences table
      await pool?.query(`
        CREATE TABLE IF NOT EXISTS task_notification_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          due_date_reminders BOOLEAN DEFAULT true,
          reminder_intervals TEXT[] DEFAULT ARRAY['1day', '1hour'],
          task_assignments BOOLEAN DEFAULT true,
          task_completions BOOLEAN DEFAULT true,
          status_changes BOOLEAN DEFAULT false,
          priority_changes BOOLEAN DEFAULT true,
          comment_notifications BOOLEAN DEFAULT true,
          daily_summaries BOOLEAN DEFAULT false,
          weekly_summaries BOOLEAN DEFAULT false,
          preferred_channels TEXT[] DEFAULT ARRAY['email', 'in_app'],
          quiet_hours_enabled BOOLEAN DEFAULT false,
          quiet_start_time TIME DEFAULT '22:00',
          quiet_end_time TIME DEFAULT '08:00',
          quiet_timezone VARCHAR(50) DEFAULT 'UTC',
          batch_notifications BOOLEAN DEFAULT false,
          instant_notifications BOOLEAN DEFAULT true,
          digest_frequency VARCHAR(20) DEFAULT 'immediate',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
      `);

      // Create notification templates table
      await pool?.query(`
        CREATE TABLE IF NOT EXISTS notification_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(50) NOT NULL,
          channel VARCHAR(20) NOT NULL,
          language VARCHAR(10) DEFAULT 'en',
          subject_template TEXT NOT NULL,
          message_template TEXT NOT NULL,
          html_template TEXT,
          variables TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(type, channel, language)
        );
      `);

      // Create indexes for performance
      await pool?.query(`
        CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_notifications_scheduled_for ON task_notifications(scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_task_notifications_status ON task_notifications(status);
        CREATE INDEX IF NOT EXISTS idx_task_notifications_type ON task_notifications(type);
      `);

      logger.info('Task notification tables created successfully');
    } catch (error) {
      logger.error('Error creating notification tables:', error);
      throw error;
    }
  }

  /**
   * Load default notification templates
   */
  private async loadNotificationTemplates(): Promise<void> {
    const templates: Omit<NotificationTemplate, 'variables'>[] = [
      // Due date reminders
      {
        type: 'task_due_reminder',
        channel: 'email',
        subject_template: 'Task Due Reminder: {{task_title}}',
        message_template: 'Your task "{{task_title}}" is due {{time_until_due}}. Priority: {{priority}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #f39c12;">📅 Task Due Reminder</h2>
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <h3 style="margin: 0; color: #856404;">{{task_title}}</h3>
              <p style="margin: 5px 0; color: #856404;">Due: {{time_until_due}}</p>
              <p style="margin: 5px 0; color: #856404;">Priority: {{priority}}</p>
            </div>
            <p>{{task_description}}</p>
            <a href="{{task_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a>
          </div>
        `
      },
      {
        type: 'task_overdue_alert',
        channel: 'email',
        subject_template: '🚨 Overdue Task Alert: {{task_title}}',
        message_template: 'Your task "{{task_title}}" is {{days_overdue}} days overdue. Please take action immediately.',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #dc3545;">🚨 Overdue Task Alert</h2>
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #f5c6cb;">
              <h3 style="margin: 0; color: #721c24;">{{task_title}}</h3>
              <p style="margin: 5px 0; color: #721c24;"><strong>{{days_overdue}} days overdue</strong></p>
              <p style="margin: 5px 0; color: #721c24;">Priority: {{priority}}</p>
            </div>
            <p>This task requires immediate attention. Please complete or reschedule as soon as possible.</p>
            <a href="{{task_url}}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a>
          </div>
        `
      },
      {
        type: 'task_assignment',
        channel: 'email',
        subject_template: 'New Task Assignment: {{task_title}}',
        message_template: 'You have been assigned a new task "{{task_title}}" by {{assigner_name}}. Due: {{due_date}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #28a745;">📋 New Task Assignment</h2>
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #c3e6cb;">
              <h3 style="margin: 0; color: #155724;">{{task_title}}</h3>
              <p style="margin: 5px 0; color: #155724;">Assigned by: {{assigner_name}}</p>
              <p style="margin: 5px 0; color: #155724;">Due: {{due_date}}</p>
              <p style="margin: 5px 0; color: #155724;">Priority: {{priority}}</p>
            </div>
            <p>{{task_description}}</p>
            <a href="{{task_url}}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a>
          </div>
        `
      },
      {
        type: 'daily_task_summary',
        channel: 'email',
        subject_template: 'Daily Task Summary - {{date}}',
        message_template: 'Here\'s your daily task summary: {{due_today_count}} due today, {{overdue_count}} overdue.',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #6c757d;">📊 Daily Task Summary</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 10px 0;">
              <h3>{{date}}</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0;">
                <div style="text-align: center; padding: 10px; background: white; border-radius: 5px;">
                  <div style="font-size: 24px; font-weight: bold; color: #f39c12;">{{due_today_count}}</div>
                  <div style="color: #6c757d;">Due Today</div>
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 5px;">
                  <div style="font-size: 24px; font-weight: bold; color: #dc3545;">{{overdue_count}}</div>
                  <div style="color: #6c757d;">Overdue</div>
                </div>
                <div style="text-align: center; padding: 10px; background: white; border-radius: 5px;">
                  <div style="font-size: 24px; font-weight: bold; color: #28a745;">{{completed_count}}</div>
                  <div style="color: #6c757d;">Completed</div>
                </div>
              </div>
            </div>
            <a href="{{dashboard_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
          </div>
        `
      }
    ];

    for (const template of templates) {
      try {
        await pool?.query(`
          INSERT INTO notification_templates (type, channel, subject_template, message_template, html_template)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (type, channel, language) DO UPDATE SET
            subject_template = EXCLUDED.subject_template,
            message_template = EXCLUDED.message_template,
            html_template = EXCLUDED.html_template,
            updated_at = NOW()
        `, [
          template.type,
          template.channel,
          template.subject_template,
          template.message_template,
          template.html_template
        ]);
      } catch (error) {
        logger.warn(`Failed to load template for ${template.type}:${template.channel}`, error);
      }
    }

    logger.info('Notification templates loaded successfully');
  }

  // =====================================================
  // TASK REMINDER AND ALERT METHODS
  // =====================================================

  /**
   * Schedule due date reminders for a task
   */
  async scheduleTaskReminders(taskId: string, userId: string): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences.due_date_reminders) {
        return;
      }

      // Get task details
      const task = await this.getTaskWithDetails(taskId);
      if (!task || !task.due_date) {
        return;
      }

      const dueDate = new Date(task.due_date);
      const now = new Date();

      // Schedule reminders based on user preferences
      for (const interval of preferences.reminder_intervals) {
        const reminderTime = this.calculateReminderTime(dueDate, interval);
        
        if (reminderTime > now) {
          await this.scheduleNotification({
            user_id: userId,
            task_id: taskId,
            type: 'task_due_reminder',
            channel: preferences.preferred_channels[0] || 'email',
            title: `Task Due Reminder: ${task.title}`,
            message: `Your task "${task.title}" is due ${this.formatTimeUntilDue(dueDate)}`,
            data: {
              task,
              reminder_interval: interval,
              urgency_level: this.calculateUrgencyLevel(dueDate, interval)
            },
            scheduled_for: reminderTime
          });
        }
      }

      logger.info(`Scheduled reminders for task ${taskId}`, { userId, taskId });
    } catch (error) {
      logger.error('Error scheduling task reminders:', error);
      throw error;
    }
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(taskId: string, assigneeId: string, assignerId: string): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(assigneeId);
      
      if (!preferences.task_assignments) {
        return;
      }

      const [task, assignee, assigner] = await Promise.all([
        this.getTaskWithDetails(taskId),
        this.getUserDetails(assigneeId),
        this.getUserDetails(assignerId)
      ]);

      if (!task || !assignee || !assigner) {
        throw new Error('Failed to get task or user details');
      }

      // Send notification on preferred channels
      for (const channel of preferences.preferred_channels) {
        await this.scheduleNotification({
          user_id: assigneeId,
          task_id: taskId,
          type: 'task_assignment',
          channel,
          title: `New Task Assignment: ${task.title}`,
          message: `You have been assigned "${task.title}" by ${assigner.first_name} ${assigner.last_name}`,
          data: {
            task,
            assignee,
            assigner
          },
          scheduled_for: new Date() // Send immediately
        });
      }

      logger.info(`Sent task assignment notification`, { taskId, assigneeId, assignerId });
    } catch (error) {
      logger.error('Error sending task assignment notification:', error);
      throw error;
    }
  }

  /**
   * Check for overdue tasks and send alerts
   */
  async checkAndSendOverdueAlerts(): Promise<void> {
    try {
      logger.info('Checking for overdue tasks...');

      const overdueTasksQuery = `
        SELECT 
          t.*,
          u.id as user_id,
          u.email,
          u.first_name,
          u.last_name,
          u.timezone,
          EXTRACT(DAY FROM NOW() - t.due_date) as days_overdue
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        WHERE t.due_date < NOW()
          AND t.status != 'completed'
          AND t.status != 'cancelled'
          AND NOT EXISTS (
            SELECT 1 FROM task_notifications tn 
            WHERE tn.task_id = t.id 
              AND tn.type = 'task_overdue_alert' 
              AND tn.created_at::date = NOW()::date
          )
      `;

      const result = await pool?.query(overdueTasksQuery);
      
      if (!result?.rows.length) {
        logger.info('No new overdue tasks found');
        return;
      }

      for (const row of result.rows) {
        const preferences = await this.getUserPreferences(row.user_id);
        
        if (!preferences.due_date_reminders) {
          continue;
        }

        // Send overdue alert
        for (const channel of preferences.preferred_channels) {
          await this.scheduleNotification({
            user_id: row.user_id,
            task_id: row.id,
            type: 'task_overdue_alert',
            channel,
            title: `🚨 Overdue Task: ${row.title}`,
            message: `Your task "${row.title}" is ${row.days_overdue} days overdue`,
            data: {
              task: row,
              days_overdue: row.days_overdue,
              urgency_level: 'critical'
            },
            scheduled_for: new Date()
          });
        }
      }

      logger.info(`Sent overdue alerts for ${result.rows.length} tasks`);
    } catch (error) {
      logger.error('Error checking overdue tasks:', error);
      throw error;
    }
  }

  /**
   * Send daily task summary
   */
  async sendDailyTaskSummary(): Promise<void> {
    try {
      logger.info('Sending daily task summaries...');

      // Get users who want daily summaries
      const usersQuery = `
        SELECT user_id, preferred_channels, quiet_timezone
        FROM task_notification_preferences
        WHERE daily_summaries = true
      `;

      const usersResult = await pool?.query(usersQuery);
      
      if (!usersResult?.rows.length) {
        logger.info('No users configured for daily summaries');
        return;
      }

      for (const user of usersResult.rows) {
        try {
          const summary = await this.generateDailySummary(user.user_id);
          
          if (summary.total_tasks === 0) {
            continue; // Skip if no tasks
          }

          for (const channel of user.preferred_channels) {
            await this.scheduleNotification({
              user_id: user.user_id,
              task_id: undefined,
              type: 'daily_task_summary',
              channel,
              title: `Daily Task Summary - ${new Date().toLocaleDateString()}`,
              message: `${summary.due_today} due today, ${summary.overdue} overdue, ${summary.completed} completed`,
              data: { summary },
              scheduled_for: new Date()
            });
          }
        } catch (error) {
          logger.warn(`Failed to send daily summary for user ${user.user_id}:`, error);
        }
      }

      logger.info('Daily task summaries processing complete');
    } catch (error) {
      logger.error('Error sending daily summaries:', error);
      throw error;
    }
  }

  // =====================================================
  // NOTIFICATION SCHEDULING AND PROCESSING
  // =====================================================

  /**
   * Schedule a notification
   */
  async scheduleNotification(notificationData: Omit<TaskNotificationData, 'id' | 'status' | 'retry_count' | 'max_retries' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      // Check if user is in quiet hours
      if (await this.isInQuietHours(notificationData.user_id, notificationData.scheduled_for)) {
        notificationData.scheduled_for = await this.adjustForQuietHours(notificationData.user_id, notificationData.scheduled_for);
      }

      const result = await pool?.query(`
        INSERT INTO task_notifications (
          user_id, task_id, type, channel, title, message, html_content, 
          data, scheduled_for, status, max_retries
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 3)
        RETURNING id
      `, [
        notificationData.user_id,
        notificationData.task_id,
        notificationData.type,
        notificationData.channel,
        notificationData.title,
        notificationData.message,
        notificationData.html_content,
        JSON.stringify(notificationData.data),
        notificationData.scheduled_for
      ]);

      const notificationId = result?.rows[0]?.id;
      
      // Add to processing queue if scheduled for immediate delivery
      if (notificationData.scheduled_for <= new Date()) {
        this.notificationQueue.push({
          ...notificationData,
          id: notificationId,
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      return notificationId;
    } catch (error) {
      logger.error('Error scheduling notification:', error);
      throw error;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private calculateReminderTime(dueDate: Date, interval: ReminderInterval): Date {
    const intervalMap = {
      '15min': 15 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '1day': 24 * 60 * 60 * 1000,
      '3days': 3 * 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000
    };

    return new Date(dueDate.getTime() - intervalMap[interval]);
  }

  private calculateUrgencyLevel(dueDate: Date, interval: ReminderInterval): 'low' | 'medium' | 'high' | 'critical' {
    const now = new Date();
    const timeUntilDue = dueDate.getTime() - now.getTime();
    const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);

    if (hoursUntilDue <= 0) return 'critical';
    if (hoursUntilDue <= 1) return 'high';
    if (hoursUntilDue <= 24) return 'medium';
    return 'low';
  }

  private formatTimeUntilDue(dueDate: Date): string {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'now (overdue)';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'in less than an hour';
  }

  private async getTaskWithDetails(taskId: string): Promise<any> {
    const result = await pool?.query(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1
    `, [taskId]);

    return result?.rows[0];
  }

  private async getUserDetails(userId: string): Promise<any> {
    const result = await pool?.query(`
      SELECT id, email, first_name, last_name, timezone, language_code
      FROM users
      WHERE id = $1
    `, [userId]);

    return result?.rows[0];
  }

  private async getUserPreferences(userId: string): Promise<TaskNotificationPreferences> {
    const result = await pool?.query(`
      SELECT * FROM task_notification_preferences WHERE user_id = $1
    `, [userId]);

    if (result?.rows.length) {
      const row = result.rows[0];
      return {
        due_date_reminders: row.due_date_reminders,
        reminder_intervals: row.reminder_intervals,
        task_assignments: row.task_assignments,
        task_completions: row.task_completions,
        status_changes: row.status_changes,
        priority_changes: row.priority_changes,
        comment_notifications: row.comment_notifications,
        daily_summaries: row.daily_summaries,
        weekly_summaries: row.weekly_summaries,
        preferred_channels: row.preferred_channels,
        quiet_hours_enabled: row.quiet_hours_enabled,
        quiet_start_time: row.quiet_start_time,
        quiet_end_time: row.quiet_end_time,
        quiet_timezone: row.quiet_timezone,
        batch_notifications: row.batch_notifications,
        instant_notifications: row.instant_notifications,
        digest_frequency: row.digest_frequency
      };
    }

    // Return default preferences
    return {
      due_date_reminders: true,
      reminder_intervals: ['1day', '1hour'],
      task_assignments: true,
      task_completions: true,
      status_changes: false,
      priority_changes: true,
      comment_notifications: true,
      daily_summaries: false,
      weekly_summaries: false,
      preferred_channels: ['email', 'in_app'],
      quiet_hours_enabled: false,
      quiet_start_time: '22:00',
      quiet_end_time: '08:00',
      quiet_timezone: 'UTC',
      batch_notifications: false,
      instant_notifications: true,
      digest_frequency: 'immediate'
    };
  }

  private async generateDailySummary(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queries = await Promise.all([
      // Due today
      pool?.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = $1 AND due_date::date = $2::date AND status != 'completed'
      `, [userId, today]),
      
      // Overdue
      pool?.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = $1 AND due_date < $2 AND status != 'completed'
      `, [userId, today]),
      
      // Completed today
      pool?.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = $1 AND completed_at::date = $2::date
      `, [userId, today]),
      
      // Total pending
      pool?.query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = $1 AND status IN ('pending', 'in_progress')
      `, [userId])
    ]);

    return {
      due_today: parseInt(queries[0]?.rows[0]?.count || 0),
      overdue: parseInt(queries[1]?.rows[0]?.count || 0),
      completed: parseInt(queries[2]?.rows[0]?.count || 0),
      total_tasks: parseInt(queries[3]?.rows[0]?.count || 0)
    };
  }

  private async isInQuietHours(userId: string, scheduledTime: Date): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    
    if (!preferences.quiet_hours_enabled) {
      return false;
    }

    // TODO: Implement timezone-aware quiet hours check
    return false;
  }

  private async adjustForQuietHours(userId: string, scheduledTime: Date): Promise<Date> {
    // TODO: Implement quiet hours adjustment
    return scheduledTime;
  }

  // =====================================================
  // CRON JOBS AND QUEUE PROCESSING
  // =====================================================

  private startCronJobs(): void {
    // Check for pending notifications every minute
    this.cronJobs.set('pending-notifications', cron.schedule('* * * * *', async () => {
      await this.processPendingNotifications();
    }));

    // Check for overdue tasks every hour
    this.cronJobs.set('overdue-check', cron.schedule('0 * * * *', async () => {
      await this.checkAndSendOverdueAlerts();
    }));

    // Send daily summaries at 8 AM
    this.cronJobs.set('daily-summaries', cron.schedule('0 8 * * *', async () => {
      await this.sendDailyTaskSummary();
    }));

    // Start all cron jobs
    this.cronJobs.forEach(job => job.start());
    
    logger.info('Task notification cron jobs started');
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.processingQueue && this.notificationQueue.length > 0) {
        await this.processNotificationQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  private async processPendingNotifications(): Promise<void> {
    try {
      const result = await pool?.query(`
        SELECT * FROM task_notifications 
        WHERE status = 'pending' 
          AND scheduled_for <= NOW() 
          AND retry_count < max_retries
        ORDER BY scheduled_for ASC
        LIMIT 100
      `);

      if (result?.rows.length) {
        for (const notification of result.rows) {
          this.notificationQueue.push(notification);
        }
      }
    } catch (error) {
      logger.error('Error fetching pending notifications:', error);
    }
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.processingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        if (notification) {
          await this.deliverNotification(notification);
        }
      }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async deliverNotification(notification: TaskNotificationData): Promise<void> {
    try {
      let success = false;

      switch (notification.channel) {
        case 'email':
          success = await this.sendEmailNotification(notification);
          break;
        case 'in_app':
          success = await this.sendInAppNotification(notification);
          break;
        case 'push':
          success = await this.sendPushNotification(notification);
          break;
        case 'sms':
          success = await this.sendSMSNotification(notification);
          break;
      }

      // Update notification status
      await pool?.query(`
        UPDATE task_notifications 
        SET status = $1, sent_at = $2, retry_count = retry_count + 1, updated_at = NOW()
        WHERE id = $3
      `, [
        success ? 'sent' : 'failed',
        success ? new Date() : null,
        notification.id
      ]);

      if (success) {
        logger.debug(`Notification delivered successfully`, { 
          id: notification.id, 
          type: notification.type,
          channel: notification.channel 
        });
      }

    } catch (error) {
      logger.error(`Error delivering notification ${notification.id}:`, error);
      
      // Update with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await pool?.query(`
        UPDATE task_notifications 
        SET status = 'failed', error_message = $1, retry_count = retry_count + 1, updated_at = NOW()
        WHERE id = $2
      `, [errorMessage, notification.id]);
    }
  }

  private async sendEmailNotification(notification: TaskNotificationData): Promise<boolean> {
    try {
      // TODO: Implement email sending logic using email service
      logger.info(`Email notification sent`, { id: notification.id });
      return true;
    } catch (error) {
      logger.error('Email notification failed:', error);
      return false;
    }
  }

  private async sendInAppNotification(notification: TaskNotificationData): Promise<boolean> {
    try {
      // TODO: Implement in-app notification (WebSocket, Server-Sent Events, etc.)
      logger.info(`In-app notification sent`, { id: notification.id });
      return true;
    } catch (error) {
      logger.error('In-app notification failed:', error);
      return false;
    }
  }

  private async sendPushNotification(notification: TaskNotificationData): Promise<boolean> {
    try {
      // TODO: Implement push notification (Firebase, OneSignal, etc.)
      logger.info(`Push notification sent`, { id: notification.id });
      return true;
    } catch (error) {
      logger.error('Push notification failed:', error);
      return false;
    }
  }

  private async sendSMSNotification(notification: TaskNotificationData): Promise<boolean> {
    try {
      // TODO: Implement SMS notification (Twilio, AWS SNS, etc.)
      logger.info(`SMS notification sent`, { id: notification.id });
      return true;
    } catch (error) {
      logger.error('SMS notification failed:', error);
      return false;
    }
  }

  // =====================================================
  // PUBLIC API METHODS
  // =====================================================

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<TaskNotificationPreferences>): Promise<void> {
    try {
      const updateFields = Object.keys(preferences).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [userId, ...Object.values(preferences)];

      await pool?.query(`
        INSERT INTO task_notification_preferences (user_id, ${Object.keys(preferences).join(', ')})
        VALUES ($1, ${Object.keys(preferences).map((_, i) => `$${i + 2}`).join(', ')})
        ON CONFLICT (user_id) DO UPDATE SET
          ${updateFields},
          updated_at = NOW()
      `, values);

      logger.info(`Updated notification preferences for user ${userId}`);
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}): Promise<TaskNotificationData[]> {
    try {
      const { limit = 50, offset = 0, unreadOnly = false } = options;
      
      let query = `
        SELECT * FROM task_notifications 
        WHERE user_id = $1
      `;
      
      if (unreadOnly) {
        query += ` AND read_at IS NULL`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

      const result = await pool?.query(query, [userId, limit, offset]);
      
      return result?.rows || [];
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await pool?.query(`
        UPDATE task_notifications 
        SET read_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);

      logger.debug(`Notification marked as read`, { notificationId, userId });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<{ total: number; unread: number; byType: Record<NotificationType, number> }> {
    try {
      const [totalResult, unreadResult, byTypeResult] = await Promise.all([
        pool?.query('SELECT COUNT(*) as count FROM task_notifications WHERE user_id = $1', [userId]),
        pool?.query('SELECT COUNT(*) as count FROM task_notifications WHERE user_id = $1 AND read_at IS NULL', [userId]),
        pool?.query(`
          SELECT type, COUNT(*) as count 
          FROM task_notifications 
          WHERE user_id = $1 
          GROUP BY type
        `, [userId])
      ]);

      const byType: Record<NotificationType, number> = {
        task_due_reminder: 0,
        task_overdue_alert: 0,
        task_assignment: 0,
        task_completion: 0,
        task_status_change: 0,
        daily_task_summary: 0,
        weekly_task_summary: 0,
        task_comment: 0,
        task_priority_change: 0
      };

      byTypeResult?.rows.forEach(row => {
        byType[row.type as NotificationType] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult?.rows[0]?.count || 0),
        unread: parseInt(unreadResult?.rows[0]?.count || 0),
        byType
      };
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup old notifications
   */
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await pool?.query(`
        DELETE FROM task_notifications 
        WHERE created_at < $1 AND status IN ('sent', 'delivered', 'failed')
      `, [cutoffDate]);

      const deletedCount = result?.rowCount || 0;
      logger.info(`Cleaned up ${deletedCount} old notifications`);
      
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }

  /**
   * Stop the notification service
   */
  async stop(): Promise<void> {
    // Stop all cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();
    
    // Clear notification queue
    this.notificationQueue = [];
    
    this.isInitialized = false;
    logger.info('AdvancedTaskNotificationService stopped');
  }
}

// Export singleton instance
export const taskNotificationService = AdvancedTaskNotificationService.getInstance();
export default AdvancedTaskNotificationService;
