import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiError } from '../api/apiClient'

// ===============================
// Advanced API Hooks
// ===============================

export interface UseQueryOptions<T> {
  enabled?: boolean
  retry?: boolean | number
  retryDelay?: number
  staleTime?: number
  cacheTime?: number
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  refetchInterval?: number
  keepPreviousData?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: ApiError) => void
  select?: (data: any) => T
}

export interface UseQueryResult<T> {
  data: T | null
  isLoading: boolean
  isError: boolean
  error: ApiError | null
  isSuccess: boolean
  isFetching: boolean
  isStale: boolean
  refetch: () => Promise<void>
  invalidate: () => void
  keepPreviousData?: boolean
}

export function useQuery<T>(
  queryKey: string | string[],
  queryFn: () => Promise<T>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    enabled = true,
    retry = 3,
    retryDelay = 1000,
    staleTime = 5 * 60 * 1000, // 5 minutes
    refetchOnMount = true,
    refetchOnWindowFocus = false,
    refetchInterval,
    keepPreviousData = false,
    onSuccess,
    onError,
    select
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  const retryCountRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout>()
  const mounted = useRef(true)

  const keyString = Array.isArray(queryKey) ? queryKey.join('-') : queryKey
  const previousDataRef = useRef<T | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setIsFetching(true)
    setIsError(false)
    setError(null)

    if (data === null) {
      setIsLoading(true)
    }

    if (keepPreviousData && data) {
      previousDataRef.current = data
    }

    try {
      const result = await queryFn()
      const processedData = select ? select(result) : result

      if (mounted.current) {
        setData(processedData)
        setIsLoading(false)
        setIsError(false)
        setError(null)
        setLastFetchTime(Date.now())
        setIsStale(false)
        retryCountRef.current = 0

        if (onSuccess) {
          onSuccess(processedData)
        }
      }
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError('Unknown error', 0)

      if (mounted.current) {
        setIsError(true)
        setError(apiError)
        setIsLoading(false)

        if (onError) {
          onError(apiError)
        }

        // Retry logic
        const shouldRetry = typeof retry === 'number' ? retryCountRef.current < retry : retry
        if (shouldRetry) {
          retryCountRef.current += 1
          setTimeout(() => {
            if (mounted.current) {
              fetchData()
            }
          }, retryDelay * retryCountRef.current)
        }
      }
    } finally {
      if (mounted.current) {
        setIsFetching(false)
      }
    }
  }, [enabled, queryFn, select, onSuccess, onError, retry, retryDelay, data])

  const refetch = useCallback(async () => {
    retryCountRef.current = 0
    setIsStale(false)
    await fetchData()
  }, [fetchData])

  const invalidate = useCallback(() => {
    setIsStale(true)
  }, [])

  // Initial fetch
  useEffect(() => {
    if (enabled && refetchOnMount) {
      fetchData()
    }
  }, [enabled, refetchOnMount, keyString])

  // Stale time check
  useEffect(() => {
    if (lastFetchTime && staleTime > 0) {
      const timer = setTimeout(() => {
        if (mounted.current) {
          setIsStale(true)
        }
      }, staleTime)

      return () => clearTimeout(timer)
    }
  }, [lastFetchTime, staleTime])

  // Refetch interval
  useEffect(() => {
    if (enabled && refetchInterval) {
      intervalRef.current = setInterval(() => {
        if (mounted.current) {
          fetchData()
        }
      }, refetchInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [enabled, refetchInterval, fetchData])

  // Window focus refetch
  useEffect(() => {
    if (refetchOnWindowFocus) {
      const handleFocus = () => {
        if (mounted.current && isStale) {
          fetchData()
        }
      }

      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [refetchOnWindowFocus, isStale, fetchData])

  // Cleanup
  useEffect(() => {
    return () => {
      mounted.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    data: keepPreviousData && isFetching ? previousDataRef.current ?? data : data,
    isLoading,
    isError,
    error,
    isSuccess: !isLoading && !isError && data !== null,
    isFetching,
    isStale,
    refetch,
    invalidate
  }
}

// ===============================
// Mutation Hook
// ===============================

export interface UseMutationOptions<T, V> {
  onSuccess?: (data: T, variables: V) => void
  onError?: (error: ApiError, variables: V) => void
  onSettled?: (data: T | null, error: ApiError | null, variables: V) => void
}

export interface UseMutationResult<T, V> {
  mutate: (variables: V) => Promise<T>
  mutateAsync: (variables: V) => Promise<T>
  data: T | null
  isLoading: boolean
  isError: boolean
  error: ApiError | null
  isSuccess: boolean
  reset: () => void
}

export function useMutation<T, V = any>(
  mutationFn: (variables: V) => Promise<T>,
  options: UseMutationOptions<T, V> = {}
): UseMutationResult<T, V> {
  const { onSuccess, onError, onSettled } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const mutateAsync = useCallback(async (variables: V): Promise<T> => {
    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const result = await mutationFn(variables)
      setData(result)
      setIsLoading(false)

      if (onSuccess) {
        onSuccess(result, variables)
      }

      if (onSettled) {
        onSettled(result, null, variables)
      }

      return result
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError('Unknown error', 0)
      setIsError(true)
      setError(apiError)
      setIsLoading(false)

      if (onError) {
        onError(apiError, variables)
      }

      if (onSettled) {
        onSettled(null, apiError, variables)
      }

      throw apiError
    }
  }, [mutationFn, onSuccess, onError, onSettled])

  const mutate = useCallback((variables: V) => {
    return mutateAsync(variables).catch(() => {
      // Error is already handled in mutateAsync
    })
  }, [mutateAsync])

  const reset = useCallback(() => {
    setData(null)
    setIsLoading(false)
    setIsError(false)
    setError(null)
  }, [])

  return {
    mutate: mutate as any,
    mutateAsync,
    data,
    isLoading,
    isError,
    error,
    isSuccess: !isLoading && !isError && data !== null,
    reset
  }
}

// ===============================
// Infinite Query Hook
// ===============================

export interface UseInfiniteQueryOptions<T> {
  enabled?: boolean
  getNextPageParam?: (lastPage: T, allPages: T[]) => any
  getPreviousPageParam?: (firstPage: T, allPages: T[]) => any
  onSuccess?: (data: { pages: T[], pageParams: any[] }) => void
  onError?: (error: ApiError) => void
}

export interface UseInfiniteQueryResult<T> {
  data: { pages: T[], pageParams: any[] } | null
  isLoading: boolean
  isError: boolean
  error: ApiError | null
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  fetchNextPage: () => Promise<void>
  fetchPreviousPage: () => Promise<void>
  refetch: () => Promise<void>
}

export function useInfiniteQuery<T>(
  _queryKey: string | string[],
  queryFn: (pageParam?: any) => Promise<T>,
  options: UseInfiniteQueryOptions<T> = {}
): UseInfiniteQueryResult<T> {
  const {
    enabled = true,
    getNextPageParam,
    getPreviousPageParam,
    onSuccess,
    onError
  } = options

  const [data, setData] = useState<{ pages: T[], pageParams: any[] } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const [isFetchingPreviousPage, setIsFetchingPreviousPage] = useState(false)

  const fetchPage = useCallback(async (pageParam?: any, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!enabled) return

    if (direction === 'next') {
      setIsFetchingNextPage(true)
    } else if (direction === 'prev') {
      setIsFetchingPreviousPage(true)
    } else {
      setIsLoading(true)
    }

    try {
      const result = await queryFn(pageParam)

      setData(prevData => {
        if (direction === 'next') {
          return prevData ? {
            pages: [...prevData.pages, result],
            pageParams: [...prevData.pageParams, pageParam]
          } : { pages: [result], pageParams: [pageParam] }
        } else if (direction === 'prev') {
          return prevData ? {
            pages: [result, ...prevData.pages],
            pageParams: [pageParam, ...prevData.pageParams]
          } : { pages: [result], pageParams: [pageParam] }
        } else {
          return { pages: [result], pageParams: [pageParam] }
        }
      })

      setIsError(false)
      setError(null)

      if (onSuccess && direction === 'initial') {
        onSuccess({ pages: [result], pageParams: [pageParam] })
      }
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError('Unknown error', 0)
      setIsError(true)
      setError(apiError)

      if (onError) {
        onError(apiError)
      }
    } finally {
      setIsLoading(false)
      setIsFetchingNextPage(false)
      setIsFetchingPreviousPage(false)
    }
  }, [enabled, queryFn, onSuccess, onError])

  const fetchNextPage = useCallback(async () => {
    if (!data || !getNextPageParam) return

    const nextPageParam = getNextPageParam(data.pages[data.pages.length - 1], data.pages)
    if (nextPageParam !== undefined) {
      await fetchPage(nextPageParam, 'next')
    }
  }, [data, getNextPageParam, fetchPage])

  const fetchPreviousPage = useCallback(async () => {
    if (!data || !getPreviousPageParam) return

    const prevPageParam = getPreviousPageParam(data.pages[0], data.pages)
    if (prevPageParam !== undefined) {
      await fetchPage(prevPageParam, 'prev')
    }
  }, [data, getPreviousPageParam, fetchPage])

  const refetch = useCallback(async () => {
    setData(null)
    await fetchPage()
  }, [fetchPage])

  const hasNextPage = data && getNextPageParam 
    ? getNextPageParam(data.pages[data.pages.length - 1], data.pages) !== undefined
    : false

  const hasPreviousPage = data && getPreviousPageParam
    ? getPreviousPageParam(data.pages[0], data.pages) !== undefined
    : false

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchPage()
    }
  }, [enabled])

  return {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    refetch
  }
}

// ===============================
// Optimistic Updates Hook
// ===============================

export interface UseOptimisticOptions<T> {
  updateFn: (current: T, optimisticValue: Partial<T>) => T
  revertFn?: (original: T) => T
}

export function useOptimistic<T>(
  current: T,
  options: UseOptimisticOptions<T>
) {
  const { updateFn, revertFn } = options
  const [optimisticState, setOptimisticState] = useState<T>(current)
  const [isOptimistic, setIsOptimistic] = useState(false)
  const originalValueRef = useRef<T>(current)

  useEffect(() => {
    if (!isOptimistic) {
      setOptimisticState(current)
      originalValueRef.current = current
    }
  }, [current, isOptimistic])

  const updateOptimistic = useCallback((optimisticValue: Partial<T>) => {
    setIsOptimistic(true)
    setOptimisticState(prev => updateFn(prev, optimisticValue))
  }, [updateFn])

  const commitOptimistic = useCallback(() => {
    setIsOptimistic(false)
    originalValueRef.current = optimisticState
  }, [optimisticState])

  const revertOptimistic = useCallback(() => {
    if (revertFn) {
      setOptimisticState(revertFn(originalValueRef.current))
    } else {
      setOptimisticState(originalValueRef.current)
    }
    setIsOptimistic(false)
  }, [revertFn])

  return {
    state: optimisticState,
    isOptimistic,
    updateOptimistic,
    commitOptimistic,
    revertOptimistic
  }
}
