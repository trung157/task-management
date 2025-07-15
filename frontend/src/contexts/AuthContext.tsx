import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react'
import { User, AuthState, LoginCredentials, RegisterData, AuthTokens } from '../types'
import { authService } from '../services/authService'

export interface AuthContextType {
  // Core state
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  
  // Token management
  tokens: AuthTokens | null
  tokenExpiresAt: Date | null
  isTokenExpired: boolean
  
  // Session management
  sessionId: string | null
  lastActivity: Date | null
  sessionTimeoutId: NodeJS.Timeout | null
  
  // Auth actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: (reason?: 'manual' | 'timeout' | 'error') => Promise<void>
  refreshToken: () => Promise<void>
  
  // User management
  updateUser: (updates: Partial<User>) => Promise<User>
  updateUserPreferences: (preferences: Record<string, any>) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  
  // Session management
  extendSession: () => void
  checkSession: () => boolean
  
  // Utility functions
  clearError: () => void
  clearAuthData: () => void
  getAuthHeaders: () => Record<string, string>
}

interface ExtendedAuthState extends AuthState {
  tokens: AuthTokens | null
  tokenExpiresAt: Date | null
  sessionId: string | null
  lastActivity: Date | null
  sessionTimeoutId: NodeJS.Timeout | null
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; tokens: AuthTokens; sessionId: string } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT'; payload?: { reason?: string } }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: AuthTokens }
  | { type: 'TOKEN_REFRESH_ERROR' }
  | { type: 'USER_UPDATE_SUCCESS'; payload: User }
  | { type: 'SESSION_EXTENDED'; payload: Date }
  | { type: 'SESSION_TIMEOUT_SET'; payload: NodeJS.Timeout }
  | { type: 'SESSION_TIMEOUT_CLEAR' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_AUTH_DATA' }

// Constants
const SESSION_TIMEOUT_DURATION = 30 * 60 * 1000 // 30 minutes
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000 // 5 minutes before expiry
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_EXPIRES_AT: 'auth_token_expires_at',
  SESSION_ID: 'auth_session_id',
  USER_DATA: 'auth_user_data',
  REMEMBER_ME: 'auth_remember_me',
  LAST_ACTIVITY: 'auth_last_activity'
} as const

const initialState: ExtendedAuthState = {
  user: null,
  loading: true,
  error: null,
  tokens: null,
  tokenExpiresAt: null,
  sessionId: null,
  lastActivity: null,
  sessionTimeoutId: null,
}

