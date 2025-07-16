import React from 'react'
import { Task, TaskStatus, TaskPriority } from '../../types'

interface TaskCardProps {
  task: Task
  onClick?: (task: Task) => void
  onUpdate?: (task: Task) => void
  onStatusToggle?: (task: Task) => void
  onDelete?: (taskId: string) => void
  compact?: boolean
  showCategory?: boolean
  showDueDate?: boolean
  className?: string
}

export default function TaskCard({
  task,
  onClick,
  onUpdate,
  onStatusToggle,
  onDelete,
  compact = false,
  showCategory = true,
  showDueDate = true,
  className = ''
}: TaskCardProps) {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800 border-green-300'
      case TaskStatus.ARCHIVED:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'bg-red-500'
      case TaskPriority.MEDIUM:
        return 'bg-yellow-500'
      case TaskPriority.LOW:
        return 'bg-green-500'
      case TaskPriority.NONE:
        return 'bg-gray-300'
      default:
        return 'bg-gray-300'
    }
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== TaskStatus.COMPLETED

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onStatusToggle) {
      const newStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED
      onStatusToggle({ ...task, status: newStatus })
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete && window.confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id)
    }
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${compact ? 'p-3' : 'p-4'} ${className}`}
      onClick={() => onClick?.(task)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Checkbox */}
          <button
            onClick={handleStatusToggle}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 transition-colors ${
              task.status === TaskStatus.COMPLETED
                ? 'bg-green-500 border-green-500'
                : ''
            }`}
          >
            {task.status === TaskStatus.COMPLETED && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Title and description */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium text-gray-900 truncate ${
              task.status === TaskStatus.COMPLETED ? 'line-through text-gray-500' : ''
            }`}>
              {task.title}
            </h3>
            {task.description && !compact && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Priority indicator */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
      </div>

      {/* Status and Category */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(task.status)}`}>
          {task.status.replace('_', ' ')}
        </span>
        
        {showCategory && task.category && (
          <span 
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border"
            style={{ 
              backgroundColor: `${task.category.color}20`,
              borderColor: `${task.category.color}40`,
              color: task.category.color
            }}
          >
            {task.category.name}
          </span>
        )}
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, compact ? 2 : 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              #{tag}
            </span>
          ))}
          {task.tags.length > (compact ? 2 : 3) && (
            <span className="text-xs text-gray-500">
              +{task.tags.length - (compact ? 2 : 3)} more
            </span>
          )}
        </div>
      )}

      {/* Due date and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {showDueDate && task.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.due_date).toLocaleDateString()}
              {isOverdue && ' (Overdue)'}
            </span>
          )}
          
          {task.estimated_minutes && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Math.round(task.estimated_minutes / 60)}h
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onUpdate && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                // This would typically open an edit modal
                onUpdate(task)
              }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit task"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete task"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
