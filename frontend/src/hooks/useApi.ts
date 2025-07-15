import { useState, useCallback } from 'react'
import { ApiError } from '../api/apiClient'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
}

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: ApiError) => void
  immediate?: boolean
}

export function useApi<T = any>(options: UseApiOptions = {}) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (apiCall: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const data = await apiCall()
      setState({ data, loading: false, error: null })
      
      if (options.onSuccess) {
        options.onSuccess(data)
      }
      
      return data
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Unknown error', 0)
      setState(prev => ({ ...prev, loading: false, error: apiError }))
      
      if (options.onError) {
        options.onError(apiError)
      }
      
      throw apiError
    }
  }, [options])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    execute,
    reset,
    clearError,
  }
}

// Hook for handling async operations with loading states
export function useAsyncOperation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const execute = useCallback(async <T>(operation: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await operation()
      return result
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError('Unknown error', 0)
      setError(apiError)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    loading,
    error,
    execute,
    clearError,
  }
}
