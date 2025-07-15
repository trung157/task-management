/**
 * Enhanced Task Management with Error Handling
 * Demonstrates integration of error handling and recovery mechanisms
 */

import { useState, useCallback } from 'react';
import { useErrorHandler } from '../../contexts/ErrorContext';
import { useTaskApi } from '../../hooks/useApiError';
import { ErrorBoundary } from '../error/ErrorComponents';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
}

interface EnhancedTaskManagerProps {
  userId: string;
}

function TaskManagerContent({ userId }: EnhancedTaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const });
  
  const { addError, executeWithErrorHandling } = useErrorHandler();
  const { createTask, getTasks, updateTask, deleteTask } = useTaskApi();

  // Load tasks with error handling
  const loadTasks = useCallback(async () => {
    setLoading(true);
    const result = await executeWithErrorHandling(
      () => getTasks({ user_id: userId }),
      { component: 'TaskManager', action: 'loadTasks', userId },
      'Failed to load your tasks. Please try refreshing the page.'
    );
    
    if (result?.success) {
      setTasks(result.data || []);
    }
    setLoading(false);
  }, [userId, getTasks, executeWithErrorHandling]);

  // Create task with optimistic updates and error recovery
  const handleCreateTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      addError({
        code: 'VALIDATION_ERROR',
        message: 'Task title is required',
        action: 'Please enter a title for your task.',
        title: 'Missing Title',
        severity: 'low',
        retryable: false,
      });
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      title: newTask.title,
      description: newTask.description,
      status: 'pending',
      priority: newTask.priority,
    };

    // Optimistic update
    setTasks(prev => [...prev, optimisticTask]);
    setNewTask({ title: '', description: '', priority: 'medium' });

    const result = await executeWithErrorHandling(
      () => createTask({
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
      }),
      { 
        component: 'TaskManager', 
        action: 'createTask', 
        userId,
        optimisticTask 
      },
      'Failed to create task. Your changes have been reverted.'
    );

    if (result?.success) {
      // Replace optimistic task with real task
      setTasks(prev => prev.map(task => 
        task.id === tempId ? result.data : task
      ));
    } else {
      // Revert optimistic update
      setTasks(prev => prev.filter(task => task.id !== tempId));
      setNewTask({ title: newTask.title, description: newTask.description, priority: newTask.priority });
    }
  }, [newTask, createTask, executeWithErrorHandling, addError, userId]);

  // Update task with error handling
  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const originalTask = tasks.find(t => t.id === taskId);
    if (!originalTask) return;

    // Optimistic update
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));

    const result = await executeWithErrorHandling(
      () => updateTask(taskId, updates),
      { 
        component: 'TaskManager', 
        action: 'updateTask', 
        taskId, 
        updates,
        originalTask 
      },
      'Failed to update task. Your changes have been reverted.'
    );

    if (!result?.success) {
      // Revert optimistic update
      setTasks(prev => prev.map(task => 
        task.id === taskId ? originalTask : task
      ));
    }
  }, [tasks, updateTask, executeWithErrorHandling]);

  // Delete task with confirmation and error handling
  const handleDeleteTask = useCallback(async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    if (!window.confirm(`Are you sure you want to delete "${taskToDelete.title}"?`)) {
      return;
    }

    // Optimistic update
    setTasks(prev => prev.filter(task => task.id !== taskId));

    const result = await executeWithErrorHandling(
      () => deleteTask(taskId),
      { 
        component: 'TaskManager', 
        action: 'deleteTask', 
        taskId,
        deletedTask: taskToDelete 
      },
      'Failed to delete task. The task has been restored.'
    );

    if (!result?.success) {
      // Restore deleted task
      setTasks(prev => {
        const newTasks = [...prev];
        const originalIndex = tasks.findIndex(t => t.id === taskId);
        newTasks.splice(originalIndex, 0, taskToDelete);
        return newTasks;
      });
    }
  }, [tasks, deleteTask, executeWithErrorHandling]);

  // Simulate network error for testing
  const handleTestError = useCallback(() => {
    addError({
      code: 'TEST_ERROR',
      message: 'This is a test error to demonstrate the error handling system.',
      action: 'This error was generated for testing purposes. You can safely dismiss it.',
      title: 'Test Error',
      severity: 'medium',
      retryable: true,
    }, {
      canRetry: true,
      maxRetries: 3,
    }, {
      component: 'TaskManager',
      action: 'testError',
      intentional: true,
    });
  }, [addError]);

  return (
    <div className="enhanced-task-manager">
      <div className="task-manager-header">
        <h2>Enhanced Task Manager</h2>
        <p>Demonstrates comprehensive error handling and recovery</p>
        <button 
          onClick={handleTestError}
          className="test-error-btn"
          title="Generate a test error to see error handling in action"
        >
          Test Error Handling
        </button>
      </div>

      {/* Create Task Form */}
      <div className="create-task-form">
        <h3>Create New Task</h3>
        <input
          type="text"
          placeholder="Task title"
          value={newTask.title}
          onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
        />
        <textarea
          placeholder="Task description"
          value={newTask.description}
          onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
        />
        <select
          value={newTask.priority}
          onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <button onClick={handleCreateTask} disabled={loading}>
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </div>

      {/* Tasks List */}
      <div className="tasks-list">
        <div className="tasks-header">
          <h3>Your Tasks ({tasks.length})</h3>
          <button onClick={loadTasks} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {loading && tasks.length === 0 ? (
          <div className="loading-state">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet. Create your first task above!</p>
          </div>
        ) : (
          <div className="task-items">
            {tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Task Item Component with Error Handling
interface TaskItemProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

function TaskItem({ task, onUpdate, onDelete }: TaskItemProps) {
  const handlePriorityChange = useCallback((priority: Task['priority']) => {
    onUpdate(task.id, { priority });
  }, [task.id, onUpdate]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  return (
    <div className={`task-item task-item--${task.status}`}>
      <div className="task-item-header">
        <span className="task-status-icon">{getStatusIcon(task.status)}</span>
        <h4 className="task-title">{task.title}</h4>
        <span 
          className="task-priority-badge"
          style={{ backgroundColor: getPriorityColor(task.priority) }}
        >
          {task.priority}
        </span>
      </div>
      
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      
      <div className="task-actions">
        <select
          value={task.status}
          onChange={(e) => onUpdate(task.id, { status: e.target.value as Task['status'] })}
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        
        <select
          value={task.priority}
          onChange={(e) => handlePriorityChange(e.target.value as Task['priority'])}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        
        <button 
          onClick={() => onDelete(task.id)}
          className="delete-btn"
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// Main component wrapped in error boundary
export function EnhancedTaskManager(props: EnhancedTaskManagerProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('TaskManager Error Boundary caught error:', error, errorInfo);
      }}
    >
      <TaskManagerContent {...props} />
    </ErrorBoundary>
  );
}
