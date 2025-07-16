import { ApiResponse, User } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export interface UpdateProfileRequest {
  first_name?: string
  last_name?: string
  bio?: string
  timezone?: string
  language_code?: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

class UserService {
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

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/user/profile')
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return this.request<User>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.request('/user/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async uploadAvatar(file: File): Promise<User> {
    const formData = new FormData()
    formData.append('avatar', file)
    
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${API_BASE_URL}/user/avatar`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    const data: ApiResponse<User> = await response.json()
    
    if (!data.success) {
      throw new Error(data.message || 'Request failed')
    }

    return data.data as User
  }
}

export const userService = new UserService()
