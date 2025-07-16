import React, { useState } from 'react'
import { Task } from '../../types'
import { taskService } from '../../services/taskService'
import { X, Trash2, AlertTriangle } from 'lucide-react'

interface TaskDeleteModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onTaskDeleted: (taskId: string) => void
}

export const TaskDeleteModal: React.FC<TaskDeleteModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskDeleted
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await taskService.deleteTask(task.id)
      onTaskDeleted(task.id)
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Task</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          
          <div className="bg-gray-50 rounded-md p-3 mb-6">
            <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className={`px-2 py-1 rounded-full ${
                task.priority === 'high' ? 'bg-red-100 text-red-800' :
                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {task.priority} priority
              </span>
              <span className={`px-2 py-1 rounded-full ${
                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                task.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {task.status.replace('_', ' ')}
              </span>
              {task.category && (
                <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                  {task.category.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
