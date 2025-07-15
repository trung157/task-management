import { useState, useEffect, useCallback, useRef } from 'react'
import { useNotification } from '../contexts/NotificationContext'

// ===============================
// Types
// ===============================

export interface UseLocalStorageOptions<T> {
  defaultValue: T
  serializer?: {
    read: (value: string) => T
    write: (value: T) => string
  }
}

export interface UseDebounceOptions {
  delay: number
  immediate?: boolean
}

export interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
  total?: number
}

export interface PaginationState {
  currentPage: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  startIndex: number
  endIndex: number
}

export interface PaginationActions {
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setPageSize: (size: number) => void
  setTotal: (total: number) => void
  reset: () => void
}

// ===============================
// Storage Hooks
// ===============================

export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const { defaultValue, serializer } = options
  
  const serialize = serializer?.write || JSON.stringify
  const deserialize = serializer?.read || JSON.parse

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? deserialize(item) : defaultValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return defaultValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      localStorage.setItem(key, serialize(valueToStore))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, serialize, storedValue])

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setStoredValue(defaultValue)
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, defaultValue])

  return [storedValue, setValue, removeValue]
}

export function useSessionStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const { defaultValue, serializer } = options
  
  const serialize = serializer?.write || JSON.stringify
  const deserialize = serializer?.read || JSON.parse

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key)
      return item ? deserialize(item) : defaultValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return defaultValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      sessionStorage.setItem(key, serialize(valueToStore))
    } catch (error) {
      console.warn(`Error setting sessionStorage key "${key}":`, error)
    }
  }, [key, serialize, storedValue])

  const removeValue = useCallback(() => {
    try {
      sessionStorage.removeItem(key)
      setStoredValue(defaultValue)
    } catch (error) {
      console.warn(`Error removing sessionStorage key "${key}":`, error)
    }
  }, [key, defaultValue])

  return [storedValue, setValue, removeValue]
}

// ===============================
// Utility Hooks
// ===============================

export function useDebounce<T>(value: T, options: UseDebounceOptions): T {
  const { delay, immediate = false } = options
  const [debouncedValue, setDebouncedValue] = useState<T>(immediate ? value : value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, delay - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return throttledValue
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

export function useToggle(initialValue = false): [boolean, () => void, (value?: boolean) => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => setValue(v => !v), [])
  const set = useCallback((newValue?: boolean) => {
    setValue(newValue ?? !value)
  }, [value])

  return [value, toggle, set]
}

export function useCounter(initialValue = 0): {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
  set: (value: number) => void
} {
  const [count, setCount] = useState(initialValue)

  const increment = useCallback(() => setCount(c => c + 1), [])
  const decrement = useCallback(() => setCount(c => c - 1), [])
  const reset = useCallback(() => setCount(initialValue), [initialValue])
  const set = useCallback((value: number) => setCount(value), [])

  return { count, increment, decrement, reset, set }
}

// ===============================
// Pagination Hook
// ===============================

export function usePagination(options: UsePaginationOptions = {}): PaginationState & PaginationActions {
  const { initialPage = 1, initialPageSize = 10, total = 0 } = options

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [totalItems, setTotalItems] = useState(total)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1)

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }, [totalPages])

  const nextPage = useCallback(() => {
    if (hasNext) {
      setCurrentPage(prev => prev + 1)
    }
  }, [hasNext])

  const prevPage = useCallback(() => {
    if (hasPrev) {
      setCurrentPage(prev => prev - 1)
    }
  }, [hasPrev])

  const updatePageSize = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

  const setTotal = useCallback((newTotal: number) => {
    setTotalItems(newTotal)
    // Adjust current page if it exceeds the new total pages
    const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize))
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages)
    }
  }, [currentPage, pageSize])

  const reset = useCallback(() => {
    setCurrentPage(initialPage)
    setPageSize(initialPageSize)
    setTotalItems(total)
  }, [initialPage, initialPageSize, total])

  return {
    // State
    currentPage,
    pageSize,
    total: totalItems,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,

    // Actions
    goToPage,
    nextPage,
    prevPage,
    setPageSize: updatePageSize,
    setTotal,
    reset,
  }
}

// ===============================
// Async State Management
// ===============================

export interface UseAsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  execute: (asyncFunction: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

export function useAsyncState<T>(): UseAsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (asyncFunction: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFunction()
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
  }, [])

  return { data, loading, error, execute, reset }
}

// ===============================
// Copy to Clipboard Hook
// ===============================

export function useClipboard(): {
  copied: boolean
  copy: (text: string) => Promise<boolean>
  reset: () => void
} {
  const [copied, setCopied] = useState(false)
  const { addNotification } = useNotification()
  const timeoutRef = useRef<NodeJS.Timeout>()

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      
      addNotification({
        type: 'success',
        title: 'Copied to clipboard',
        message: 'Text has been copied successfully',
      })

      // Reset copied state after 2 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
      
      return true
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Copy failed',
        message: 'Failed to copy text to clipboard',
      })
      return false
    }
  }, [addNotification])

  const reset = useCallback(() => {
    setCopied(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { copied, copy, reset }
}

// ===============================
// Media Query Hook
// ===============================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    const updateMatches = (e: MediaQueryListEvent) => setMatches(e.matches)

    mediaQuery.addEventListener('change', updateMatches)
    return () => mediaQuery.removeEventListener('change', updateMatches)
  }, [query])

  return matches
}

// ===============================
// Window Size Hook
// ===============================

export function useWindowSize(): { width: number; height: number } {
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}

// ===============================
// Online Status Hook
// ===============================

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// ===============================
// Interval Hook
// ===============================

export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    const tick = () => savedCallback.current()
    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [delay])
}

// ===============================
// Timeout Hook
// ===============================

export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    const id = setTimeout(() => savedCallback.current(), delay)
    return () => clearTimeout(id)
  }, [delay])
}
