import { useCallback } from 'react'
import { AuthApi, ChangePasswordData } from '../api/authApi'
import { User } from '../types'
import { useAsyncOperation } from './useApi'
import { useAuth as useAuthContext } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export function useAuthApi() {
  const { user } = useAuthContext()
  const { addNotification } = useNotification()

  const { loading: actionLoading, execute: executeAction } = useAsyncOperation()

  const updateProfile = useCallback(async (userData: Partial<User>) => {
    if (!user) return null
    
    const updatedUser = await executeAction(() => AuthApi.updateProfile(userData))
    if (updatedUser) {
      addNotification({
        type: 'success',
        title: 'Profile updated',
        message: 'Your profile has been updated successfully.'
      })
    }
    return updatedUser
  }, [user, executeAction, addNotification])

  const changePassword = useCallback(async (passwordData: ChangePasswordData) => {
    const success = await executeAction(() => AuthApi.changePassword(passwordData))
    if (success !== null) {
      addNotification({
        type: 'success',
        title: 'Password changed',
        message: 'Your password has been changed successfully.'
      })
    }
    return success !== null
  }, [executeAction, addNotification])

  const requestPasswordReset = useCallback(async (email: string) => {
    const success = await executeAction(() => AuthApi.requestPasswordReset(email))
    if (success !== null) {
      addNotification({
        type: 'success',
        title: 'Reset email sent',
        message: 'Please check your email for password reset instructions.'
      })
    }
    return success !== null
  }, [executeAction, addNotification])

  const verifyEmail = useCallback(async (token: string) => {
    const success = await executeAction(() => AuthApi.verifyEmail(token))
    if (success !== null) {
      addNotification({
        type: 'success',
        title: 'Email verified',
        message: 'Your email has been verified successfully.'
      })
    }
    return success !== null
  }, [executeAction, addNotification])

  const resendVerificationEmail = useCallback(async () => {
    const success = await executeAction(() => AuthApi.resendVerificationEmail())
    if (success !== null) {
      addNotification({
        type: 'success',
        title: 'Verification email sent',
        message: 'Please check your email for verification instructions.'
      })
    }
    return success !== null
  }, [executeAction, addNotification])

  const refreshUserProfile = useCallback(async () => {
    try {
      const updatedUser = await AuthApi.getProfile()
      return updatedUser
    } catch (error) {
      console.error('Failed to refresh user profile:', error)
      return null
    }
  }, [])

  return {
    user,
    loading: actionLoading,
    updateProfile,
    changePassword,
    requestPasswordReset,
    verifyEmail,
    resendVerificationEmail,
    refreshUserProfile,
  }
}

// Hook for managing two-factor authentication
export function useTwoFactorAuth() {
  const { addNotification } = useNotification()
  const { loading, execute } = useAsyncOperation()

  const enableTwoFactor = useCallback(async () => {
    const result = await execute(() => AuthApi.enableTwoFactor())
    if (result) {
      addNotification({
        type: 'success',
        title: '2FA Setup',
        message: 'Two-factor authentication setup initiated. Please scan the QR code.'
      })
    }
    return result
  }, [execute, addNotification])

  const verifyTwoFactor = useCallback(async (token: string) => {
    const result = await execute(() => AuthApi.verifyTwoFactor(token))
    if (result) {
      addNotification({
        type: 'success',
        title: '2FA Enabled',
        message: 'Two-factor authentication has been enabled successfully.'
      })
    }
    return result
  }, [execute, addNotification])

  const disableTwoFactor = useCallback(async (password: string) => {
    const success = await execute(() => AuthApi.disableTwoFactor(password))
    if (success !== null) {
      addNotification({
        type: 'success',
        title: '2FA Disabled',
        message: 'Two-factor authentication has been disabled.'
      })
    }
    return success !== null
  }, [execute, addNotification])

  return {
    loading,
    enableTwoFactor,
    verifyTwoFactor,
    disableTwoFactor,
  }
}
