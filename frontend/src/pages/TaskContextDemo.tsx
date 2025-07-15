import { useEffect, useState } from 'react'
import { useTask } from '../contexts/TaskContext'
import { TaskStatus, TaskPriority, CreateTaskRequest } from '../types'

export default function TaskContextDemo() {
  const {
    tasks,
    loading,
    creating,
    error,
    filters,
    sort,
    searchQuery,
    pagination,
    createTask,
    deleteTask,
    completeTask,
    archiveTask,
    setFilters,
    setSort,
    setSearchQuery,
    getFilteredTasks,
    getTaskStats,
    fetchTasks,
    refreshTasks,
    clearError,
  } = useTask()

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])

  const filteredTasks = getFilteredTasks()
  const stats = getTaskStats()

  // Demo: Create a sample task
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return

    const taskData: CreateTaskRequest = {
      title: newTaskTitle,
      description: 'Demo task created from TaskContext demo',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      tags: ['demo', 'context'],
    }

    try {
      await createTask(taskData)
      setNewTaskTitle('')
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  // Demo: Filter tasks by status
  const handleStatusFilter = (status: TaskStatus) => {
    setFilters({
      ...filters,
      status: filters.status?.includes(status) 
        ? filters.status.filter(s => s !== status)
        : [...(filters.status || []), status]
    })
  }

  // Demo: Sort tasks
  const handleSort = (field: 'title' | 'created_at' | 'priority') => {
    setSort({
      field,
      order: sort.field === field && sort.order === 'asc' ? 'desc' : 'asc'
    })
  }

  useEffect(() => {
    // Fetch tasks on mount
    fetchTasks({ reset: true })
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">TaskContext Demo</h1>
        <p className="text-gray-600">
          Demonstrating advanced task management with CRUD operations, filtering, sorting, and optimistic updates.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Task Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-blue-700">Total Tasks</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-yellow-700">Pending</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.inProgress}</div>
          <div className="text-sm text-purple-700">In Progress</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-red-700">Overdue</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Task Management Controls</h2>
        
        {/* Create Task */}
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">Create New Task</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Enter task title..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateTask()}
            />
            <button
              onClick={handleCreateTask}
              disabled={creating || !newTaskTitle.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">Search Tasks</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">Filter by Status</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.values(TaskStatus).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  filters.status?.includes(status)
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting */}
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2">Sort Tasks</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleSort('title')}
              className={`px-3 py-1 rounded border text-sm ${
                sort.field === 'title'
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Title {sort.field === 'title' && (sort.order === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('created_at')}
              className={`px-3 py-1 rounded border text-sm ${
                sort.field === 'created_at'
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Date {sort.field === 'created_at' && (sort.order === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('priority')}
              className={`px-3 py-1 rounded border text-sm ${
                sort.field === 'priority'
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Priority {sort.field === 'priority' && (sort.order === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => refreshTasks()}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Tasks'}
          </button>
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Tasks ({filteredTasks.length} of {tasks.length})
          </h2>
          {pagination && (
            <p className="text-sm text-gray-600 mt-1">
              Page {pagination.current_page} of {pagination.total_pages} 
              ({pagination.total} total tasks)
            </p>
          )}
        </div>

        {loading && (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading tasks...</p>
          </div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {tasks.length === 0 ? 'No tasks found. Create your first task above!' : 'No tasks match current filters.'}
          </div>
        )}

        {!loading && filteredTasks.length > 0 && (
          <div className="divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTasks([...selectedTasks, task.id])
                          } else {
                            setSelectedTasks(selectedTasks.filter(id => id !== task.id))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <h3 className={`font-medium ${task.status === TaskStatus.COMPLETED ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full ${
                            task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                            task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                            task.status === TaskStatus.ARCHIVED ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full ${
                            task.priority === TaskPriority.HIGH ? 'bg-red-100 text-red-700' :
                            task.priority === TaskPriority.MEDIUM ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {task.priority}
                          </span>
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {task.status !== TaskStatus.COMPLETED && (
                      <button
                        onClick={() => completeTask(task.id)}
                        className="text-green-600 hover:text-green-700 text-sm"
                      >
                        Complete
                      </button>
                    )}
                    {task.status !== TaskStatus.ARCHIVED && (
                      <button
                        onClick={() => archiveTask(task.id)}
                        className="text-gray-600 hover:text-gray-700 text-sm"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Features Info */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">TaskContext Features Demonstrated</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h3 className="font-medium mb-2">✅ CRUD Operations</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• Create tasks with optimistic updates</li>
              <li>• Update task status and properties</li>
              <li>• Delete tasks with rollback on error</li>
              <li>• Fetch and refresh task lists</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">✅ Advanced Features</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• Real-time search and filtering</li>
              <li>• Multi-field sorting with direction</li>
              <li>• Bulk operations for multiple tasks</li>
              <li>• Pagination and stats calculation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">✅ State Management</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• Comprehensive loading states</li>
              <li>• Error handling with recovery</li>
              <li>• Cache management and auto-refresh</li>
              <li>• Optimistic updates with rollback</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">✅ Developer Experience</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• Type-safe operations and state</li>
              <li>• Comprehensive hook interface</li>
              <li>• Utility functions for common tasks</li>
              <li>• Easy integration with components</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
