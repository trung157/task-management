import { useState } from 'react'
import TaskList from '../components/tasks/TaskList'
import { Task, TaskStatus, TaskPriority, Category } from '../types'

// Mock data for demonstration
const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Work',
    description: 'Work-related tasks',
    color: '#3B82F6',
    icon: 'briefcase',
    is_default: false,
    sort_order: 1,
    task_count: 5,
    completed_task_count: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'Personal',
    description: 'Personal tasks',
    color: '#10B981',
    icon: 'user',
    is_default: false,
    sort_order: 2,
    task_count: 3,
    completed_task_count: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    name: 'Shopping',
    description: 'Shopping list',
    color: '#F59E0B',
    icon: 'shopping-cart',
    is_default: false,
    sort_order: 3,
    task_count: 2,
    completed_task_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project proposal',
    description: 'Write a comprehensive project proposal for the new client including timeline, budget, and deliverables.',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    due_date: '2024-02-15T23:59:59Z',
    reminder_date: '2024-02-14T09:00:00Z',
    start_date: '2024-02-01T09:00:00Z',
    estimated_minutes: 480,
    actual_minutes: 240,
    completed_at: undefined,
    tags: ['proposal', 'client', 'urgent'],
    category: mockCategories[0],
    metadata: {},
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-02-01T14:20:00Z'
  },
  {
    id: '2',
    title: 'Review code changes',
    description: 'Review the pull request for the authentication system updates.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    due_date: '2024-02-10T17:00:00Z',
    tags: ['code-review', 'auth', 'backend'],
    category: mockCategories[0],
    metadata: {},
    estimated_minutes: 120,
    created_at: '2024-02-08T09:00:00Z',
    updated_at: '2024-02-08T09:00:00Z'
  },
  {
    id: '3',
    title: 'Buy groceries',
    description: 'Weekly grocery shopping - milk, bread, eggs, vegetables.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    due_date: '2024-02-12T18:00:00Z',
    tags: ['shopping', 'groceries', 'weekly'],
    category: mockCategories[2],
    metadata: {},
    estimated_minutes: 60,
    created_at: '2024-02-10T08:00:00Z',
    updated_at: '2024-02-10T08:00:00Z'
  },
  {
    id: '4',
    title: 'Exercise routine',
    description: 'Complete daily exercise routine - 30 minutes cardio and strength training.',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.MEDIUM,
    due_date: '2024-02-09T07:00:00Z',
    completed_at: '2024-02-09T07:30:00Z',
    tags: ['health', 'fitness', 'daily'],
    category: mockCategories[1],
    metadata: {},
    estimated_minutes: 30,
    actual_minutes: 35,
    created_at: '2024-02-09T06:00:00Z',
    updated_at: '2024-02-09T07:30:00Z'
  },
  {
    id: '5',
    title: 'Plan weekend trip',
    description: 'Research and plan weekend getaway including accommodation, transportation, and activities.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    due_date: '2024-02-20T23:59:59Z',
    tags: ['travel', 'planning', 'weekend'],
    category: mockCategories[1],
    metadata: {},
    estimated_minutes: 180,
    created_at: '2024-02-05T19:00:00Z',
    updated_at: '2024-02-05T19:00:00Z'
  },
  {
    id: '6',
    title: 'Update resume',
    description: 'Update resume with recent projects and achievements.',
    status: TaskStatus.ARCHIVED,
    priority: TaskPriority.MEDIUM,
    tags: ['career', 'resume', 'job-search'],
    category: mockCategories[0],
    metadata: {},
    estimated_minutes: 120,
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-25T15:00:00Z'
  },
  {
    id: '7',
    title: 'Call dentist',
    description: 'Schedule annual dental checkup appointment.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    due_date: '2024-02-08T17:00:00Z', // Overdue
    tags: ['health', 'appointment', 'dental'],
    category: mockCategories[1],
    metadata: {},
    estimated_minutes: 15,
    created_at: '2024-01-30T14:00:00Z',
    updated_at: '2024-01-30T14:00:00Z'
  },
  {
    id: '8',
    title: 'Prepare presentation',
    description: 'Create slides for quarterly team meeting presentation covering project status and next steps.',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    due_date: '2024-02-16T09:00:00Z',
    start_date: '2024-02-12T09:00:00Z',
    tags: ['presentation', 'meeting', 'quarterly'],
    category: mockCategories[0],
    metadata: {},
    estimated_minutes: 240,
    actual_minutes: 120,
    created_at: '2024-02-10T11:00:00Z',
    updated_at: '2024-02-12T10:30:00Z'
  }
]

export default function TaskListDemo() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [loading] = useState(false)

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ))
    console.log('Task updated:', updatedTask)
  }

  const handleTaskDelete = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
    console.log('Task deleted:', taskId)
  }

  const handleTaskClick = (task: Task) => {
    console.log('Task clicked:', task)
    // In a real app, this might navigate to a task detail page
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Task List Component Demo</h1>
          <p className="mt-2 text-gray-600">
            A comprehensive task list with filtering, sorting, search, and responsive design.
          </p>
        </div>

        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Real-time search across title, description, and tags</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Filter by status, priority, category, and tags</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Sort by multiple fields and directions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Responsive design with mobile optimization</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Pagination with customizable page sizes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Visual indicators for priorities and status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Overdue task highlighting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Quick status toggle and actions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Empty state handling</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Full Feature Set</h2>
            <TaskList
              tasks={tasks}
              categories={mockCategories}
              loading={loading}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              enableFiltering={true}
              enableSorting={true}
              enableSearch={true}
              showPagination={true}
              itemsPerPage={5}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Compact Mode</h2>
            <TaskList
              tasks={tasks.slice(0, 3)}
              categories={mockCategories}
              loading={loading}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onTaskClick={handleTaskClick}
              enableFiltering={false}
              enableSorting={true}
              enableSearch={true}
              compact={true}
              showPagination={false}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Loading State</h2>
            <TaskList
              tasks={[]}
              categories={mockCategories}
              loading={true}
              enableFiltering={true}
              enableSorting={true}
              enableSearch={true}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Empty State</h2>
            <TaskList
              tasks={[]}
              categories={mockCategories}
              loading={false}
              enableFiltering={true}
              enableSorting={true}
              enableSearch={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
