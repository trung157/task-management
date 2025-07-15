import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react'
import { 
  Task, 
  TaskFilters, 
  SortOptions, 
  CreateTaskRequest, 
  UpdateTaskRequest,
  Pagination,
  TaskStatus,
  TaskPriority
} from '../types'
import { TaskApi, TaskListResponse } from '../api/taskApi'
import { useAuth } from './AuthContext'

// ===============================
// Context Types
// ===============================

interface TaskState {
  // Core data
  tasks: Task[]
  selectedTask: Task | null
  
  // Loading states
  loading: boolean
  creating: boolean
  updating: string[] // IDs of tasks being updated
  deleting: string[] // IDs of tasks being deleted
  
  // Error handling
  error: string | null
  
  // Filtering and sorting
  filters: TaskFilters
  sort: SortOptions
  searchQuery: string
  
  // Pagination
  pagination: Pagination | null
  
  // Cache management
  lastFetch: Date | null
  cacheExpiry: number // milliseconds
  
  // Optimistic updates tracking
  optimisticUpdates: Map<string, 'create' | 'update' | 'delete'>
}

interface TaskContextType {
  // State
  tasks: Task[]
  selectedTask: Task | null
  loading: boolean
  creating: boolean
  updating: string[]
  deleting: string[]
  error: string | null
  filters: TaskFilters
  sort: SortOptions
  searchQuery: string
  pagination: Pagination | null
  
  // CRUD Operations
  createTask: (taskData: CreateTaskRequest) => Promise<Task>
  updateTask: (id: string, taskData: UpdateTaskRequest) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  fetchTasks: (options?: { reset?: boolean; page?: number }) => Promise<void>
  refreshTasks: () => Promise<void>
  
  // Task status operations
  completeTask: (id: string) => Promise<Task>
  uncompleteTask: (id: string) => Promise<Task>
  archiveTask: (id: string) => Promise<Task>
  unarchiveTask: (id: string) => Promise<Task>
  duplicateTask: (id: string) => Promise<Task>
  
  // Bulk operations
  bulkDeleteTasks: (taskIds: string[]) => Promise<void>
  bulkCompleteTasks: (taskIds: string[]) => Promise<void>
  bulkArchiveTasks: (taskIds: string[]) => Promise<void>
  
  // Selection and UI
  selectTask: (task: Task | null) => void
  
  // Filtering and sorting
  setFilters: (filters: TaskFilters) => void
  updateFilters: (partialFilters: Partial<TaskFilters>) => void
  clearFilters: () => void
  setSort: (sort: SortOptions) => void
  setSearchQuery: (query: string) => void
  
  // Pagination
  goToPage: (page: number) => void
  
  // Utility functions
  clearError: () => void
  findTask: (id: string) => Task | undefined
  getFilteredTasks: () => Task[]
  getTaskStats: () => {
    total: number
    completed: number
    pending: number
    inProgress: number
    overdue: number
  }
}

