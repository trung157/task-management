import { ApiResponse, Task, CreateTaskRequest, UpdateTaskRequest, TaskFilters, TasksResponse } from '../types'

const API_BASE_URL = 'http://localhost:3001/api'

class TaskService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const token = localStorage.getItem('auth_token')
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const data: ApiResponse<T> = await response.json()
    
    if (!data.success) {
      throw new Error(data.message || 'Request failed')
    }

    return data.data as T
  }

  async getTasks(filters?: TaskFilters): Promise<TasksResponse> {
    const queryParams = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()))
          } else {
            queryParams.set(key, value.toString())
          }
        }
      })
    }
    
    const queryString = queryParams.toString()
    const endpoint = queryString ? `/tasks?${queryString}` : '/tasks'
    
    return this.request<TasksResponse>(endpoint)
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`)
  }

  async createTask(data: CreateTaskRequest): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTask(id: string): Promise<void> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleTaskStatus(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/toggle`, {
      method: 'PATCH',
    })
  }

  async bulkUpdateTasks(ids: string[], data: Partial<UpdateTaskRequest>): Promise<Task[]> {
    return this.request<Task[]>('/tasks/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, data }),
    })
  }

  async bulkDeleteTasks(ids: string[]): Promise<void> {
    return this.request('/tasks/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    })
  }
}

export const taskService = new TaskService()
