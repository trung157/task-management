import { useState, useCallback, useRef, useEffect } from 'react'

// ===============================
// Advanced State Management Hooks
// ===============================

export interface UseUndoRedoOptions<T> {
  maxHistorySize?: number
  initialState: T
  enableRedo?: boolean
}

export interface UseUndoRedoResult<T> {
  state: T
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  setState: (newState: T | ((prev: T) => T)) => void
  clearHistory: () => void
  jump: (steps: number) => void
}

export function useUndoRedo<T>(options: UseUndoRedoOptions<T>): UseUndoRedoResult<T> {
  const { maxHistorySize = 50, initialState, enableRedo = true } = options

  const [history, setHistory] = useState<T[]>([initialState])
  const [currentIndex, setCurrentIndex] = useState(0)

  const state = history[currentIndex]

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prevHistory => {
      const currentState = prevHistory[currentIndex]
      const nextState = typeof newState === 'function' ? (newState as Function)(currentState) : newState

      // Don't add to history if state hasn't changed
      if (JSON.stringify(nextState) === JSON.stringify(currentState)) {
        return prevHistory
      }

      const newHistory = prevHistory.slice(0, currentIndex + 1)
      newHistory.push(nextState)

      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift()
        setCurrentIndex(prev => Math.max(0, prev - 1))
        return newHistory
      }

      setCurrentIndex(newHistory.length - 1)
      return newHistory
    })
  }, [currentIndex, maxHistorySize])

  const undo = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  const redo = useCallback(() => {
    if (enableRedo) {
      setCurrentIndex(prev => Math.min(history.length - 1, prev + 1))
    }
  }, [enableRedo, history.length])

  const clearHistory = useCallback(() => {
    setHistory([state])
    setCurrentIndex(0)
  }, [state])

  const jump = useCallback((steps: number) => {
    setCurrentIndex(prev => {
      const newIndex = prev + steps
      return Math.max(0, Math.min(history.length - 1, newIndex))
    })
  }, [history.length])

  return {
    state,
    canUndo: currentIndex > 0,
    canRedo: enableRedo && currentIndex < history.length - 1,
    undo,
    redo,
    setState,
    clearHistory,
    jump
  }
}

// ===============================
// Async State Hook
// ===============================

export interface UseAsyncStateOptions<T> {
  initialState?: T
  resetOnStart?: boolean
}

export interface UseAsyncStateResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

export function useAsyncState<T = any>(
  options: UseAsyncStateOptions<T> = {}
): UseAsyncStateResult<T> {
  const { initialState = null, resetOnStart = true } = options

  const [data, setData] = useState<T | null>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
    if (resetOnStart) {
      setData(null)
    }
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn()
      if (mountedRef.current) {
        setData(result)
        setLoading(false)
      }
      return result
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setLoading(false)
      }
      return null
    }
  }, [resetOnStart])

  const reset = useCallback(() => {
    setData(initialState)
    setLoading(false)
    setError(null)
  }, [initialState])

  return { data, loading, error, execute, reset }
}

// ===============================
// Toggle Hook
// ===============================

export interface UseToggleResult {
  value: boolean
  toggle: () => void
  setTrue: () => void
  setFalse: () => void
  setValue: (value: boolean) => void
}

export function useToggle(initialValue = false): UseToggleResult {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => setValue(prev => !prev), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])

  return { value, toggle, setTrue, setFalse, setValue }
}

// ===============================
// Counter Hook
// ===============================

export interface UseCounterOptions {
  min?: number
  max?: number
  step?: number
}

export interface UseCounterResult {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
  set: (value: number) => void
}

export function useCounter(
  initialValue = 0,
  options: UseCounterOptions = {}
): UseCounterResult {
  const { min, max, step = 1 } = options
  const [count, setCount] = useState(initialValue)

  const increment = useCallback(() => {
    setCount(prev => {
      const newValue = prev + step
      return max !== undefined ? Math.min(max, newValue) : newValue
    })
  }, [step, max])

  const decrement = useCallback(() => {
    setCount(prev => {
      const newValue = prev - step
      return min !== undefined ? Math.max(min, newValue) : newValue
    })
  }, [step, min])

  const reset = useCallback(() => setCount(initialValue), [initialValue])

  const set = useCallback((value: number) => {
    setCount(() => {
      if (min !== undefined && value < min) return min
      if (max !== undefined && value > max) return max
      return value
    })
  }, [min, max])

  return { count, increment, decrement, reset, set }
}

// ===============================
// Previous Value Hook
// ===============================

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

// ===============================
// Array State Hook
// ===============================

export interface UseArrayResult<T> {
  value: T[]
  setValue: (value: T[]) => void
  push: (item: T) => void
  filter: (callback: (item: T, index: number) => boolean) => void
  update: (index: number, item: T) => void
  remove: (index: number) => void
  clear: () => void
  move: (from: number, to: number) => void
  swap: (indexA: number, indexB: number) => void
}