type TaskAction =
  // Data actions
  | { type: 'SET_TASKS'; payload: { tasks: Task[]; pagination?: Pagination; reset?: boolean } }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { id: string; task: Partial<Task> } }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'SET_SELECTED_TASK'; payload: Task | null }
  
  // Loading actions
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CREATING'; payload: boolean }
  | { type: 'SET_UPDATING'; payload: { id: string; updating: boolean } }
  | { type: 'SET_DELETING'; payload: { id: string; deleting: boolean } }
  
  // Error actions
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  
  // Filter and sort actions
  | { type: 'SET_FILTERS'; payload: TaskFilters }
  | { type: 'UPDATE_FILTERS'; payload: Partial<TaskFilters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_SORT'; payload: SortOptions }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  
  // Pagination actions
  | { type: 'SET_PAGINATION'; payload: Pagination | null }
  
  // Cache actions
  | { type: 'SET_LAST_FETCH'; payload: Date }
  
  // Optimistic update actions
  | { type: 'ADD_OPTIMISTIC_UPDATE'; payload: { id: string; type: 'create' | 'update' | 'delete' } }
  | { type: 'REMOVE_OPTIMISTIC_UPDATE'; payload: string }
  | { type: 'CLEAR_OPTIMISTIC_UPDATES' }

// ===============================
// Constants
// ===============================

const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_PAGE_SIZE = 20

const initialFilters: TaskFilters = {}

const initialSort: SortOptions = {
  field: 'created_at',
  order: 'desc'
}

const initialState: TaskState = {
  tasks: [],
  selectedTask: null,
  loading: false,
  creating: false,
  updating: [],
  deleting: [],
  error: null,
  filters: initialFilters,
  sort: initialSort,
  searchQuery: '',
  pagination: null,
  lastFetch: null,
  cacheExpiry: CACHE_EXPIRY_MS,
  optimisticUpdates: new Map(),
}

// ===============================
// Reducer
// ===============================

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS':
      return {
        ...state,
        tasks: action.payload.reset ? action.payload.tasks : [...state.tasks, ...action.payload.tasks],
        pagination: action.payload.pagination || state.pagination,
        loading: false,
        error: null,
      }
    
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [action.payload, ...state.tasks],
        creating: false,
        error: null,
      }
    
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id ? { ...task, ...action.payload.task } : task
        ),
        selectedTask: state.selectedTask?.id === action.payload.id 
          ? { ...state.selectedTask, ...action.payload.task }
          : state.selectedTask,
        error: null,
      }
    
    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
        selectedTask: state.selectedTask?.id === action.payload ? null : state.selectedTask,
        error: null,
      }
    
    case 'SET_SELECTED_TASK':
      return {
        ...state,
        selectedTask: action.payload,
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error,
      }
    
    case 'SET_CREATING':
      return {
        ...state,
        creating: action.payload,
        error: action.payload ? null : state.error,
      }
    
    case 'SET_UPDATING':
      return {
        ...state,
        updating: action.payload.updating
          ? [...state.updating, action.payload.id]
          : state.updating.filter(id => id !== action.payload.id),
        error: action.payload.updating ? null : state.error,
      }
    
    case 'SET_DELETING':
      return {
        ...state,
        deleting: action.payload.deleting
          ? [...state.deleting, action.payload.id]
          : state.deleting.filter(id => id !== action.payload.id),
        error: action.payload.deleting ? null : state.error,
      }
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
        creating: false,
        updating: [],
        deleting: [],
      }
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    
    case 'SET_FILTERS':
      return {
        ...state,
        filters: action.payload,
      }
    
    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      }
    
    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: initialFilters,
      }
    
    case 'SET_SORT':
      return {
        ...state,
        sort: action.payload,
      }
    
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
      }
    
    case 'SET_PAGINATION':
      return {
        ...state,
        pagination: action.payload,
      }
    
    case 'SET_LAST_FETCH':
      return {
        ...state,
        lastFetch: action.payload,
      }
    
    case 'ADD_OPTIMISTIC_UPDATE':
      const newOptimisticUpdates = new Map(state.optimisticUpdates)
      newOptimisticUpdates.set(action.payload.id, action.payload.type)
      return {
        ...state,
        optimisticUpdates: newOptimisticUpdates,
      }
    
    case 'REMOVE_OPTIMISTIC_UPDATE':
      const updatedOptimisticUpdates = new Map(state.optimisticUpdates)
      updatedOptimisticUpdates.delete(action.payload)
      return {
        ...state,
        optimisticUpdates: updatedOptimisticUpdates,
      }
    
    case 'CLEAR_OPTIMISTIC_UPDATES':
      return {
        ...state,
        optimisticUpdates: new Map(),
      }
    
    default:
      return state
  }
}

