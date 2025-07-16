import { useState, useEffect } from 'react'
import { Task, Category } from '../../types'
import { taskService } from '../../services/taskService'
import { categoryService } from '../../services/categoryService'
import TaskList from '../../components/tasks/TaskList'
import TaskForm from '../../components/tasks/TaskForm'
import { TaskEditModal } from '../../components/tasks/TaskEditModal'
import { TaskDeleteModal } from '../../components/tasks/TaskDeleteModal'
import { Plus } from 'lucide-react'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [tasksResponse, categoriesResponse] = await Promise.all([
        taskService.getTasks(),
        categoryService.getCategories()
      ])
      
      // Handle different response structures
      let tasksData: Task[] = []
      let categoriesData: Category[] = []
      
      if (Array.isArray(tasksResponse)) {
        tasksData = tasksResponse
      } else if (tasksResponse && typeof tasksResponse === 'object') {
        if ('data' in tasksResponse && tasksResponse.data) {
          const data = tasksResponse.data as any
          tasksData = data.tasks || []
        } else {
          tasksData = (tasksResponse as any).tasks || []
        }
      }
      
      if (Array.isArray(categoriesResponse)) {
        categoriesData = categoriesResponse
      } else if (categoriesResponse && typeof categoriesResponse === 'object') {
        categoriesData = categoriesResponse as Category[]
      }
      
      setTasks(tasksData)
      setCategories(categoriesData)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async (data: any) => {
    try {
      setIsCreating(true)
      const newTask = await taskService.createTask(data)
      setTasks(prev => [newTask, ...prev])
      setShowCreateModal(false)
    } catch (err) {
      console.error('Failed to create task:', err)
      throw err
    } finally {
      setIsCreating(false)
    }
  }

  const handleTaskUpdated = async (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ))
    setEditingTask(null)
  }

  const handleStatusToggle = async (updatedTask: Task) => {
    try {
      // Call API to update task status
      await taskService.updateTask(updatedTask.id, { status: updatedTask.status })
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === updatedTask.id ? { ...task, status: updatedTask.status } : task
      ))
    } catch (err) {
      console.error('Failed to toggle task status:', err)
      // You could show a toast notification here
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
  }

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      setDeletingTask(task)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage and organize your tasks</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          New Task
        </button>
      </div>
      
      {/* Task List Component */}
      <TaskList
        tasks={tasks}
        categories={categories}
        loading={loading}
        error={error}
        onTaskUpdate={handleEditTask}
        onStatusToggle={handleStatusToggle}
        onTaskDelete={handleDeleteTask}
        onTaskClick={undefined}
        enableFiltering={true}
        enableSorting={true}
        enableSearch={true}
        showPagination={true}
        itemsPerPage={12}
      />

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Task</h2>
              <TaskForm
                categories={categories}
                onSubmit={handleCreateTask}
                onCancel={() => setShowCreateModal(false)}
                loading={isCreating}
                className="space-y-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Delete Task Modal */}
      {deletingTask && (
        <TaskDeleteModal
          task={deletingTask}
          isOpen={!!deletingTask}
          onClose={() => setDeletingTask(null)}
          onTaskDeleted={handleTaskDelete}
        />
      )}
    </div>
  )
}