function authReducer(state: ExtendedAuthState, action: AuthAction): ExtendedAuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      }
    
    case 'AUTH_SUCCESS':
      const expiresAt = new Date(Date.now() + action.payload.tokens.expires_in * 1000)
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        tokenExpiresAt: expiresAt,
        sessionId: action.payload.sessionId,
        lastActivity: new Date(),
        loading: false,
        error: null,
      }
    
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        tokens: null,
        tokenExpiresAt: null,
        sessionId: null,
        lastActivity: null,
        loading: false,
        error: action.payload,
      }
    
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        tokenExpiresAt: null,
        sessionId: null,
        lastActivity: null,
        loading: false,
        error: action.payload?.reason === 'timeout' ? 'Session expired. Please log in again.' : null,
      }
    
    case 'TOKEN_REFRESH_SUCCESS':
      const newExpiresAt = new Date(Date.now() + action.payload.expires_in * 1000)
      return {
        ...state,
        tokens: action.payload,
        tokenExpiresAt: newExpiresAt,
        lastActivity: new Date(),
      }
    
    case 'TOKEN_REFRESH_ERROR':
      return {
        ...state,
        tokens: null,
        tokenExpiresAt: null,
        error: 'Session expired. Please log in again.',
      }
    
    case 'USER_UPDATE_SUCCESS':
      return {
        ...state,
        user: action.payload,
      }
    
    case 'SESSION_EXTENDED':
      return {
        ...state,
        lastActivity: action.payload,
      }
    
    case 'SESSION_TIMEOUT_SET':
      return {
        ...state,
        sessionTimeoutId: action.payload,
      }
    
    case 'SESSION_TIMEOUT_CLEAR':
      return {
        ...state,
        sessionTimeoutId: null,
      }
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    
    case 'CLEAR_AUTH_DATA':
      return {
        ...initialState,
        loading: false,
      }
    
    default:
      return state
  }
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Storage utilities
  const saveToStorage = (key: string, value: any, persistent = false) => {
    const storage = persistent ? localStorage : sessionStorage
    try {
      storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to save to storage:', error)
    }
  }

  const getFromStorage = (key: string, persistent = false) => {
    const storage = persistent ? localStorage : sessionStorage
    try {
      return storage.getItem(key)
    } catch (error) {
      console.warn('Failed to read from storage:', error)
      return null
    }
  }

  const removeFromStorage = (key: string, persistent = false) => {
    const storage = persistent ? localStorage : sessionStorage
    try {
      storage.removeItem(key)
    } catch (error) {
      console.warn('Failed to remove from storage:', error)
    }
  }

  // Clear all authentication data from storage
  const clearAuthData = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => {
      removeFromStorage(key, true)  // persistent storage
      removeFromStorage(key, false) // session storage
    })
    dispatch({ type: 'CLEAR_AUTH_DATA' })
  }, [])

  // Generate session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Set session timeout
  const setSessionTimeout = useCallback(() => {
    if (state.sessionTimeoutId) {
      clearTimeout(state.sessionTimeoutId)
    }

    const timeoutId = setTimeout(() => {
      logout('timeout')
    }, SESSION_TIMEOUT_DURATION)

    dispatch({ type: 'SESSION_TIMEOUT_SET', payload: timeoutId })
  }, [state.sessionTimeoutId])

  // Clear session timeout
  const clearSessionTimeout = useCallback(() => {
    if (state.sessionTimeoutId) {
      clearTimeout(state.sessionTimeoutId)
      dispatch({ type: 'SESSION_TIMEOUT_CLEAR' })
    }
  }, [state.sessionTimeoutId])

  // Extend session activity
  const extendSession = useCallback(() => {
    dispatch({ type: 'SESSION_EXTENDED', payload: new Date() })
    saveToStorage(STORAGE_KEYS.LAST_ACTIVITY, new Date().toISOString(), true)
    setSessionTimeout()
  }, [setSessionTimeout])

  // Check session validity
  const checkSession = useCallback(() => {
    if (!state.lastActivity) return false
    const timeSinceLastActivity = Date.now() - state.lastActivity.getTime()
    return timeSinceLastActivity < SESSION_TIMEOUT_DURATION
  }, [state.lastActivity])

  // Refresh access token
  const refreshToken = useCallback(async () => {
    try {
      if (!state.tokens?.refresh_token) {
        throw new Error('No refresh token available')
      }

      const tokens = await authService.refreshToken()
      
      dispatch({ type: 'TOKEN_REFRESH_SUCCESS', payload: tokens })
      
      // Save new tokens to storage
      const isRememberMe = getFromStorage(STORAGE_KEYS.REMEMBER_ME, true) === 'true'
      saveToStorage(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token, isRememberMe)
      saveToStorage(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token, isRememberMe)
      saveToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, 
        new Date(Date.now() + tokens.expires_in * 1000).toISOString(), isRememberMe)
      
      extendSession()
    } catch (error) {
      dispatch({ type: 'TOKEN_REFRESH_ERROR' })
      clearAuthData()
      throw error
    }
  }, [state.tokens, extendSession, clearAuthData])

  // Initialize authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing tokens in both storages
        let accessToken = getFromStorage(STORAGE_KEYS.ACCESS_TOKEN, true) || 
                         getFromStorage(STORAGE_KEYS.ACCESS_TOKEN, false)
        let refreshToken = getFromStorage(STORAGE_KEYS.REFRESH_TOKEN, true) || 
                          getFromStorage(STORAGE_KEYS.REFRESH_TOKEN, false)
        let expiresAtStr = getFromStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, true) || 
                          getFromStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, false)
        let sessionId = getFromStorage(STORAGE_KEYS.SESSION_ID, true) || 
                       getFromStorage(STORAGE_KEYS.SESSION_ID, false)
        let userDataStr = getFromStorage(STORAGE_KEYS.USER_DATA, true) || 
                         getFromStorage(STORAGE_KEYS.USER_DATA, false)
        let lastActivityStr = getFromStorage(STORAGE_KEYS.LAST_ACTIVITY, true) || 
                             getFromStorage(STORAGE_KEYS.LAST_ACTIVITY, false)

        if (accessToken && refreshToken && expiresAtStr && sessionId && userDataStr) {
          const expiresAt = new Date(expiresAtStr)
          const userData = JSON.parse(userDataStr)
          const lastActivity = lastActivityStr ? new Date(lastActivityStr) : new Date()

          // Check if session is still valid
          const sessionValid = Date.now() - lastActivity.getTime() < SESSION_TIMEOUT_DURATION

          if (!sessionValid) {
            clearAuthData()
            dispatch({ type: 'AUTH_LOGOUT', payload: { reason: 'Session expired' } })
            return
          }

          // Check if token needs refresh
          if (Date.now() >= expiresAt.getTime() - TOKEN_REFRESH_THRESHOLD) {
            try {
              dispatch({ type: 'AUTH_START' })
              const newTokens = await authService.refreshToken()
              
              dispatch({ 
                type: 'AUTH_SUCCESS', 
                payload: { 
                  user: userData, 
                  tokens: newTokens, 
                  sessionId 
                } 
              })
              
              // Update storage with new tokens
              const isRememberMe = getFromStorage(STORAGE_KEYS.REMEMBER_ME, true) === 'true'
              saveToStorage(STORAGE_KEYS.ACCESS_TOKEN, newTokens.access_token, isRememberMe)
              saveToStorage(STORAGE_KEYS.REFRESH_TOKEN, newTokens.refresh_token, isRememberMe)
              saveToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, 
                new Date(Date.now() + newTokens.expires_in * 1000).toISOString(), isRememberMe)
              
              setSessionTimeout()
            } catch (error) {
              clearAuthData()
              dispatch({ type: 'AUTH_ERROR', payload: 'Failed to refresh session' })
            }
          } else {
            // Token is still valid
            const tokens: AuthTokens = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
              token_type: 'Bearer'
            }
            
            dispatch({ 
              type: 'AUTH_SUCCESS', 
              payload: { user: userData, tokens, sessionId } 
            })
            setSessionTimeout()
          }
        } else {
          dispatch({ type: 'AUTH_LOGOUT' })
        }
      } catch (error) {
        dispatch({ type: 'AUTH_ERROR', payload: 'Failed to initialize authentication' })
        clearAuthData()
      }
    }

    initAuth()
  }, [clearAuthData, setSessionTimeout])

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!state.tokens || !state.tokenExpiresAt) return

    const timeUntilRefresh = state.tokenExpiresAt.getTime() - Date.now() - TOKEN_REFRESH_THRESHOLD
    
    if (timeUntilRefresh <= 0) {
      // Token needs immediate refresh
      refreshToken().catch(() => {
        logout('error')
      })
      return
    }

    const refreshTimeoutId = setTimeout(() => {
      refreshToken().catch(() => {
        logout('error')
      })
    }, timeUntilRefresh)

    return () => clearTimeout(refreshTimeoutId)
  }, [state.tokens, state.tokenExpiresAt, refreshToken])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      clearSessionTimeout()
    }
  }, [clearSessionTimeout])

  // Authentication functions
  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_START' })
      const response = await authService.login(credentials)
      const { user, access_token, refresh_token, expires_in } = response
      
      const tokens: AuthTokens = {
        access_token,
        refresh_token,
        expires_in,
        token_type: 'Bearer'
      }
      
      const sessionId = generateSessionId()
      
      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { user, tokens, sessionId } 
      })
      
      // Save to storage (persistent if remember_me is true)
      const isPersistent = credentials.remember_me === true
      saveToStorage(STORAGE_KEYS.ACCESS_TOKEN, access_token, isPersistent)
      saveToStorage(STORAGE_KEYS.REFRESH_TOKEN, refresh_token, isPersistent)
      saveToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, 
        new Date(Date.now() + expires_in * 1000).toISOString(), isPersistent)
      saveToStorage(STORAGE_KEYS.SESSION_ID, sessionId, isPersistent)
      saveToStorage(STORAGE_KEYS.USER_DATA, JSON.stringify(user), isPersistent)
      saveToStorage(STORAGE_KEYS.REMEMBER_ME, credentials.remember_me ? 'true' : 'false', true)
      
      extendSession()
      setSessionTimeout()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      dispatch({ type: 'AUTH_ERROR', payload: message })
      throw error
    }
  }

  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' })
      const response = await authService.register(data)
      const { user, access_token, refresh_token, expires_in } = response
      
      const tokens: AuthTokens = {
        access_token,
        refresh_token,
        expires_in,
        token_type: 'Bearer'
      }
      
      const sessionId = generateSessionId()
      
      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { user, tokens, sessionId } 
      })
      
      // Save to storage (default to session storage for registration)
      saveToStorage(STORAGE_KEYS.ACCESS_TOKEN, access_token, false)
      saveToStorage(STORAGE_KEYS.REFRESH_TOKEN, refresh_token, false)
      saveToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, 
        new Date(Date.now() + expires_in * 1000).toISOString(), false)
      saveToStorage(STORAGE_KEYS.SESSION_ID, sessionId, false)
      saveToStorage(STORAGE_KEYS.USER_DATA, JSON.stringify(user), false)
      
      extendSession()
      setSessionTimeout()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      dispatch({ type: 'AUTH_ERROR', payload: message })
      throw error
    }
  }

  const logout = async (reason: 'manual' | 'timeout' | 'error' = 'manual') => {
    try {
      clearSessionTimeout()
      
      // Attempt to invalidate session on server if possible
      if (state.tokens?.access_token && reason === 'manual') {
        try {
          await authService.logout()
        } catch (error) {
          // Ignore logout errors - we're logging out anyway
          console.warn('Failed to invalidate session on server:', error)
        }
      }
      
      clearAuthData()
      dispatch({ type: 'AUTH_LOGOUT', payload: { reason } })
    } catch (error) {
      // Even if logout fails, clear local data
      clearAuthData()
      dispatch({ type: 'AUTH_LOGOUT', payload: { reason: 'error' } })
    }
  }

  // User management functions
  const updateUser = async (updates: Partial<User>) => {
    try {
      if (!state.user) throw new Error('No user logged in')
      
      // For now, we'll simulate user update since authService doesn't have updateProfile
      // In a real app, you would call authService.updateProfile(updates)
      const updatedUser = { ...state.user, ...updates }
      
      dispatch({ type: 'USER_UPDATE_SUCCESS', payload: updatedUser })
      
      // Update stored user data
      const isRememberMe = getFromStorage(STORAGE_KEYS.REMEMBER_ME, true) === 'true'
      saveToStorage(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser), isRememberMe)
      
      extendSession()
      return updatedUser
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user'
      dispatch({ type: 'AUTH_ERROR', payload: message })
      throw error
    }
  }

  const updateUserPreferences = async (preferences: Record<string, any>) => {
    try {
      if (!state.user) throw new Error('No user logged in')
      
      const updatedUser = await updateUser({
        preferences: { ...state.user.preferences, ...preferences }
      })
      
      return updatedUser
    } catch (error) {
      throw error
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      if (!state.user) throw new Error('No user logged in')
      
      await authService.changePassword(currentPassword, newPassword)
      extendSession()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change password'
      dispatch({ type: 'AUTH_ERROR', payload: message })
      throw error
    }
  }

  // Utility functions
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!state.tokens?.access_token) return {}
    return {
      'Authorization': `Bearer ${state.tokens.access_token}`
    }
  }, [state.tokens])

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  // Computed values
  const isAuthenticated = !!state.user && !!state.tokens
  const isTokenExpiredComputed = state.tokenExpiresAt ? 
    Date.now() >= state.tokenExpiresAt.getTime() - TOKEN_REFRESH_THRESHOLD : true

  const value: AuthContextType = {
    // Core state
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated,
    
    // Token management
    tokens: state.tokens,
    tokenExpiresAt: state.tokenExpiresAt,
    isTokenExpired: isTokenExpiredComputed,
    
    // Session management
    sessionId: state.sessionId,
    lastActivity: state.lastActivity,
    sessionTimeoutId: state.sessionTimeoutId,
    
    // Auth actions
    login,
    register,
    logout,
    refreshToken,
    
    // User management
    updateUser,
    updateUserPreferences,
    changePassword,
    
    // Session management
    extendSession,
    checkSession,
    
    // Utility functions
    clearError,
    clearAuthData,
    getAuthHeaders,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
