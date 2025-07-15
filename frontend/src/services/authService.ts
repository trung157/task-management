import { ApiResponse, User, LoginCredentials, RegisterData, AuthTokens } from '../types'

const API_BASE_URL = 'http://localhost:3001/api'

class AuthService {
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

  async login(credentials: LoginCredentials): Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: 'Bearer'
    user: User
  }> {
    return this.request<{
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: 'Bearer'
      user: User
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async register(data: RegisterData): Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: 'Bearer'
    user: User
  }> {
    return this.request<{
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: 'Bearer'
      user: User
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      // Even if logout fails on server, clear local storage
      console.warn('Logout request failed:', error)
    } finally {
      localStorage.removeItem('auth_token')
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me')
  }

  async refreshToken(): Promise<AuthTokens> {
    const response = await this.request<{
      access_token: string
      refresh_token: string
      expires_in: number
      token_type: 'Bearer'
      user: User
    }>('/auth/refresh', {
      method: 'POST',
    })
    
    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      expires_in: response.expires_in,
      token_type: response.token_type
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async resetPassword(token: string, password: string): Promise<void> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  async verifyEmail(token: string): Promise<void> {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  async resendVerificationEmail(): Promise<void> {
    return this.request('/auth/resend-verification', {
      method: 'POST',
    })
  }
}

export const authService = new AuthService()
