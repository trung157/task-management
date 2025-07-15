import { useState, useCallback } from 'react';
import { useQuery, useMutation } from './useAdvancedApi';
import { useNotification } from './useNotification';
import { TaskApi } from '../api/taskApi';
import { Task, TaskStatus, TaskPriority, TaskFilters, CreateTaskRequest, UpdateTaskRequest } from '../types';
import { ApiError } from '../api/apiClient';
import { BulkTaskOperation } from '../api/taskApi';

// ===============================
// Task Management Hooks
// ===============================

export interface UseTasksOptions {
  enabled?: boolean;
  filters?: TaskFilters;
  pagination?: {
    page: number;
    limit: number;
  };
  refetchInterval?: number;
  keepPreviousData?: boolean;
}

export interface UseTasksResult {
  tasks: Task[];
  totalTasks: number;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
  invalidate: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  page: number;
}

export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const {
    enabled = true,
    filters = {},
    pagination = { page: 1, limit: 20 },
    refetchInterval,
    keepPreviousData = true,
  } = options;

  const [page, setPage] = useState(pagination.page);

  const queryKey = ['tasks', JSON.stringify({ ...filters, page, limit: pagination.limit })];

  const {
    data,
    error,
    isLoading: loading,
    isFetching,
    refetch,
    invalidate,
  } = useQuery(
    queryKey,
    () => TaskApi.getTasks(filters, page, pagination.limit),
    {
      enabled,
      refetchInterval,
      keepPreviousData,
    }
  );

  const tasks = data?.tasks ?? [];
  const totalTasks = data?.pagination.total ?? 0;
  const hasMore = tasks.length > 0 && totalTasks > page * pagination.limit;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage(p => p + 1);
    }
  }, [hasMore, isFetching]);

  return {
    tasks,
    totalTasks,
    loading: loading && !isFetching, // Initial load
    error,
    refetch,
    invalidate,
    hasMore,
    isFetchingMore: isFetching && page > 1,
    loadMore,
    page,
  };
}

// ===============================
// Task Operations Hook
// ===============================

export interface UseTaskOperationsResult {
  createTask: (data: CreateTaskRequest) => Promise<Task | null>
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<Task | null>
  deleteTask: (id: string) => Promise<void>
  toggleStatus: (id: string) => Promise<Task | null>
  setPriority: (id: string, priority: TaskPriority) => Promise<Task | null>
  bulkUpdate: (operation: BulkTaskOperation) => Promise<{ updated: number; failed: string[] }>
  bulkDelete: (ids: string[]) => Promise<{ deleted: number; failed: string[] }>
  duplicateTask: (id: string) => Promise<Task | null>
  loading: boolean
  error: ApiError | null
}

export function useTaskOperations(): UseTaskOperationsResult {
  const { addNotification } = useNotification()

  const createMutation = useMutation(TaskApi.createTask, {
    onSuccess: (task) => {
      addNotification({
        type: 'success',
        title: 'Task created successfully',
        message: `"${task.title}" has been created`
      })
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: 'Failed to create task',
        message: error.message
      })
    }
  })

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: UpdateTaskRequest }) => 
      TaskApi.updateTask(id, data),
    {
      onSuccess: (task) => {
        addNotification({
          type: 'success',
          title: 'Task updated successfully',
          message: `"${task.title}" has been updated`
        })
      },
      onError: (error) => {
        addNotification({
          type: 'error',
          title: 'Failed to update task',
          message: error.message
        })
      }
    }
  )

  const deleteMutation = useMutation(TaskApi.deleteTask, {
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Task deleted successfully'
      })
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: 'Failed to delete task',
        message: error.message
      })
    }
  })

  const bulkUpdateMutation = useMutation(
    (operation: BulkTaskOperation) =>
      TaskApi.bulkUpdateTasks(operation),
    {
      onSuccess: (result) => {
        addNotification({
          type: 'success',
          title: 'Tasks updated successfully',
          message: `${result.updated} tasks have been updated`
        })
      }
    }
  )

  const bulkDeleteMutation = useMutation(TaskApi.bulkDeleteTasks, {
    onSuccess: (result, ids) => {
      addNotification({
        type: 'success',
        title: 'Tasks deleted successfully',
        message: `${result.deleted} of ${ids.length} tasks have been deleted`
      })
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: 'Failed to delete tasks',
        message: error.message
      })
    }
  })

  const duplicateMutation = useMutation(TaskApi.duplicateTask, {
    onSuccess: (task) => {
      addNotification({
        type: 'success',
        title: 'Task duplicated',
        message: `Task "${task.title}" has been duplicated.`
      })
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: 'Failed to duplicate task',
        message: error.message
      })
    }
  })

  const createTask = useCallback(async (data: CreateTaskRequest) => {
    return createMutation.mutateAsync(data);
  }, [createMutation]);

  const updateTask = useCallback(async (id: string, data: UpdateTaskRequest) => {
    return updateMutation.mutateAsync({ id, data });
  }, [updateMutation]);

  const deleteTask = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const toggleStatus = useCallback(async (id: string) => {
    const originalTask = await TaskApi.getTask(id);
    if (!originalTask) throw new Error('Task not found');
    const newStatus =
      originalTask.status === TaskStatus.COMPLETED
        ? TaskStatus.PENDING
        : TaskStatus.COMPLETED;
    return updateTask(id, { status: newStatus });
  }, [updateTask]);

  const setPriority = useCallback(async (id: string, priority: TaskPriority) => {
    return updateTask(id, { priority });
  }, [updateTask]);

  const bulkUpdate = useCallback(async (operation: BulkTaskOperation) => {
    return bulkUpdateMutation.mutateAsync(operation);
  }, [bulkUpdateMutation]);

  const bulkDelete = useCallback(async (ids: string[]) => {
    return await bulkDeleteMutation.mutateAsync(ids);
  }, [bulkDeleteMutation]);

  const duplicateTask = useCallback(async (id: string) => {
    return duplicateMutation.mutateAsync(id);
  }, [duplicateMutation]);

  const loading =
    createMutation.isLoading ||
    updateMutation.isLoading ||
    deleteMutation.isLoading ||
    bulkUpdateMutation.isLoading ||
    bulkDeleteMutation.isLoading ||
    duplicateMutation.isLoading;

  const error =
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error ||
    bulkUpdateMutation.error ||
    bulkDeleteMutation.error ||
    duplicateMutation.error;

  return {
    createTask,
    updateTask,
    deleteTask,
    toggleStatus,
    setPriority,
    bulkUpdate,
    bulkDelete,
    duplicateTask,
    loading,
    error,
  };
}

// ===============================
// Task Filters Hook
// ===============================

export interface UseTaskFiltersResult {
  filters: TaskFilters
  setFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  clearFilter: (key: keyof TaskFilters) => void
  clearAllFilters: () => void
  activeFiltersCount: number
  hasActiveFilters: boolean
}

export function useTaskFilters(initialFilters: TaskFilters = {}): UseTaskFiltersResult {
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)

  const setFilter = useCallback(<K extends keyof TaskFilters>(
    key: K, 
    value: TaskFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilter = useCallback((key: keyof TaskFilters) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({})
  }, [])

  const activeFiltersCount = Object.keys(filters).filter(key => 
    filters[key as keyof TaskFilters] !== undefined &&
    filters[key as keyof TaskFilters] !== null &&
    filters[key as keyof TaskFilters] !== ''
  ).length

  const hasActiveFilters = activeFiltersCount > 0

  return {
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    activeFiltersCount,
    hasActiveFilters
  }
}

// ===============================
// Task Analytics Hook
// ===============================

export interface TaskAnalytics {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  inProgressTasks: number
  archivedTasks: number
  highPriorityTasks: number
  mediumPriorityTasks: number
  lowPriorityTasks: number
  overdueTasks: number
  completionRate: number
  averageCompletionTime: number
  tasksByCategory: Record<string, number>
  tasksByPriority: Record<TaskPriority, number>
  tasksByStatus: Record<TaskStatus, number>
}

export function useTaskAnalytics(tasks: Task[]): TaskAnalytics {
  const analytics = useState(() => {
    const now = new Date()
    
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length
    const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING).length
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
    const archivedTasks = tasks.filter(t => t.status === TaskStatus.ARCHIVED).length
    
    const highPriorityTasks = tasks.filter(t => t.priority === TaskPriority.HIGH).length
    const mediumPriorityTasks = tasks.filter(t => t.priority === TaskPriority.MEDIUM).length
    const lowPriorityTasks = tasks.filter(t => t.priority === TaskPriority.LOW).length
    
    const overdueTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < now && t.status !== TaskStatus.COMPLETED
    ).length
    
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    
    // Calculate average completion time
    const completedTasksWithDates = tasks.filter(t => 
      t.status === TaskStatus.COMPLETED && t.created_at && t.updated_at
    )
    const averageCompletionTime = completedTasksWithDates.length > 0
      ? completedTasksWithDates.reduce((sum, task) => {
          const created = new Date(task.created_at!).getTime()
          const completed = new Date(task.updated_at!).getTime()
          return sum + (completed - created)
        }, 0) / completedTasksWithDates.length
      : 0

    // Group by category
    const tasksByCategory = tasks.reduce((acc, task) => {
      if (task.category) {
        acc[task.category.name] = (acc[task.category.name] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    // Group by priority
    const tasksByPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<TaskPriority, number>)

    // Group by status
    const tasksByStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<TaskStatus, number>)

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      archivedTasks,
      highPriorityTasks,
      mediumPriorityTasks,
      lowPriorityTasks,
      overdueTasks,
      completionRate,
      averageCompletionTime,
      tasksByCategory,
      tasksByPriority,
      tasksByStatus
    }
  })[0]

  return analytics
}
