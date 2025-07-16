import { useState, useEffect, useCallback } from 'react'
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus, Category } from '../../types'

interface TaskFormProps {
  task?: Task
  categories: Category[]
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest) => Promise<void>
  onCancel?: () => void
  loading?: boolean
  error?: string | null
  className?: string
}

interface FormData {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  category_id: string
  due_date: string
  reminder_date: string
  start_date: string
  estimated_minutes: string
  tags: string[]
}

interface FormErrors {
  title?: string
  description?: string
  priority?: string
  status?: string
  category_id?: string
  due_date?: string
  reminder_date?: string
  start_date?: string
  estimated_minutes?: string
  tags?: string
  general?: string
}

const initialFormData: FormData = {
  title: '',
  description: '',
  priority: TaskPriority.MEDIUM,
  status: TaskStatus.PENDING,
  category_id: '',
  due_date: '',
  reminder_date: '',
  start_date: '',
  estimated_minutes: '',
  tags: []
}

export default function TaskForm({
  task,
  categories,
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  className = ''
}: TaskFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const isEditing = !!task

  // Initialize form data when task prop changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || TaskPriority.MEDIUM,
        status: task.status || TaskStatus.PENDING,
        category_id: task.category?.id || '',
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
        reminder_date: task.reminder_date ? new Date(task.reminder_date).toISOString().slice(0, 16) : '',
        start_date: task.start_date ? new Date(task.start_date).toISOString().slice(0, 16) : '',
        estimated_minutes: task.estimated_minutes ? task.estimated_minutes.toString() : '',
        tags: task.tags || []
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [task])

  // Validation function
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters long'
    } else if (formData.title.trim().length > 255) {
      newErrors.title = 'Title must be less than 255 characters'
    }

    // Description validation (optional)
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters'
    }

    // Date validations
    const now = new Date()
    const dueDate = formData.due_date ? new Date(formData.due_date) : null
    const reminderDate = formData.reminder_date ? new Date(formData.reminder_date) : null
    const startDate = formData.start_date ? new Date(formData.start_date) : null

    // Due date should be in the future (unless it's an existing completed task)
    if (dueDate && dueDate < now && (!isEditing || task?.status !== TaskStatus.COMPLETED)) {
      newErrors.due_date = 'Due date should be in the future'
    }

    // Reminder date should be before due date
    if (reminderDate && dueDate && reminderDate >= dueDate) {
      newErrors.reminder_date = 'Reminder date should be before due date'
    }

    // Start date should be before due date
    if (startDate && dueDate && startDate >= dueDate) {
      newErrors.start_date = 'Start date should be before due date'
    }

    // Estimated minutes validation
    if (formData.estimated_minutes) {
      const minutes = parseInt(formData.estimated_minutes, 10)
      if (isNaN(minutes) || minutes < 1) {
        newErrors.estimated_minutes = 'Estimated time must be a positive number'
      } else if (minutes > 9999) {
        newErrors.estimated_minutes = 'Estimated time must be less than 9999 minutes'
      }
    }

    // Tags validation
    if (formData.tags.length > 10) {
      newErrors.tags = 'Maximum 10 tags allowed'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, isEditing, task])

  // Handle form field changes
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Handle tag management
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
      setTagInput('')
      if (errors.tags) {
        setErrors(prev => ({ ...prev, tags: undefined }))
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    setErrors(prev => ({ ...prev, general: undefined }))

    try {
      const submitData: CreateTaskRequest | UpdateTaskRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        status: formData.status,
        category_id: formData.category_id || undefined,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        reminder_date: formData.reminder_date ? new Date(formData.reminder_date).toISOString() : undefined,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : undefined,
        estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes, 10) : undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined
      }

      await onSubmit(submitData)
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        general: err instanceof Error ? err.message : 'An error occurred while saving the task'
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form
  const handleReset = () => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || TaskPriority.MEDIUM,
        status: task.status || TaskStatus.PENDING,
        category_id: task.category?.id || '',
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
        reminder_date: task.reminder_date ? new Date(task.reminder_date).toISOString().slice(0, 16) : '',
        start_date: task.start_date ? new Date(task.start_date).toISOString().slice(0, 16) : '',
        estimated_minutes: task.estimated_minutes ? task.estimated_minutes.toString() : '',
        tags: task.tags || []
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
    setTagInput('')
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'text-red-600'
      case TaskPriority.MEDIUM:
        return 'text-yellow-600'
      case TaskPriority.LOW:
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit Task' : 'Create New Task'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* General Error */}
        {(error || errors.general) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error || errors.general}</p>
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
              errors.title
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder="Enter task title..."
            maxLength={255}
            required
            disabled={loading || isSubmitting}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.title.length}/255 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 resize-vertical ${
              errors.description
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder="Enter task description..."
            maxLength={1000}
            disabled={loading || isSubmitting}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* Priority and Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                errors.priority
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={loading || isSubmitting}
            >
              {Object.values(TaskPriority).map((priority) => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
            <div className="mt-1 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                formData.priority === TaskPriority.HIGH ? 'bg-red-500' :
                formData.priority === TaskPriority.MEDIUM ? 'bg-yellow-500' :
                formData.priority === TaskPriority.LOW ? 'bg-green-500' :
                'bg-gray-300'
              }`} />
              <span className={`text-xs ${getPriorityColor(formData.priority)}`}>
                {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)} Priority
              </span>
            </div>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600">{errors.priority}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                errors.status
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={loading || isSubmitting}
            >
              {Object.values(TaskStatus).map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status}</p>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={formData.category_id}
            onChange={(e) => handleInputChange('category_id', e.target.value)}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
              errors.category_id
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            disabled={loading || isSubmitting}
          >
            <option value="">Select a category (optional)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {formData.category_id && (
            <div className="mt-1 flex items-center gap-2">
              {(() => {
                const selectedCategory = categories.find(c => c.id === formData.category_id)
                return selectedCategory ? (
                  <>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                    <span className="text-xs text-gray-600">{selectedCategory.name}</span>
                  </>
                ) : null
              })()}
            </div>
          )}
          {errors.category_id && (
            <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
          )}
        </div>

        {/* Date Fields Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Start Date */}
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="datetime-local"
              id="start_date"
              value={formData.start_date}
              onChange={(e) => handleInputChange('start_date', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                errors.start_date
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={loading || isSubmitting}
            />
            {errors.start_date && (
              <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="datetime-local"
              id="due_date"
              value={formData.due_date}
              onChange={(e) => handleInputChange('due_date', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                errors.due_date
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={loading || isSubmitting}
            />
            {errors.due_date && (
              <p className="mt-1 text-sm text-red-600">{errors.due_date}</p>
            )}
          </div>

          {/* Reminder Date */}
          <div>
            <label htmlFor="reminder_date" className="block text-sm font-medium text-gray-700 mb-1">
              Reminder Date
            </label>
            <input
              type="datetime-local"
              id="reminder_date"
              value={formData.reminder_date}
              onChange={(e) => handleInputChange('reminder_date', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                errors.reminder_date
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              disabled={loading || isSubmitting}
            />
            {errors.reminder_date && (
              <p className="mt-1 text-sm text-red-600">{errors.reminder_date}</p>
            )}
          </div>
        </div>

        {/* Estimated Time */}
        <div>
          <label htmlFor="estimated_minutes" className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Time (minutes)
          </label>
          <input
            type="number"
            id="estimated_minutes"
            value={formData.estimated_minutes}
            onChange={(e) => handleInputChange('estimated_minutes', e.target.value)}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
              errors.estimated_minutes
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder="e.g., 60 for 1 hour"
            min="1"
            max="9999"
            disabled={loading || isSubmitting}
          />
          {formData.estimated_minutes && !isNaN(parseInt(formData.estimated_minutes)) && (
            <p className="mt-1 text-xs text-gray-500">
              Approximately {Math.round(parseInt(formData.estimated_minutes) / 60 * 10) / 10} hours
            </p>
          )}
          {errors.estimated_minutes && (
            <p className="mt-1 text-sm text-red-600">{errors.estimated_minutes}</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <div className="space-y-2">
            {/* Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 ${
                  errors.tags
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Enter a tag and press Enter"
                maxLength={50}
                disabled={loading || isSubmitting || formData.tags.length >= 10}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || formData.tags.includes(tagInput.trim().toLowerCase()) || formData.tags.length >= 10}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            {/* Tag Display */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                      disabled={loading || isSubmitting}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">
              {formData.tags.length}/10 tags {formData.tags.length >= 10 && '(maximum reached)'}
            </p>
            {errors.tags && (
              <p className="text-sm text-red-600">{errors.tags}</p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={loading || isSubmitting}
          >
            Reset
          </button>

          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={loading || isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </div>
              ) : (
                `${isEditing ? 'Update' : 'Create'} Task`
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
