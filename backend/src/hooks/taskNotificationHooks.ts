/**
 * Task Notification Hooks
 * 
 * Event-driven hooks that automatically trigger notifications
 * when task-related events occur:
 * - Task creation
 * - Task assignment
 * - Task status changes
 * - Task due date changes
 * - Task completion
 * - Task priority changes
 */

import { AdvancedTaskNotificationService } from '../services/advancedTaskNotificationService';
import { logger } from '../utils/logger';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export interface TaskEvent {
  type: 'created' | 'updated' | 'assigned' | 'completed' | 'deleted' | 'status_changed' | 'priority_changed' | 'due_date_changed';
  task: any;
  user: any;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
}

export interface TaskAssignmentEvent {
  type: 'assigned' | 'unassigned' | 'reassigned';
  task: any;
  assignee: any;
  assigner: any;
  previousAssignee?: any;
}

// =====================================================
// TASK NOTIFICATION HOOKS CLASS
// =====================================================

export class TaskNotificationHooks {
  private static instance: TaskNotificationHooks;
  private notificationService: AdvancedTaskNotificationService;

  constructor() {
    this.notificationService = AdvancedTaskNotificationService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TaskNotificationHooks {
    if (!TaskNotificationHooks.instance) {
      TaskNotificationHooks.instance = new TaskNotificationHooks();
    }
    return TaskNotificationHooks.instance;
  }

  // =====================================================
  // TASK LIFECYCLE HOOKS
  // =====================================================

  /**
   * Handle task creation
   */
  async onTaskCreated(taskEvent: TaskEvent): Promise<void> {
    try {
      const { task, user } = taskEvent;

      logger.info('Task created hook triggered', { 
        taskId: task.id, 
        userId: user.id, 
        title: task.title 
      });

      // Schedule due date reminders if task has a due date
      if (task.due_date && task.user_id) {
        await this.notificationService.scheduleTaskReminders(task.id, task.user_id);
      }

      // If task is assigned to someone other than creator, send assignment notification
      if (task.assigned_to && task.assigned_to !== user.id) {
        await this.notificationService.sendTaskAssignmentNotification(
          task.id,
          task.assigned_to,
          user.id
        );
      }

      logger.debug('Task creation notifications processed', { taskId: task.id });
    } catch (error) {
      logger.error('Error in onTaskCreated hook:', error);
    }
  }

  /**
   * Handle task updates
   */
  async onTaskUpdated(taskEvent: TaskEvent): Promise<void> {
    try {
      const { task, user, changes } = taskEvent;

      if (!changes) {
        return;
      }

      logger.info('Task updated hook triggered', { 
        taskId: task.id, 
        userId: user.id, 
        changedFields: Object.keys(changes) 
      });

      // Handle due date changes
      if (changes.due_date) {
        await this.handleDueDateChange(task, user, changes.due_date);
      }

      // Handle status changes
      if (changes.status) {
        await this.handleStatusChange(task, user, changes.status);
      }

      // Handle priority changes
      if (changes.priority) {
        await this.handlePriorityChange(task, user, changes.priority);
      }

      // Handle assignment changes
      if (changes.assigned_to) {
        await this.handleAssignmentChange(task, user, changes.assigned_to);
      }

      logger.debug('Task update notifications processed', { taskId: task.id });
    } catch (error) {
      logger.error('Error in onTaskUpdated hook:', error);
    }
  }

  /**
   * Handle task completion
   */
  async onTaskCompleted(taskEvent: TaskEvent): Promise<void> {
    try {
      const { task, user } = taskEvent;

      logger.info('Task completed hook triggered', { 
        taskId: task.id, 
        userId: user.id, 
        title: task.title 
      });

      // Notify task creator if different from completer
      if (task.user_id && task.user_id !== user.id) {
        await this.notificationService.scheduleNotification({
          user_id: task.user_id,
          task_id: task.id,
          type: 'task_completion',
          channel: 'email',
          title: `Task Completed: ${task.title}`,
          message: `Your task "${task.title}" has been completed by ${user.first_name} ${user.last_name}`,
          data: { task, completer: user },
          scheduled_for: new Date()
        });
      }

      // Notify assignee if different from completer and creator
      if (task.assigned_to && 
          task.assigned_to !== user.id && 
          task.assigned_to !== task.user_id) {
        await this.notificationService.scheduleNotification({
          user_id: task.assigned_to,
          task_id: task.id,
          type: 'task_completion',
          channel: 'email',
          title: `Task Completed: ${task.title}`,
          message: `Task "${task.title}" has been completed by ${user.first_name} ${user.last_name}`,
          data: { task, completer: user },
          scheduled_for: new Date()
        });
      }

      logger.debug('Task completion notifications sent', { taskId: task.id });
    } catch (error) {
      logger.error('Error in onTaskCompleted hook:', error);
    }
  }

  /**
   * Handle task assignment
   */
  async onTaskAssigned(assignmentEvent: TaskAssignmentEvent): Promise<void> {
    try {
      const { task, assignee, assigner, previousAssignee } = assignmentEvent;

      logger.info('Task assignment hook triggered', { 
        taskId: task.id, 
        assigneeId: assignee.id, 
        assignerId: assigner.id 
      });

      // Send assignment notification to new assignee
      await this.notificationService.sendTaskAssignmentNotification(
        task.id,
        assignee.id,
        assigner.id
      );

      // If this is a reassignment, notify the previous assignee
      if (previousAssignee && previousAssignee.id !== assignee.id) {
        await this.notificationService.scheduleNotification({
          user_id: previousAssignee.id,
          task_id: task.id,
          type: 'task_status_change',
          channel: 'email',
          title: `Task Reassigned: ${task.title}`,
          message: `Task "${task.title}" has been reassigned to ${assignee.first_name} ${assignee.last_name}`,
          data: { 
            task, 
            newAssignee: assignee, 
            assigner,
            changeType: 'reassignment' 
          },
          scheduled_for: new Date()
        });
      }

      logger.debug('Task assignment notifications sent', { taskId: task.id });
    } catch (error) {
      logger.error('Error in onTaskAssigned hook:', error);
    }
  }

  // =====================================================
  // SPECIFIC CHANGE HANDLERS
  // =====================================================

  /**
   * Handle due date changes
   */
  private async handleDueDateChange(task: any, user: any, dueDateChange: { old: Date; new: Date }): Promise<void> {
    try {
      logger.debug('Handling due date change', { 
        taskId: task.id, 
        oldDate: dueDateChange.old, 
        newDate: dueDateChange.new 
      });

      // Cancel existing reminders and schedule new ones
      if (dueDateChange.new && task.user_id) {
        await this.notificationService.scheduleTaskReminders(task.id, task.user_id);
      }

      // Notify assigned user about due date change (if different from updater)
      if (task.assigned_to && task.assigned_to !== user.id) {
        const oldDateStr = dueDateChange.old ? new Date(dueDateChange.old).toLocaleDateString() : 'No due date';
        const newDateStr = dueDateChange.new ? new Date(dueDateChange.new).toLocaleDateString() : 'No due date';

        await this.notificationService.scheduleNotification({
          user_id: task.assigned_to,
          task_id: task.id,
          type: 'task_status_change',
          channel: 'email',
          title: `Due Date Changed: ${task.title}`,
          message: `The due date for "${task.title}" has been changed from ${oldDateStr} to ${newDateStr}`,
          data: { 
            task, 
            updater: user, 
            changeType: 'due_date',
            oldValue: dueDateChange.old,
            newValue: dueDateChange.new
          },
          scheduled_for: new Date()
        });
      }
    } catch (error) {
      logger.error('Error handling due date change:', error);
    }
  }

  /**
   * Handle status changes
   */
  private async handleStatusChange(task: any, user: any, statusChange: { old: string; new: string }): Promise<void> {
    try {
      logger.debug('Handling status change', { 
        taskId: task.id, 
        oldStatus: statusChange.old, 
        newStatus: statusChange.new 
      });

      // Handle completion specifically
      if (statusChange.new === 'completed') {
        await this.onTaskCompleted({ type: 'completed', task, user });
        return;
      }

      // Notify relevant users about status change
      const usersToNotify = [];

      // Add task creator
      if (task.user_id && task.user_id !== user.id) {
        usersToNotify.push(task.user_id);
      }

      // Add assignee
      if (task.assigned_to && 
          task.assigned_to !== user.id && 
          !usersToNotify.includes(task.assigned_to)) {
        usersToNotify.push(task.assigned_to);
      }

      // Send notifications
      for (const userId of usersToNotify) {
        await this.notificationService.scheduleNotification({
          user_id: userId,
          task_id: task.id,
          type: 'task_status_change',
          channel: 'email',
          title: `Status Changed: ${task.title}`,
          message: `Task "${task.title}" status changed from ${statusChange.old} to ${statusChange.new}`,
          data: { 
            task, 
            updater: user, 
            changeType: 'status',
            oldValue: statusChange.old,
            newValue: statusChange.new
          },
          scheduled_for: new Date()
        });
      }
    } catch (error) {
      logger.error('Error handling status change:', error);
    }
  }

  /**
   * Handle priority changes
   */
  private async handlePriorityChange(task: any, user: any, priorityChange: { old: string; new: string }): Promise<void> {
    try {
      logger.debug('Handling priority change', { 
        taskId: task.id, 
        oldPriority: priorityChange.old, 
        newPriority: priorityChange.new 
      });

      // Only notify for high priority changes or significant increases
      const priorityValues = { low: 1, medium: 2, high: 3, urgent: 4 };
      const oldLevel = priorityValues[priorityChange.old as keyof typeof priorityValues] || 1;
      const newLevel = priorityValues[priorityChange.new as keyof typeof priorityValues] || 1;

      // Notify if priority increased significantly or became high/urgent
      if (newLevel > oldLevel && (newLevel >= 3 || newLevel - oldLevel >= 2)) {
        const usersToNotify = [];

        // Add assignee
        if (task.assigned_to && task.assigned_to !== user.id) {
          usersToNotify.push(task.assigned_to);
        }

        // Add task creator if different
        if (task.user_id && 
            task.user_id !== user.id && 
            !usersToNotify.includes(task.user_id)) {
          usersToNotify.push(task.user_id);
        }

        // Send notifications
        for (const userId of usersToNotify) {
          await this.notificationService.scheduleNotification({
            user_id: userId,
            task_id: task.id,
            type: 'task_priority_change',
            channel: 'email',
            title: `Priority Changed: ${task.title}`,
            message: `Task "${task.title}" priority changed from ${priorityChange.old} to ${priorityChange.new}`,
            data: { 
              task, 
              updater: user, 
              changeType: 'priority',
              oldValue: priorityChange.old,
              newValue: priorityChange.new,
              urgencyLevel: newLevel >= 3 ? 'high' : 'medium'
            },
            scheduled_for: new Date()
          });
        }
      }
    } catch (error) {
      logger.error('Error handling priority change:', error);
    }
  }

  /**
   * Handle assignment changes
   */
  private async handleAssignmentChange(task: any, user: any, assignmentChange: { old: string; new: string }): Promise<void> {
    try {
      logger.debug('Handling assignment change', { 
        taskId: task.id, 
        oldAssignee: assignmentChange.old, 
        newAssignee: assignmentChange.new 
      });

      // Get assignee details
      const [oldAssignee, newAssignee] = await Promise.all([
        assignmentChange.old ? this.getUserDetails(assignmentChange.old) : null,
        assignmentChange.new ? this.getUserDetails(assignmentChange.new) : null
      ]);

      if (assignmentChange.new && newAssignee) {
        // Send assignment notification
        await this.onTaskAssigned({
          type: oldAssignee ? 'reassigned' : 'assigned',
          task,
          assignee: newAssignee,
          assigner: user,
          previousAssignee: oldAssignee
        });
      } else if (assignmentChange.old && oldAssignee && !assignmentChange.new) {
        // Task unassigned
        await this.notificationService.scheduleNotification({
          user_id: oldAssignee.id,
          task_id: task.id,
          type: 'task_status_change',
          channel: 'email',
          title: `Task Unassigned: ${task.title}`,
          message: `You have been unassigned from task "${task.title}"`,
          data: { 
            task, 
            unassigner: user, 
            changeType: 'unassignment' 
          },
          scheduled_for: new Date()
        });
      }
    } catch (error) {
      logger.error('Error handling assignment change:', error);
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Get user details by ID
   */
  private async getUserDetails(userId: string): Promise<any> {
    try {
      // This would typically use your user service or model
      // For now, returning a placeholder
      return {
        id: userId,
        first_name: 'User',
        last_name: 'Name',
        email: `user${userId}@example.com`
      };
    } catch (error) {
      logger.error('Error getting user details:', error);
      return null;
    }
  }

  // =====================================================
  // INTEGRATION METHODS
  // =====================================================

  /**
   * Initialize hooks integration
   */
  async initialize(): Promise<void> {
    try {
      // Ensure notification service is initialized
      await this.notificationService.initialize();
      
      logger.info('Task notification hooks initialized');
    } catch (error) {
      logger.error('Error initializing task notification hooks:', error);
      throw error;
    }
  }

  /**
   * Register hooks with task service/model
   * This method would be called by your task service to register these hooks
   */
  registerHooks(taskService: any): void {
    try {
      // Register event listeners
      if (taskService.on) {
        taskService.on('task:created', this.onTaskCreated.bind(this));
        taskService.on('task:updated', this.onTaskUpdated.bind(this));
        taskService.on('task:completed', this.onTaskCompleted.bind(this));
        taskService.on('task:assigned', this.onTaskAssigned.bind(this));
      }

      logger.info('Task notification hooks registered with task service');
    } catch (error) {
      logger.error('Error registering notification hooks:', error);
    }
  }

  /**
   * Manually trigger hooks for testing
   */
  async triggerTestNotifications(taskId: string, userId: string): Promise<void> {
    try {
      // Create test task data
      const testTask = {
        id: taskId,
        title: 'Test Task',
        description: 'This is a test task for notification testing',
        status: 'pending',
        priority: 'medium',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
        user_id: userId,
        assigned_to: userId
      };

      const testUser = {
        id: userId,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com'
      };

      // Trigger various hooks
      await this.onTaskCreated({ type: 'created', task: testTask, user: testUser });
      
      await this.onTaskUpdated({ 
        type: 'updated', 
        task: testTask, 
        user: testUser,
        changes: { 
          priority: { old: 'low', new: 'high' },
          status: { old: 'pending', new: 'in_progress' }
        }
      });

      logger.info('Test notifications triggered', { taskId, userId });
    } catch (error) {
      logger.error('Error triggering test notifications:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const taskNotificationHooks = TaskNotificationHooks.getInstance();
export default TaskNotificationHooks;
