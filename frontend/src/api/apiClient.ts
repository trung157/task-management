import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// Extend axios config to include metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: Date
    }
  }
}

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Token management utilities
class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'access_token'
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token'

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY)
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY)
  }

  static setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken)
    }
  }

  static clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return Date.now() >= payload.exp * 1000
    } catch {
      return true
    }
  }
}

// Request queue for failed requests during token refresh
interface FailedRequest {
  resolve: (value?: any) => void
  reject: (error?: any) => void
}

// Main API Client Class
class ApiClient {
  private axiosInstance: AxiosInstance
  private isRefreshing = false
  private failedQueue: FailedRequest[] = []

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = TokenManager.getAccessToken()
        if (token && !TokenManager.isTokenExpired(token)) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        // Add request timestamp for debugging
        if (import.meta.env.DEV) {
          config.metadata = { startTime: new Date() }
        }
        
        return config
      },
      (error) => {
        return Promise.reject(this.handleError(error))
      }
    )

    // Response interceptor - Handle auth and errors
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response time in development
        if (import.meta.env.DEV && response.config.metadata) {
          const duration = new Date().getTime() - response.config.metadata.startTime.getTime()
          console.log(`API ${response.config.method?.toUpperCase()} ${response.config.url}: ${duration}ms`)
        }
        
        return response
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any

        // Handle 401 - Token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Queue the request while refresh is in progress
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            }).then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return this.axiosInstance(originalRequest)
            }).catch(err => {
              return Promise.reject(err)
            })
          }

          originalRequest._retry = true
          this.isRefreshing = true

          try {
            const refreshToken = TokenManager.getRefreshToken()
            if (!refreshToken) {
              throw new Error('No refresh token available')
            }

            const response = await this.refreshToken(refreshToken)
            const { token: accessToken, refreshToken: newRefreshToken } = response.data
            
            TokenManager.setTokens(accessToken, newRefreshToken)
            
            // Process failed queue
            this.processQueue(null, accessToken)
            
            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return this.axiosInstance(originalRequest)
            
          } catch (refreshError) {
            this.processQueue(refreshError, null)
            TokenManager.clearTokens()
            
            // Redirect to login
            window.location.href = '/login'
            return Promise.reject(refreshError)
          } finally {
            this.isRefreshing = false
          }
        }

        return Promise.reject(this.handleError(error))
      }
    )
  }

  private processQueue(error: any, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    
    this.failedQueue = []
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response
      const message = (data as any)?.message || error.message || 'An error occurred'
      const code = (data as any)?.code || 'UNKNOWN_ERROR'
      
      return new ApiError(message, status, code, data)
    } else if (error.request) {
      // Network error
      return new ApiError('Network error - please check your connection', 0, 'NETWORK_ERROR')
    } else {
      // Other error
      return new ApiError(error.message || 'An unexpected error occurred', 0, 'UNKNOWN_ERROR')
    }
  }

  private async refreshToken(refreshToken: string): Promise<AxiosResponse<any>> {
    return axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
  }

  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.get<ApiResponse<T>>(url, config)
    return response.data
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post<ApiResponse<T>>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put<ApiResponse<T>>(url, data, config)
    return response.data
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.patch<ApiResponse<T>>(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.delete<ApiResponse<T>>(url, config)
    return response.data
  }

  // File upload helper
  async uploadFile<T>(
    url: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    }

    return this.post<T>(url, formData, config)
  }

  // Download file helper
  async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.axiosInstance.get(url, {
      responseType: 'blob',
    })

    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }

  // Get the axios instance for advanced usage
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance
  }
}

// Create singleton instance
const apiClient = new ApiClient()
export default apiClient
export { TokenManager }