export function useArray<T>(defaultValue: T[] = []): UseArrayResult<T> {
  const [value, setValue] = useState<T[]>(defaultValue)

  const push = useCallback((item: T) => {
    setValue(prev => [...prev, item])
  }, [])

  const filter = useCallback((callback: (item: T, index: number) => boolean) => {
    setValue(prev => prev.filter(callback))
  }, [])

  const update = useCallback((index: number, item: T) => {
    setValue(prev => {
      const newArray = [...prev]
      if (index >= 0 && index < newArray.length) {
        newArray[index] = item
      }
      return newArray
    })
  }, [])

  const remove = useCallback((index: number) => {
    setValue(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => setValue([]), [])

  const move = useCallback((from: number, to: number) => {
    setValue(prev => {
      const newArray = [...prev]
      if (from >= 0 && from < newArray.length && to >= 0 && to < newArray.length) {
        const [removed] = newArray.splice(from, 1)
        newArray.splice(to, 0, removed)
      }
      return newArray
    })
  }, [])

  const swap = useCallback((indexA: number, indexB: number) => {
    setValue(prev => {
      const newArray = [...prev]
      if (
        indexA >= 0 && indexA < newArray.length &&
        indexB >= 0 && indexB < newArray.length
      ) {
        [newArray[indexA], newArray[indexB]] = [newArray[indexB], newArray[indexA]]
      }
      return newArray
    })
  }, [])

  return {
    value,
    setValue,
    push,
    filter,
    update,
    remove,
    clear,
    move,
    swap
  }
}

// ===============================
// Map State Hook
// ===============================

export interface UseMapResult<K, V> {
  value: Map<K, V>
  setValue: (value: Map<K, V>) => void
  set: (key: K, value: V) => void
  get: (key: K) => V | undefined
  has: (key: K) => boolean
  delete: (key: K) => void
  clear: () => void
  size: number
  keys: () => IterableIterator<K>
  values: () => IterableIterator<V>
  entries: () => IterableIterator<[K, V]>
}

export function useMap<K, V>(initialValue?: Map<K, V>): UseMapResult<K, V> {
  const [value, setValue] = useState<Map<K, V>>(initialValue || new Map())

  const set = useCallback((key: K, val: V) => {
    setValue(prev => new Map(prev).set(key, val))
  }, [])

  const get = useCallback((key: K) => value.get(key), [value])
  const has = useCallback((key: K) => value.has(key), [value])

  const deleteKey = useCallback((key: K) => {
    setValue(prev => {
      const newMap = new Map(prev)
      newMap.delete(key)
      return newMap
    })
  }, [])

  const clear = useCallback(() => setValue(new Map()), [])

  return {
    value,
    setValue,
    set,
    get,
    has,
    delete: deleteKey,
    clear,
    size: value.size,
    keys: () => value.keys(),
    values: () => value.values(),
    entries: () => value.entries()
  }
}

// ===============================
// Set State Hook
// ===============================

export interface UseSetResult<T> {
  value: Set<T>
  setValue: (value: Set<T>) => void
  add: (item: T) => void
  delete: (item: T) => void
  has: (item: T) => boolean
  clear: () => void
  toggle: (item: T) => void
  size: number
}

export function useSet<T>(initialValue?: Set<T>): UseSetResult<T> {
  const [value, setValue] = useState<Set<T>>(initialValue || new Set())

  const add = useCallback((item: T) => {
    setValue(prev => new Set(prev).add(item))
  }, [])

  const deleteItem = useCallback((item: T) => {
    setValue(prev => {
      const newSet = new Set(prev)
      newSet.delete(item)
      return newSet
    })
  }, [])

  const has = useCallback((item: T) => value.has(item), [value])
  const clear = useCallback(() => setValue(new Set()), [])

  const toggle = useCallback((item: T) => {
    setValue(prev => {
      const newSet = new Set(prev)
      if (newSet.has(item)) {
        newSet.delete(item)
      } else {
        newSet.add(item)
      }
      return newSet
    })
  }, [])

  return {
    value,
    setValue,
    add,
    delete: deleteItem,
    has,
    clear,
    toggle,
    size: value.size
  }
}

// ===============================
// Selection Hook
// ===============================

export interface UseSelectionOptions {
  multiple?: boolean
}

export interface UseSelectionResult<T> {
  selectedItems: T[]
  isSelected: (item: T) => boolean
  select: (item: T) => void
  deselect: (item: T) => void
  toggle: (item: T) => void
  selectAll: (items: T[]) => void
  deselectAll: () => void
  setSelected: (items: T[]) => void
}

export function useSelection<T>(
  options: UseSelectionOptions = {}
): UseSelectionResult<T> {
  const { multiple = true } = options
  const [selectedItems, setSelectedItems] = useState<T[]>([])

  const isSelected = useCallback((item: T) => {
    return selectedItems.some(selected => 
      JSON.stringify(selected) === JSON.stringify(item)
    )
  }, [selectedItems])

  const select = useCallback((item: T) => {
    setSelectedItems(prev => {
      if (isSelected(item)) return prev
      return multiple ? [...prev, item] : [item]
    })
  }, [multiple, isSelected])

  const deselect = useCallback((item: T) => {
    setSelectedItems(prev => 
      prev.filter(selected => 
        JSON.stringify(selected) !== JSON.stringify(item)
      )
    )
  }, [])

  const toggle = useCallback((item: T) => {
    if (isSelected(item)) {
      deselect(item)
    } else {
      select(item)
    }
  }, [isSelected, select, deselect])

  const selectAll = useCallback((items: T[]) => {
    setSelectedItems(multiple ? items : items.slice(0, 1))
  }, [multiple])

  const deselectAll = useCallback(() => {
    setSelectedItems([])
  }, [])

  const setSelected = useCallback((items: T[]) => {
    setSelectedItems(multiple ? items : items.slice(0, 1))
  }, [multiple])

  return {
    selectedItems,
    isSelected,
    select,
    deselect,
    toggle,
    selectAll,
    deselectAll,
    setSelected
  }
}
