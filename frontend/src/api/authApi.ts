import apiClient from './apiClient'
import { User, LoginCredentials, RegisterData, LoginResponse, RegisterResponse, RefreshTokenResponse } from '../types'

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

export interface ResetPasswordData {
  token: string
  password: string
}

export class AuthApi {
  // Authentication endpoints
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
  }

  static async register(userData: RegisterData): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/auth/register', userData)
    return response.data
  }

  static async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  }

  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', { refreshToken })
    return response.data
  }

  // Profile management
  static async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  }

  static async updateProfile(userData: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/auth/profile', userData)
    return response.data
  }

  static async changePassword(passwordData: ChangePasswordData): Promise<void> {
    await apiClient.post('/auth/change-password', passwordData)
  }

  // Password reset
  static async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email })
  }

  static async resetPassword(resetData: ResetPasswordData): Promise<void> {
    await apiClient.post('/auth/reset-password', resetData)
  }

  // Email verification
  static async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token })
  }

  static async resendVerificationEmail(): Promise<void> {
    await apiClient.post('/auth/resend-verification')
  }

  // Two-factor authentication
  static async enableTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    const response = await apiClient.post<{ qrCode: string; secret: string }>('/auth/2fa/enable')
    return response.data
  }

  static async verifyTwoFactor(token: string): Promise<{ backupCodes: string[] }> {
    const response = await apiClient.post<{ backupCodes: string[] }>('/auth/2fa/verify', { token })
    return response.data
  }

  static async disableTwoFactor(password: string): Promise<void> {
    await apiClient.post('/auth/2fa/disable', { password })
  }
}
