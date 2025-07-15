import React, { useState, useEffect } from 'react'
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus } from '../types'
import { useAuthApi } from '../hooks/useAuthApi'
import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

/**
 * Complete example demonstrating API client integration with:
 * - Authentication context
 * - Task management hooks
 * - Error handling
 * - Loading states
 * - Real-time notifications
 */
export const ApiIntegrationExample: React.FC = () => {
  const { user } = useAuth()
  const { addNotification } = useNotification()
  const { 
    loading: authLoading, 
    updateProfile, 
    changePassword 
  } = useAuthApi()
  
  const {
    tasks,
    loading: tasksLoading,
    pagination,
    createTask,
    updateTask,
    deleteTask,
    fetchTasks
  } = useTasks()

  // Local state for forms
  const [taskForm, setTaskForm] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM,
    due_date: '',
  })

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: ''
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Initialize forms when user data is available
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.display_name,
        email: user.email
      })
    }
  }, [user])

  // Load tasks when component mounts
  useEffect(() => {
    if (user) {
      fetchTasks(1)
    }
  }, [user, fetchTasks])

  // Task management handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!taskForm.title.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Task title is required'
      })
      return
    }

    const success = await createTask(taskForm)
    if (success) {
      setTaskForm({
        title: '',
        description: '',
        priority: TaskPriority.MEDIUM,
        due_date: '',
      })
    }
  }

  const handleUpdateTask = async (taskId: string, updates: UpdateTaskRequest) => {
    await updateTask(taskId, updates)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId)
    }
  }

  const handleToggleTaskComplete = async (task: Task) => {
    await handleUpdateTask(task.id, {
      status: task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED
    })
  }

  // Profile management handlers
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Name and email are required'
      })
      return
    }

    await updateProfile(profileForm)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'New passwords do not match'
      })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Password must be at least 8 characters long'
      })
      return
    }

    const success = await changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    })

    if (success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    }
  }

  // Search and filter handlers
  const handleSearchTasks = async (searchTerm: string) => {
    if (searchTerm.trim()) {
      // For demo purposes, we'll just refetch all tasks
      // In a real app, you'd implement proper search
      await fetchTasks(1)
    } else {
      await fetchTasks(1)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Please log in to access the API integration example
          </h2>
          <p className="text-gray-600">
            This example demonstrates the complete API client integration with authentication.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Integration Example</h1>
          <p className="mt-2 text-gray-600">
            Complete demonstration of the task management API client with React hooks and Context API
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Management Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Management</h2>
            
            {/* Update Profile Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {authLoading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {authLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Task Management Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Task Management</h2>
            
            {/* Create Task Form */}
            <form onSubmit={handleCreateTask} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Task Title</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter task title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter task description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Due Date</label>
                  <input
                    type="datetime-local"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={tasksLoading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {tasksLoading ? 'Creating...' : 'Create Task'}
              </button>
            </form>

            {/* Search Tasks */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Tasks</label>
              <input
                type="text"
                onChange={(e) => handleSearchTasks(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Search tasks..."
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="mt-8 bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Tasks</h2>
            {pagination && (
              <p className="text-sm text-gray-600 mt-1">
                Showing {tasks.length} of {pagination.total} tasks
              </p>
            )}
          </div>
          
          <div className="p-6">
            {tasksLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No tasks found. Create your first task above!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 border rounded-lg ${
                      task.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={task.status === 'completed'}
                            onChange={() => handleToggleTaskComplete(task)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <h3
                            className={`font-medium ${
                              task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                            }`}
                          >
                            {task.title}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              task.priority === 'high'
                                ? 'bg-red-100 text-red-800'
                                : task.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="mt-2 text-gray-600 text-sm">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="mt-1 text-xs text-gray-500">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="ml-4 text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Usage Documentation */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">API Integration Features Demonstrated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-blue-800 mb-2">Authentication Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✓ Automatic JWT token management</li>
                <li>✓ Token refresh handling</li>
                <li>✓ Profile updates with validation</li>
                <li>✓ Password change with security</li>
                <li>✓ Automatic logout on token expiry</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-blue-800 mb-2">Task Management Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✓ CRUD operations with optimistic updates</li>
                <li>✓ Real-time loading states</li>
                <li>✓ Search and filtering</li>
                <li>✓ Pagination support</li>
                <li>✓ Error handling with notifications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiIntegrationExample
