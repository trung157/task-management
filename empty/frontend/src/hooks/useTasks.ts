import { useState, useEffect, useCallback } from 'react'
import { TaskApi, TaskListResponse, TaskStats } from '../api/taskApi'
import { Task, TaskFilters, CreateTaskRequest, UpdateTaskRequest } from '../types'
import { useApi, useAsyncOperation } from './useApi'
import { useNotification } from '../contexts/NotificationContext'

export function useTasks(initialFilters?: TaskFilters) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filters, setFilters] = useState<TaskFilters>(initialFilters || {})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const { addNotification } = useNotification()
  
  const {
    loading: fetchLoading,
    error: fetchError,
    execute: executeFetch
  } = useApi<TaskListResponse>({
    onError: (error) => addNotification({
      type: 'error',
      title: 'Failed to load tasks',
      message: error.message
    })
  })

  const { loading: actionLoading, execute: executeAction } = useAsyncOperation()

  const fetchTasks = useCallback(async (page = 1) => {
    const result = await executeFetch(() => TaskApi.getTasks(filters, page, pagination.limit))
    if (result) {
      setTasks(result.tasks)
      setPagination(prev => ({
        ...prev,
        page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }))
    }
  }, [filters, pagination.limit, executeFetch])

  const createTask = useCallback(async (taskData: CreateTaskRequest) => {
    const newTask = await executeAction(() => TaskApi.createTask(taskData))
    if (newTask) {
      setTasks(prev => [newTask, ...prev])
      addNotification({
        type: 'success',
        title: 'Task created',
        message: 'Task has been created successfully'
      })
    }
    return newTask
  }, [executeAction, addNotification])

  const updateTask = useCallback(async (id: string, taskData: UpdateTaskRequest) => {
    const updatedTask = await executeAction(() => TaskApi.updateTask(id, taskData))
    if (updatedTask) {
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task))
      addNotification({
        type: 'success',
        title: 'Task updated',
        message: 'Task has been updated successfully'
      })
    }
    return updatedTask
  }, [executeAction, addNotification])

  const deleteTask = useCallback(async (id: string) => {
    const success = await executeAction(() => TaskApi.deleteTask(id))
    if (success !== null) {
      setTasks(prev => prev.filter(task => task.id !== id))
      addNotification({
        type: 'success',
        title: 'Task deleted',
        message: 'Task has been deleted successfully'
      })
    }
  }, [executeAction, addNotification])

  const completeTask = useCallback(async (id: string) => {
    const completedTask = await executeAction(() => TaskApi.completeTask(id))
    if (completedTask) {
      setTasks(prev => prev.map(task => task.id === id ? completedTask : task))
      addNotification({
        type: 'success',
        title: 'Task completed',
        message: 'Great job! Task has been marked as completed'
      })
    }
    return completedTask
  }, [executeAction, addNotification])

  const archiveTask = useCallback(async (id: string) => {
    const archivedTask = await executeAction(() => TaskApi.archiveTask(id))
    if (archivedTask) {
      setTasks(prev => prev.filter(task => task.id !== id))
      addNotification({
        type: 'success',
        title: 'Task archived',
        message: 'Task has been archived successfully'
      })
    }
    return archivedTask
  }, [executeAction, addNotification])

  const duplicateTask = useCallback(async (id: string) => {
    const duplicatedTask = await executeAction(() => TaskApi.duplicateTask(id))
    if (duplicatedTask) {
      setTasks(prev => [duplicatedTask, ...prev])
      addNotification({
        type: 'success',
        title: 'Task duplicated',
        message: 'Task has been duplicated successfully'
      })
    }
    return duplicatedTask
  }, [executeAction, addNotification])

  const bulkDeleteTasks = useCallback(async (taskIds: string[]) => {
    const result = await executeAction(() => TaskApi.bulkDeleteTasks(taskIds))
    if (result) {
      setTasks(prev => prev.filter(task => !taskIds.includes(task.id)))
      addNotification({
        type: 'success',
        title: 'Tasks deleted',
        message: `${result.deleted} tasks deleted successfully`
      })
      if (result.failed.length > 0) {
        addNotification({
          type: 'warning',
          title: 'Some tasks failed to delete',
          message: `${result.failed.length} tasks could not be deleted`
        })
      }
    }
    return result
  }, [executeAction, addNotification])

  const bulkCompleteTasks = useCallback(async (taskIds: string[]) => {
    const result = await executeAction(() => TaskApi.bulkCompleteTasks(taskIds))
    if (result) {
      // Refresh tasks to get updated data
      await fetchTasks(pagination.page)
      addNotification({
        type: 'success',
        title: 'Tasks completed',
        message: `${result.completed} tasks completed successfully`
      })
    }
    return result
  }, [executeAction, addNotification, fetchTasks, pagination.page])

  // Initial load
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<TaskFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  return {
    tasks,
    pagination,
    filters,
    loading: fetchLoading || actionLoading,
    error: fetchError,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    archiveTask,
    duplicateTask,
    bulkDeleteTasks,
    bulkCompleteTasks,
    updateFilters,
    clearFilters,
    refetch: () => fetchTasks(pagination.page),
  }
}

// Hook for task statistics
export function useTaskStats() {
  const { addNotification } = useNotification()
  
  const {
    data: stats,
    loading,
    error,
    execute: fetchStats
  } = useApi<TaskStats>({
    onError: (error) => addNotification({
      type: 'error',
      title: 'Failed to load task statistics',
      message: error.message
    })
  })

  useEffect(() => {
    fetchStats(() => TaskApi.getTaskStats())
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    refetch: () => fetchStats(() => TaskApi.getTaskStats())
  }
}

// Hook for single task management
export function useTask(taskId: string) {
  const [task, setTask] = useState<Task | null>(null)
  const { addNotification } = useNotification()
  
  const {
    loading: fetchLoading,
    error: fetchError,
    execute: executeFetch
  } = useApi<Task>({
    onError: (error) => addNotification({
      type: 'error',
      title: 'Failed to load task',
      message: error.message
    })
  })

  const { loading: actionLoading, execute: executeAction } = useAsyncOperation()

  const fetchTask = useCallback(async () => {
    if (taskId) {
      const result = await executeFetch(() => TaskApi.getTask(taskId))
      if (result) {
        setTask(result)
      }
    }
  }, [taskId, executeFetch])

  const updateTask = useCallback(async (taskData: UpdateTaskRequest) => {
    if (!taskId) return null
    
    const updatedTask = await executeAction(() => TaskApi.updateTask(taskId, taskData))
    if (updatedTask) {
      setTask(updatedTask)
      addNotification({
        type: 'success',
        title: 'Task updated',
        message: 'Task has been updated successfully'
      })
    }
    return updatedTask
  }, [taskId, executeAction, addNotification])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  return {
    task,
    loading: fetchLoading || actionLoading,
    error: fetchError,
    updateTask,
    refetch: fetchTask
  }
}
