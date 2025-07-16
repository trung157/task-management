import { ApiResponse, Category } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export interface CreateCategoryRequest {
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
  color?: string
  icon?: string
}

class CategoryService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    // Try to get token from both possible storage keys and locations
    const token = localStorage.getItem('auth_access_token') || 
                 sessionStorage.getItem('auth_access_token') ||
                 localStorage.getItem('auth_token')
    
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

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories')
  }

  async getCategory(id: string): Promise<Category> {
    return this.request<Category>(`/categories/${id}`)
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    })
  }
}

export const categoryService = new CategoryService()
