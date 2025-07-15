import { useState, useEffect } from 'react'
import TaskForm from '../components/tasks/TaskForm'
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus, Category } from '../types'
import { useNotification } from '../contexts/NotificationContext'

// Mock categories for demo
const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Work',
    description: 'Work-related tasks',
    color: '#3B82F6',
    icon: '💼',
    is_default: false,
    sort_order: 1,
    task_count: 5,
    completed_task_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Personal',
    description: 'Personal tasks and goals',
    color: '#10B981',
    icon: '🏠',
    is_default: false,
    sort_order: 2,
    task_count: 3,
    completed_task_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Health',
    description: 'Health and fitness tasks',
    color: '#F59E0B',
    icon: '🏃',
    is_default: false,
    sort_order: 3,
    task_count: 2,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Learning',
    description: 'Educational and skill development',
    color: '#8B5CF6',
    icon: '📚',
    is_default: false,
    sort_order: 4,
    task_count: 4,
    completed_task_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// Mock task for editing demo
const mockTask: Task = {
  id: '1',
  title: 'Complete React TaskForm Component',
  description: 'Build a comprehensive task form with validation, date pickers, priority selection, and error handling.',
  priority: TaskPriority.HIGH,
  status: TaskStatus.IN_PROGRESS,
  category: mockCategories[3], // Learning
  due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
  reminder_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
  start_date: new Date().toISOString(),
  estimated_minutes: 240,
  tags: ['react', 'typescript', 'frontend'],
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

export default function TaskFormDemo() {
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [lastSubmittedData, setLastSubmittedData] = useState<any>(null)
  const { addNotification } = useNotification()

  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showSuccessMessage])

  const handleSubmit = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    setIsLoading(true)
    setError(null)
    setShowSuccessMessage(false)

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Simulate random success/error for demo purposes
      const shouldFail = Math.random() < 0.2 // 20% chance to fail
      
      if (shouldFail) {
        throw new Error('Simulated API error: Failed to save task')
      }

      setLastSubmittedData({
        mode,
        data,
        timestamp: new Date().toISOString()
      })
      setShowSuccessMessage(true)
      
      addNotification({
        type: 'success',
        title: mode === 'create' ? 'Task Created' : 'Task Updated',
        message: `Task "${data.title}" has been ${mode === 'create' ? 'created' : 'updated'} successfully.`,
        duration: 4000
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: errorMessage,
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    addNotification({
      type: 'info',
      title: 'Cancelled',
      message: 'Form submission was cancelled.',
      duration: 3000
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">TaskForm Component Demo</h1>
        <p className="text-lg text-gray-600 mb-6">
          A comprehensive form component for creating and editing tasks with validation, 
          date pickers, priority selection, and error handling.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Demo Mode</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Create Mode
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Edit Mode
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {mode === 'create' 
            ? 'Form will be empty for creating a new task'
            : 'Form will be pre-filled with example task data for editing'
          }
        </p>
      </div>

      {/* Success Message */}
      {showSuccessMessage && lastSubmittedData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-green-800">
              Task {lastSubmittedData.mode === 'create' ? 'Created' : 'Updated'} Successfully!
            </h3>
          </div>
          <div className="text-sm text-green-700">
            <p className="mb-2">
              <strong>Title:</strong> {lastSubmittedData.data.title}
            </p>
            {lastSubmittedData.data.description && (
              <p className="mb-2">
                <strong>Description:</strong> {lastSubmittedData.data.description}
              </p>
            )}
            <p className="mb-2">
              <strong>Priority:</strong> {lastSubmittedData.data.priority}
            </p>
            <p className="mb-2">
              <strong>Status:</strong> {lastSubmittedData.data.status}
            </p>
            {lastSubmittedData.data.tags && lastSubmittedData.data.tags.length > 0 && (
              <p className="mb-2">
                <strong>Tags:</strong> {lastSubmittedData.data.tags.join(', ')}
              </p>
            )}
            <p className="text-xs text-green-600 mt-3">
              Submitted at: {new Date(lastSubmittedData.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* TaskForm Component */}
      <TaskForm
        task={mode === 'edit' ? mockTask : undefined}
        categories={mockCategories}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={isLoading}
        error={error}
        className="max-w-none"
      />

      {/* Features Documentation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">TaskForm Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Form Fields</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Title (required, character limit)</li>
              <li>• Description (optional, character limit)</li>
              <li>• Priority selection with visual indicators</li>
              <li>• Status selection</li>
              <li>• Category selection with color indicators</li>
              <li>• Start, Due, and Reminder date pickers</li>
              <li>• Estimated time in minutes</li>
              <li>• Tag management system</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Validation & UX</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Real-time form validation</li>
              <li>• Error handling and display</li>
              <li>• Character counters</li>
              <li>• Date relationship validation</li>
              <li>• Loading states and disabled inputs</li>
              <li>• Reset and cancel functionality</li>
              <li>• Responsive design</li>
              <li>• Accessibility support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-2">Demo Notes</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• This demo simulates API calls with random success/failure (80% success rate)</li>
          <li>• Form validation is performed in real-time</li>
          <li>• Try entering invalid data to see error handling</li>
          <li>• Use the mode toggle to switch between create and edit modes</li>
          <li>• Check the notification system for feedback</li>
          <li>• All date fields support datetime-local input</li>
          <li>• Tags can be added by typing and pressing Enter or clicking Add</li>
        </ul>
      </div>
    </div>
  )
}