// ===============================
// Context
// ===============================

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialState)
  const { isAuthenticated } = useAuth()

  // ===============================
  // Utility functions
  // ===============================

  const shouldRefresh = useCallback(() => {
    if (!state.lastFetch) return true
    return Date.now() - state.lastFetch.getTime() > state.cacheExpiry
  }, [state.lastFetch, state.cacheExpiry])

  const generateOptimisticId = () => `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // ===============================
  // CRUD Operations
  // ===============================

  const fetchTasks = useCallback(async (options: { reset?: boolean; page?: number } = {}) => {
    try {
      if (!isAuthenticated) return

      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })

      const page = options.page || 1
      const response: TaskListResponse = await TaskApi.getTasks(
        { ...state.filters, search: state.searchQuery },
        page,
        DEFAULT_PAGE_SIZE
      )

      dispatch({
        type: 'SET_TASKS',
        payload: {
          tasks: response.tasks,
          pagination: {
            current_page: response.pagination.page,
            per_page: response.pagination.limit,
            total: response.pagination.total,
            total_pages: response.pagination.totalPages,
            has_next: response.pagination.page < response.pagination.totalPages,
            has_prev: response.pagination.page > 1,
          },
          reset: options.reset !== false,
        },
      })

      dispatch({ type: 'SET_LAST_FETCH', payload: new Date() })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tasks'
      dispatch({ type: 'SET_ERROR', payload: message })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [isAuthenticated, state.filters, state.searchQuery])

  const createTask = useCallback(async (taskData: CreateTaskRequest): Promise<Task> => {
    try {
      dispatch({ type: 'SET_CREATING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })

      // Create optimistic task
      const optimisticId = generateOptimisticId()
      const optimisticTask: Task = {
        id: optimisticId,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status || TaskStatus.PENDING,
        priority: taskData.priority || TaskPriority.MEDIUM,
        due_date: taskData.due_date,
        reminder_date: taskData.reminder_date,
        start_date: taskData.start_date,
        estimated_minutes: taskData.estimated_minutes,
        actual_minutes: 0,
        tags: taskData.tags || [],
        metadata: taskData.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Add optimistic update
      dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id: optimisticId, type: 'create' } })
      dispatch({ type: 'ADD_TASK', payload: optimisticTask })

      // Make API call
      const createdTask = await TaskApi.createTask(taskData)

      // Replace optimistic task with real task
      dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: optimisticId })
      dispatch({ type: 'REMOVE_TASK', payload: optimisticId })
      dispatch({ type: 'ADD_TASK', payload: createdTask })

      return createdTask
    } catch (error) {
      // Remove optimistic update on error
      const optimisticId = Array.from(state.optimisticUpdates.keys()).find(id => 
        state.optimisticUpdates.get(id) === 'create'
      )
      if (optimisticId) {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: optimisticId })
        dispatch({ type: 'REMOVE_TASK', payload: optimisticId })
      }

      const message = error instanceof Error ? error.message : 'Failed to create task'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    } finally {
      dispatch({ type: 'SET_CREATING', payload: false })
    }
  }, [state.optimisticUpdates])

  const updateTask = useCallback(async (id: string, taskData: UpdateTaskRequest): Promise<Task> => {
    try {
      dispatch({ type: 'SET_UPDATING', payload: { id, updating: true } })
      dispatch({ type: 'CLEAR_ERROR' })

      // Store original task for rollback
      const originalTask = state.tasks.find(task => task.id === id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      // Apply optimistic update
      dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id, type: 'update' } })
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id,
          task: { ...taskData, updated_at: new Date().toISOString() },
        },
      })

      // Make API call
      const updatedTask = await TaskApi.updateTask(id, taskData)

      // Replace optimistic update with real data
      dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
      dispatch({ type: 'UPDATE_TASK', payload: { id, task: updatedTask } })

      return updatedTask
    } catch (error) {
      // Rollback optimistic update on error
      const originalTask = state.tasks.find(task => task.id === id)
      if (originalTask) {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
        dispatch({ type: 'UPDATE_TASK', payload: { id, task: originalTask } })
      }

      const message = error instanceof Error ? error.message : 'Failed to update task'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    } finally {
      dispatch({ type: 'SET_UPDATING', payload: { id, updating: false } })
    }
  }, [state.tasks])

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_DELETING', payload: { id, deleting: true } })
      dispatch({ type: 'CLEAR_ERROR' })

      // Store original task for rollback
      const originalTask = state.tasks.find(task => task.id === id)
      if (!originalTask) {
        throw new Error('Task not found')
      }

      // Apply optimistic delete
      dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id, type: 'delete' } })
      dispatch({ type: 'REMOVE_TASK', payload: id })

      // Make API call
      await TaskApi.deleteTask(id)

      // Confirm deletion
      dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
    } catch (error) {
      // Rollback optimistic delete on error
      const originalTask = state.tasks.find(task => task.id === id)
      if (originalTask) {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
        dispatch({ type: 'ADD_TASK', payload: originalTask })
      }

      const message = error instanceof Error ? error.message : 'Failed to delete task'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    } finally {
      dispatch({ type: 'SET_DELETING', payload: { id, deleting: false } })
    }
  }, [state.tasks])

  const refreshTasks = useCallback(async () => {
    await fetchTasks({ reset: true, page: 1 })
  }, [fetchTasks])

  // ===============================
  // Task Status Operations
  // ===============================

  const completeTask = useCallback(async (id: string): Promise<Task> => {
    return updateTask(id, { status: TaskStatus.COMPLETED })
  }, [updateTask])

  const uncompleteTask = useCallback(async (id: string): Promise<Task> => {
    return updateTask(id, { status: TaskStatus.PENDING })
  }, [updateTask])

  const archiveTask = useCallback(async (id: string): Promise<Task> => {
    return updateTask(id, { status: TaskStatus.ARCHIVED })
  }, [updateTask])

  const unarchiveTask = useCallback(async (id: string): Promise<Task> => {
    return updateTask(id, { status: TaskStatus.PENDING })
  }, [updateTask])

  const duplicateTask = useCallback(async (id: string): Promise<Task> => {
    try {
      const task = await TaskApi.duplicateTask(id)
      dispatch({ type: 'ADD_TASK', payload: task })
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate task'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  // ===============================
  // Bulk Operations
  // ===============================

  const bulkDeleteTasks = useCallback(async (taskIds: string[]): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      // Apply optimistic deletes
      taskIds.forEach(id => {
        dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id, type: 'delete' } })
        dispatch({ type: 'REMOVE_TASK', payload: id })
      })

      await TaskApi.bulkDeleteTasks(taskIds)

      // Confirm deletions
      taskIds.forEach(id => {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
      })
    } catch (error) {
      // Rollback on error - would need to restore tasks from backup
      const message = error instanceof Error ? error.message : 'Failed to delete tasks'
      dispatch({ type: 'SET_ERROR', payload: message })
      await refreshTasks() // Refresh to get accurate state
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [refreshTasks])

  const bulkCompleteTasks = useCallback(async (taskIds: string[]): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      // Apply optimistic updates
      taskIds.forEach(id => {
        dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id, type: 'update' } })
        dispatch({
          type: 'UPDATE_TASK',
          payload: {
            id,
            task: { status: TaskStatus.COMPLETED },
          },
        })
      })

      await TaskApi.bulkCompleteTasks(taskIds)

      // Confirm updates
      taskIds.forEach(id => {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete tasks'
      dispatch({ type: 'SET_ERROR', payload: message })
      await refreshTasks()
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [refreshTasks])

  const bulkArchiveTasks = useCallback(async (taskIds: string[]): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      // Apply optimistic updates
      taskIds.forEach(id => {
        dispatch({ type: 'ADD_OPTIMISTIC_UPDATE', payload: { id, type: 'update' } })
        dispatch({
          type: 'UPDATE_TASK',
          payload: { id, task: { status: TaskStatus.ARCHIVED } },
        })
      })

      await TaskApi.bulkArchiveTasks(taskIds)

      // Confirm updates
      taskIds.forEach(id => {
        dispatch({ type: 'REMOVE_OPTIMISTIC_UPDATE', payload: id })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to archive tasks'
      dispatch({ type: 'SET_ERROR', payload: message })
      await refreshTasks()
      throw error
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [refreshTasks])

  // ===============================
  // Selection and UI
  // ===============================

  const selectTask = useCallback((task: Task | null) => {
    dispatch({ type: 'SET_SELECTED_TASK', payload: task })
  }, [])

  // ===============================
  // Filtering and Sorting
  // ===============================

  const setFilters = useCallback((filters: TaskFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }, [])

  const updateFilters = useCallback((partialFilters: Partial<TaskFilters>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: partialFilters })
  }, [])

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' })
  }, [])

  const setSort = useCallback((sort: SortOptions) => {
    dispatch({ type: 'SET_SORT', payload: sort })
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query })
  }, [])

  // ===============================
  // Pagination
  // ===============================

  const goToPage = useCallback((page: number) => {
    fetchTasks({ reset: false, page })
  }, [fetchTasks])

  // ===============================
  // Utility Functions
  // ===============================

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const findTask = useCallback((id: string): Task | undefined => {
    return state.tasks.find(task => task.id === id)
  }, [state.tasks])

  const getFilteredTasks = useCallback((): Task[] => {
    let filtered = [...state.tasks]

    // Apply search
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        task.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply filters
    const filters = state.filters
    
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status!.includes(task.status))
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(task => filters.priority!.includes(task.priority))
    }

    if (filters.category_id && filters.category_id.length > 0) {
      filtered = filtered.filter(task => 
        task.category && filters.category_id!.includes(task.category.id)
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task =>
        filters.tags!.some(tag => task.tags.includes(tag))
      )
    }

    if (filters.due_date_from) {
      filtered = filtered.filter(task => 
        task.due_date && task.due_date >= filters.due_date_from!
      )
    }

    if (filters.due_date_to) {
      filtered = filtered.filter(task => 
        task.due_date && task.due_date <= filters.due_date_to!
      )
    }

    // Apply sorting
    const { field, order } = state.sort
    filtered.sort((a, b) => {
      let aValue: any = a[field]
      let bValue: any = b[field]

      if (field === 'priority') {
        const priorityOrder = { 
          [TaskPriority.NONE]: 0,
          [TaskPriority.LOW]: 1, 
          [TaskPriority.MEDIUM]: 2, 
          [TaskPriority.HIGH]: 3 
        }
        aValue = priorityOrder[a.priority] || 0
        bValue = priorityOrder[b.priority] || 0
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1
      if (aValue > bValue) return order === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [state.tasks, state.searchQuery, state.filters, state.sort])

  const getTaskStats = useCallback(() => {
    const tasks = state.tasks
    const now = new Date()
    
    return {
      total: tasks.length,
      completed: tasks.filter(task => task.status === TaskStatus.COMPLETED).length,
      pending: tasks.filter(task => task.status === TaskStatus.PENDING).length,
      inProgress: tasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
      overdue: tasks.filter(task => 
        task.due_date && new Date(task.due_date) < now && task.status !== TaskStatus.COMPLETED
      ).length,
    }
  }, [state.tasks])

  // ===============================
  // Effects
  // ===============================

  // Auto-fetch tasks when authenticated or filters change
  useEffect(() => {
    if (isAuthenticated && shouldRefresh()) {
      fetchTasks({ reset: true })
    }
  }, [isAuthenticated, fetchTasks, shouldRefresh])

  // Fetch tasks when filters or sort change
  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks({ reset: true })
    }
  }, [state.filters, state.sort, state.searchQuery, isAuthenticated])

  // ===============================
  // Context Value
  // ===============================

  const value: TaskContextType = {
    // State
    tasks: state.tasks,
    selectedTask: state.selectedTask,
    loading: state.loading,
    creating: state.creating,
    updating: state.updating,
    deleting: state.deleting,
    error: state.error,
    filters: state.filters,
    sort: state.sort,
    searchQuery: state.searchQuery,
    pagination: state.pagination,

    // CRUD Operations
    createTask,
    updateTask,
    deleteTask,
    fetchTasks,
    refreshTasks,

    // Task status operations
    completeTask,
    uncompleteTask,
    archiveTask,
    unarchiveTask,
    duplicateTask,

    // Bulk operations
    bulkDeleteTasks,
    bulkCompleteTasks,
    bulkArchiveTasks,

    // Selection and UI
    selectTask,

    // Filtering and sorting
    setFilters,
    updateFilters,
    clearFilters,
    setSort,
    setSearchQuery,

    // Pagination
    goToPage,

    // Utility functions
    clearError,
    findTask,
    getFilteredTasks,
    getTaskStats,
  }

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTask() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider')
  }
  return context
}
