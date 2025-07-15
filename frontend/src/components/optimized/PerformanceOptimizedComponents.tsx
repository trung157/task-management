/**
 * Performance-Optimized React Components
 * Memoized components for better rendering performance
 */

import React, { memo, useMemo, useCallback } from 'react';
import { Task, TaskPriority } from '../../types';

// Type definitions for components
interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onSetPriority: (id: string, priority: TaskPriority) => void;
  className?: string;
}

export const TaskItem = memo<TaskItemProps>(({ 
  task, 
  onDelete, 
  onToggleStatus,
  onSetPriority,
  className = ''
}) => {
  // Memoize event handlers to prevent unnecessary re-renders
  const handleStatusToggle = useCallback(() => {
    onToggleStatus(task.id);
  }, [task.id, onToggleStatus]);

  const handleDelete = useCallback(() => {
    onDelete(task.id);
  }, [task.id, onDelete]);

  const handlePriorityChange = useCallback((priority: TaskPriority) => {
    onSetPriority(task.id, priority);
  }, [task.id, onSetPriority]);

  // Memoize derived values to prevent recalculation
  const formattedDueDate = useMemo(() => {
    if (!task.due_date) return null;
    return new Date(task.due_date).toLocaleDateString();
  }, [task.due_date]);

  const isOverdue = useMemo(() => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  }, [task.due_date, task.status]);

  const priorityColor = useMemo(() => {
    const colors = {
      high: '#ef4444',
      medium: '#f59e0b', 
      low: '#10b981',
      none: '#6b7280'
    };
    return colors[task.priority] || colors.none;
  }, [task.priority]);

  const statusIcon = useMemo(() => {
    const icons = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      archived: '📁'
    };
    return icons[task.status] || '📝';
  }, [task.status]);

  return (
    <div 
      className={`task-item ${className} ${isOverdue ? 'overdue' : ''} ${task.status}`}
      data-task-id={task.id}
    >
      <div className="task-header">
        <button 
          className="status-toggle"
          onClick={handleStatusToggle}
          aria-label={`Toggle task status (currently ${task.status})`}
        >
          {statusIcon}
        </button>
        
        <h3 className="task-title">{task.title}</h3>
        
        <div 
          className="priority-indicator"
          style={{ backgroundColor: priorityColor }}
          title={`Priority: ${task.priority}`}
        />
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        {formattedDueDate && (
          <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
            📅 {formattedDueDate}
          </span>
        )}
        
        {task.tags && task.tags.length > 0 && (
          <div className="task-tags">
            {task.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="task-actions">
        <PrioritySelector
          currentPriority={task.priority}
          onPriorityChange={handlePriorityChange}
        />
        
        <button 
          className="delete-button"
          onClick={handleDelete}
          aria-label="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

// ===============================
// Optimized Priority Selector
// ===============================

interface PrioritySelectorProps {
  currentPriority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
}

const PrioritySelector = memo<PrioritySelectorProps>(({ 
  currentPriority, 
  onPriorityChange 
}) => {
  const priorities: { value: TaskPriority; label: string; color: string }[] = useMemo(() => [
    { value: TaskPriority.HIGH, label: 'High', color: '#ef4444' },
    { value: TaskPriority.MEDIUM, label: 'Medium', color: '#f59e0b' },
    { value: TaskPriority.LOW, label: 'Low', color: '#10b981' },
    { value: TaskPriority.NONE, label: 'None', color: '#6b7280' },
  ], []);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onPriorityChange(event.target.value as TaskPriority);
  }, [onPriorityChange]);

  return (
    <select 
      value={currentPriority} 
      onChange={handleChange}
      className="priority-selector"
    >
      {priorities.map(({ value, label, color }) => (
        <option key={value} value={value} style={{ color }}>
          {label}
        </option>
      ))}
    </select>
  );
});

PrioritySelector.displayName = 'PrioritySelector';

// ===============================
// Virtual Scrolling Task List
// ===============================

interface VirtualTaskListProps {
  tasks: Task[];
  height: number;
  itemHeight?: number;
  onTaskDelete: (id: string) => void;
  onTaskToggleStatus: (id: string) => void;
  onTaskSetPriority: (id: string, priority: TaskPriority) => void;
  className?: string;
}

export const VirtualTaskList = memo<VirtualTaskListProps>(({
  tasks,
  height,
  itemHeight = 120,
  onTaskDelete,
  onTaskToggleStatus,
  onTaskSetPriority,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate visible range
  const { visibleStart, visibleEnd, totalHeight } = useMemo(() => {
    const visibleCount = Math.ceil(height / itemHeight);
    const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const visibleEnd = Math.min(tasks.length, visibleStart + visibleCount + 4);
    const totalHeight = tasks.length * itemHeight;

    return { visibleStart, visibleEnd, totalHeight };
  }, [tasks.length, height, itemHeight, scrollTop]);

  // Get visible tasks
  const visibleTasks = useMemo(() => {
    return tasks.slice(visibleStart, visibleEnd);
  }, [tasks, visibleStart, visibleEnd]);

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`virtual-task-list ${className}`}
      style={{ height, overflowY: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${visibleStart * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleTasks.map((task) => (
            <div 
              key={task.id}
              style={{ height: itemHeight }}
            >
              <TaskItem
                task={task}
                onDelete={onTaskDelete}
                onToggleStatus={onTaskToggleStatus}
                onSetPriority={onTaskSetPriority}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

VirtualTaskList.displayName = 'VirtualTaskList';

// ===============================
// Optimized Task Statistics
// ===============================

interface TaskStatsProps {
  tasks: Task[];
  className?: string;
}

export const TaskStats = memo<TaskStatsProps>(({ tasks, className = '' }) => {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed'
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending,
      inProgress,
      overdue,
      completionRate
    };
  }, [tasks]);

  return (
    <div className={`task-stats ${className}`}>
      <div className="stat-item">
        <span className="stat-label">Total</span>
        <span className="stat-value">{stats.total}</span>
      </div>
      
      <div className="stat-item">
        <span className="stat-label">Completed</span>
        <span className="stat-value">{stats.completed}</span>
      </div>
      
      <div className="stat-item">
        <span className="stat-label">Pending</span>
        <span className="stat-value">{stats.pending}</span>
      </div>
      
      <div className="stat-item">
        <span className="stat-label">In Progress</span>
        <span className="stat-value">{stats.inProgress}</span>
      </div>
      
      {stats.overdue > 0 && (
        <div className="stat-item overdue">
          <span className="stat-label">Overdue</span>
          <span className="stat-value">{stats.overdue}</span>
        </div>
      )}
      
      <div className="stat-item completion-rate">
        <span className="stat-label">Completion</span>
        <span className="stat-value">{stats.completionRate}%</span>
      </div>
    </div>
  );
});

TaskStats.displayName = 'TaskStats';

// ===============================
// Debounced Search Input
// ===============================

interface DebouncedSearchProps {
  placeholder?: string;
  onSearch: (term: string) => void;
  debounceMs?: number;
  className?: string;
}

export const DebouncedSearch = memo<DebouncedSearchProps>(({
  placeholder = 'Search tasks...',
  onSearch,
  debounceMs = 300,
  className = ''
}) => {
  const [value, setValue] = React.useState('');
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onSearch(newValue);
    }, debounceMs);
  }, [onSearch, debounceMs]);

  // Clear search
  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [onSearch]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`debounced-search ${className}`}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-input"
      />
      {value && (
        <button 
          onClick={handleClear}
          className="clear-button"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
});

DebouncedSearch.displayName = 'DebouncedSearch';

// ===============================
// Performance Monitoring Hook
// ===============================

export function usePerformanceMonitoring(componentName: string) {
  const renderCountRef = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());

  React.useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${componentName}] Render #${renderCountRef.current}, Time since last: ${timeSinceLastRender}ms`);
    }
  });

  return {
    renderCount: renderCountRef.current,
    logRender: (message?: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${componentName}] ${message || 'Manual log'} - Render #${renderCountRef.current}`);
      }
    }
  };
}
