import apiClient from './apiClient'
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskFilters, User } from '../types'

export interface TaskStats {
  total: number
  completed: number
  pending: number
  inProgress: number
  overdue: number
  dueToday: number
  dueThisWeek: number
}

export interface BulkTaskOperation {
  taskIds: string[]
  operation: 'complete' | 'archive' | 'delete' | 'update'
  data?: Partial<UpdateTaskRequest>
}

export interface TaskListResponse {
  tasks: Task[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface TaskAttachment {
  id: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  url: string
  uploadedAt: string
}

export class TaskApi {
  // CRUD operations
  static async getTasks(filters?: TaskFilters, page = 1, limit = 20): Promise<TaskListResponse> {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v.toString()))
          } else {
            params.append(key, value.toString())
          }
        }
      })
    }
    
    params.append('page', page.toString())
    params.append('limit', limit.toString())

    const response = await apiClient.get<TaskListResponse>(`/tasks?${params.toString()}`)
    return response.data
  }

  static async getTask(id: string): Promise<Task> {
    const response = await apiClient.get<Task>(`/tasks/${id}`)
    return response.data
  }

  static async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const response = await apiClient.post<Task>('/tasks', taskData)
    return response.data
  }

  static async updateTask(id: string, taskData: UpdateTaskRequest): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}`, taskData)
    return response.data
  }

  static async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${id}`)
  }

  // Task status management
  static async completeTask(id: string): Promise<Task> {
    const response = await apiClient.patch<Task>(`/tasks/${id}/complete`)
    return response.data
  }

  static async uncompleteTask(id: string): Promise<Task> {
    const response = await apiClient.patch<Task>(`/tasks/${id}/uncomplete`)
    return response.data
  }

  static async archiveTask(id: string): Promise<Task> {
    const response = await apiClient.patch<Task>(`/tasks/${id}/archive`)
    return response.data
  }

  static async unarchiveTask(id: string): Promise<Task> {
    const response = await apiClient.patch<Task>(`/tasks/${id}/unarchive`)
    return response.data
  }

  static async duplicateTask(id: string): Promise<Task> {
    const response = await apiClient.post<Task>(`/tasks/${id}/duplicate`)
    return response.data
  }

  // Bulk operations
  static async bulkUpdateTasks(operation: BulkTaskOperation): Promise<{ updated: number; failed: string[] }> {
    const response = await apiClient.patch<{ updated: number; failed: string[] }>('/tasks/bulk', operation)
    return response.data
  }

  static async bulkDeleteTasks(taskIds: string[]): Promise<{ deleted: number; failed: string[] }> {
    const response = await apiClient.delete<{ deleted: number; failed: string[] }>('/tasks/bulk', {
      data: { taskIds }
    })
    return response.data
  }

  static async bulkArchiveTasks(taskIds: string[]): Promise<{ archived: number; failed: string[] }> {
    const response = await apiClient.patch<{ archived: number; failed: string[] }>('/tasks/bulk/archive', {
      taskIds
    })
    return response.data
  }

  static async bulkCompleteTasks(taskIds: string[]): Promise<{ completed: number; failed: string[] }> {
    const response = await apiClient.patch<{ completed: number; failed: string[] }>('/tasks/bulk/complete', {
      taskIds
    })
    return response.data
  }

  // Search and filtering
  static async searchTasks(query: string, filters?: TaskFilters): Promise<Task[]> {
    const params = new URLSearchParams({ q: query })
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString())
        }
      })
    }

    const response = await apiClient.get<Task[]>(`/tasks/search?${params.toString()}`)
    return response.data
  }

  static async getTasksByTag(tag: string): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/tasks/tag/${tag}`)
    return response.data
  }

  static async getTasksByCategory(categoryId: string): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/tasks/category/${categoryId}`)
    return response.data
  }

  // Statistics and analytics
  static async getTaskStats(): Promise<TaskStats> {
    const response = await apiClient.get<TaskStats>('/tasks/stats')
    return response.data
  }

  static async getOverdueTasks(): Promise<Task[]> {
    const response = await apiClient.get<Task[]>('/tasks/overdue')
    return response.data
  }

  static async getUpcomingTasks(days = 7): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/tasks/upcoming?days=${days}`)
    return response.data
  }

  static async getCompletedTasksCount(startDate?: string, endDate?: string): Promise<{ count: number }> {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    
    const response = await apiClient.get<{ count: number }>(`/tasks/completed/count?${params.toString()}`)
    return response.data
  }

  // File attachments
  static async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    const response = await apiClient.get<TaskAttachment[]>(`/tasks/${taskId}/attachments`)
    return response.data
  }

  static async uploadTaskAttachment(
    taskId: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<TaskAttachment> {
    const response = await apiClient.uploadFile<TaskAttachment>(
      `/tasks/${taskId}/attachments`, 
      file, 
      onProgress
    )
    return response.data
  }

  static async deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
    await apiClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`)
  }

  static async downloadTaskAttachment(taskId: string, attachmentId: string, filename: string): Promise<void> {
    await apiClient.downloadFile(`/tasks/${taskId}/attachments/${attachmentId}/download`, filename)
  }

  // Comments and notes
  static async addTaskComment(taskId: string, comment: string): Promise<{ id: string; comment: string; createdAt: string }> {
    const response = await apiClient.post<{ id: string; comment: string; createdAt: string }>(
      `/tasks/${taskId}/comments`, 
      { comment }
    )
    return response.data
  }

  static async getTaskComments(taskId: string): Promise<Array<{ id: string; comment: string; createdAt: string; author: User }>> {
    const response = await apiClient.get<Array<{ id: string; comment: string; createdAt: string; author: User }>>(
      `/tasks/${taskId}/comments`
    )
    return response.data
  }

  static async deleteTaskComment(taskId: string, commentId: string): Promise<void> {
    await apiClient.delete(`/tasks/${taskId}/comments/${commentId}`)
  }

  // Export functionality
  static async exportTasks(
    filters?: TaskFilters, 
    format: 'json' | 'csv' | 'excel' = 'json'
  ): Promise<void> {
    const params = new URLSearchParams({ format })
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString())
        }
      })
    }

    await apiClient.downloadFile(`/tasks/export?${params.toString()}`, `tasks.${format}`)
  }

  // Time tracking
  static async startTaskTimer(taskId: string): Promise<{ timerId: string; startedAt: string }> {
    const response = await apiClient.post<{ timerId: string; startedAt: string }>(`/tasks/${taskId}/timer/start`)
    return response.data
  }

  static async stopTaskTimer(taskId: string, timerId: string): Promise<{ duration: number; endedAt: string }> {
    const response = await apiClient.post<{ duration: number; endedAt: string }>(`/tasks/${taskId}/timer/stop`, {
      timerId
    })
    return response.data
  }

  static async getTaskTimeEntries(taskId: string): Promise<Array<{ id: string; startedAt: string; endedAt: string; duration: number }>> {
    const response = await apiClient.get<Array<{ id: string; startedAt: string; endedAt: string; duration: number }>>(
      `/tasks/${taskId}/time-entries`
    )
    return response.data
  }
}
