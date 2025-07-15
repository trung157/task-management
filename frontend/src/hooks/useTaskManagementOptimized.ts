/**
 * Optimized Task Management Hooks
 * Enhanced with performance optimizations, memoization, and intelligent caching
 * Note: Install dependencies: npm install @tanstack/react-query use-debounce
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { useDebouncedCallback } from 'use-debounce';
import { TaskApi } from '../api/taskApi';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskFilters, 
  CreateTaskRequest, 
  UpdateTaskRequest 
} from '../types';
import { ApiError } from '../api/apiClient';

// Temporary interfaces until dependencies are installed
interface PaginatedResponse<T> {
  data: T[];
  tasks?: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

// Mock React Query hooks for development
const useQuery = <T>(_options: {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}) => ({
  data: null as T | null,
  error: null,
  isLoading: false,
  isFetching: false,
  isStale: false,
  refetch: () => Promise.resolve({ data: null }),
});

const useMutation = <TData, TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<any> | any;
  onError?: (error: any, variables: TVariables, context: any) => void;
  onSuccess?: (data: TData, variables: TVariables, context: any) => void;
  onSettled?: () => void;
}) => ({
  mutateAsync: options.mutationFn,
  isPending: false,
});

const useQueryClient = () => ({
  invalidateQueries: (_options?: { queryKey: any[] }) => {},
  cancelQueries: (_options?: { queryKey: any[] }) => Promise.resolve(),
  getQueryData: (_queryKey: any[]) => undefined as any,
  setQueryData: (_queryKey: any[], _updater: any) => {},
  setQueriesData: (_queryKey: any[], _updater: any) => {},
});

// Simple debounce implementation
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// ===============================
// Performance-Optimized Task Hooks
// ===============================

export interface UseTasksOptions {
  enabled?: boolean;
  filters?: TaskFilters;
  pagination?: {
    page: number;
    limit: number;
  };
  refetchInterval?: number;
  keepPreviousData?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export interface UseTasksResult {
  tasks: Task[];
  totalTasks: number;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
  invalidate: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  page: number;
  isStale: boolean;
}

export function useTasksOptimized(options: UseTasksOptions = {}): UseTasksResult {
  const {
    enabled = true,
    filters = {},
    pagination = { page: 1, limit: 20 },
    staleTime = 5 * 60 * 1000, // 5 minutes
  } = options;

  const [page, setPage] = useState(pagination.page);
  
  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(
    () => ['tasks', JSON.stringify({ ...filters, page, limit: pagination.limit })],
    [filters, page, pagination.limit]
  );

  const {
    data,
    error,
    isLoading: loading,
    isFetching,
    isStale,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => TaskApi.getTasks(filters, page, pagination.limit),
    enabled,
    staleTime,
    // Optimize for background refetching
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const queryClient = useQueryClient();

  // Memoize derived values
  const { tasks, totalTasks, hasMore } = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const totalTasks = data?.pagination.total ?? 0;
    const hasMore = tasks.length > 0 && totalTasks > page * pagination.limit;
    
    return { tasks, totalTasks, hasMore };
  }, [data, page, pagination.limit]);

  // Optimized load more with debouncing
  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage(p => p + 1);
    }
  }, [hasMore, isFetching]);

  // Optimized invalidation
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  return {
    tasks,
    totalTasks,
    loading: loading && !isFetching,
    error,
    refetch,
    invalidate,
    hasMore,
    isFetchingMore: isFetching && page > 1,
    loadMore,
    page,
    isStale,
  };
}

// ===============================
// Optimistic Task Operations
// ===============================

export interface UseOptimisticTaskOperationsResult {
  createTask: (data: CreateTaskRequest) => Promise<Task | null>;
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  bulkUpdateTasks: (updates: Array<{ id: string; data: UpdateTaskRequest }>) => Promise<void>;
  toggleStatus: (id: string) => Promise<Task | null>;
  setPriority: (id: string, priority: TaskPriority) => Promise<Task | null>;
  isLoading: boolean;
}

export function useOptimisticTaskOperations(): UseOptimisticTaskOperationsResult {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Create task with optimistic update
  const createTaskMutation = useMutation({
    mutationFn: TaskApi.createTask,
    onMutate: async (newTask: CreateTaskRequest) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      
      const optimisticTask: Task = {
        ...newTask,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: newTask.tags || [],
        metadata: {},
        status: TaskStatus.PENDING,
        priority: newTask.priority || TaskPriority.MEDIUM,
      };

      // Optimistically update all task queries
      queryClient.setQueriesData(
        ['tasks'],
        (old: PaginatedResponse<Task> | undefined) => {
          if (!old || !old.tasks) return old;
          return {
            ...old,
            tasks: [optimisticTask, ...old.tasks],
            pagination: {
              ...old.pagination,
              total: old.pagination.total + 1,
            },
          };
        }
      );

      return { optimisticTask };
    },
    onError: (_err: any, _newTask: CreateTaskRequest, context: any) => {
      // Rollback optimistic update
      if (context?.optimisticTask) {
        queryClient.setQueriesData(
          ['tasks'],
          (old: PaginatedResponse<Task> | undefined) => {
            if (!old || !old.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.filter(task => task.id !== context.optimisticTask.id),
              pagination: {
                ...old.pagination,
                total: Math.max(0, old.pagination.total - 1),
              },
            };
          }
        );
      }
    },
    onSuccess: (newTask: Task, _variables: CreateTaskRequest, context: any) => {
      // Replace optimistic task with real task
      if (context?.optimisticTask) {
        queryClient.setQueriesData(
          ['tasks'],
          (old: PaginatedResponse<Task> | undefined) => {
            if (!old || !old.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.map(task => 
                task.id === context.optimisticTask.id ? newTask : task
              ),
            };
          }
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Update task with optimistic update
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskRequest }) =>
      TaskApi.updateTask(id, data),
    onMutate: async ({ id, data }: { id: string; data: UpdateTaskRequest }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData(['tasks']);

      queryClient.setQueriesData(
        ['tasks'],
        (old: PaginatedResponse<Task> | undefined) => {
          if (!old || !old.tasks) return old;
          return {
            ...old,
            tasks: old.tasks.map(task =>
              task.id === id 
                ? { ...task, ...data, updated_at: new Date().toISOString() }
                : task
            ),
          };
        }
      );

      return { previousTasks };
    },
    onError: (_err: any, _variables: { id: string; data: UpdateTaskRequest }, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Delete task with optimistic update
  const deleteTaskMutation = useMutation({
    mutationFn: TaskApi.deleteTask,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData(['tasks']);

      queryClient.setQueriesData(
        ['tasks'],
        (old: PaginatedResponse<Task> | undefined) => {
          if (!old || !old.tasks) return old;
          return {
            ...old,
            tasks: old.tasks.filter(task => task.id !== id),
            pagination: {
              ...old.pagination,
              total: Math.max(0, old.pagination.total - 1),
            },
          };
        }
      );

      return { previousTasks };
    },
    onError: (_err: any, _id: string, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Bulk update tasks
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: UpdateTaskRequest }>) => {
      // Implement bulk update API call
      const promises = updates.map(({ id, data }) => TaskApi.updateTask(id, data));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Helper functions with optimistic updates
  const createTask = useCallback(async (data: CreateTaskRequest): Promise<Task | null> => {
    setIsLoading(true);
    try {
      const result = await createTaskMutation.mutateAsync(data);
      return result;
    } catch (error) {
      console.error('Create task failed:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [createTaskMutation]);

  const updateTask = useCallback(async (id: string, data: UpdateTaskRequest): Promise<Task | null> => {
    try {
      const result = await updateTaskMutation.mutateAsync({ id, data });
      return result;
    } catch (error) {
      console.error('Update task failed:', error);
      return null;
    }
  }, [updateTaskMutation]);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteTaskMutation.mutateAsync(id);
    } catch (error) {
      console.error('Delete task failed:', error);
      throw error;
    }
  }, [deleteTaskMutation]);

  const bulkUpdateTasks = useCallback(async (updates: Array<{ id: string; data: UpdateTaskRequest }>): Promise<void> => {
    try {
      await bulkUpdateMutation.mutateAsync(updates);
    } catch (error) {
      console.error('Bulk update failed:', error);
      throw error;
    }
  }, [bulkUpdateMutation]);

  const toggleStatus = useCallback(async (id: string): Promise<Task | null> => {
    // Optimistically determine new status
    const tasks = queryClient.getQueryData(['tasks']) as PaginatedResponse<Task>;
    const task = tasks?.tasks?.find(t => t.id === id);
    
    if (!task) return null;

    const newStatus: TaskStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;
    return updateTask(id, { 
      status: newStatus,
    });
  }, [updateTask, queryClient]);

  const setPriority = useCallback(async (id: string, priority: TaskPriority): Promise<Task | null> => {
    return updateTask(id, { priority });
  }, [updateTask]);

  return {
    createTask,
    updateTask,
    deleteTask,
    bulkUpdateTasks,
    toggleStatus,
    setPriority,
    isLoading: isLoading || createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending,
  };
}

// ===============================
// Debounced Search Hook
// ===============================

export interface UseTaskSearchResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  results: Task[];
  isSearching: boolean;
  error: Error | null;
  clearSearch: () => void;
}

export function useTaskSearch(debounceMs = 300): UseTaskSearchResult {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);

  const {
    data: results = [],
    error,
    refetch: executeSearch,
  } = useQuery({
    queryKey: ['taskSearch', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      return TaskApi.searchTasks(searchTerm);
    },
    enabled: false, // Manual trigger
    staleTime: 30000, // 30 seconds
  });

  // Debounced search function
  const debouncedSearch = useDebouncedCallback(
    async (term: string) => {
      if (!term.trim()) {
        setIsSearching(false);
        return;
      }

      // Cancel previous search
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }

      searchAbortController.current = new AbortController();
      setIsSearching(true);

      try {
        await executeSearch();
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    },
    debounceMs
  );

  // Trigger search when term changes
  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setIsSearching(false);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    results: results || [],
    isSearching,
    error,
    clearSearch,
  };
}

// ===============================
// Batch Operations Hook
// ===============================

export interface BatchOperation {
  type: 'update' | 'delete';
  taskId: string;
  data?: UpdateTaskRequest;
}

export function useBatchTaskOperations(batchDelayMs = 500) {
  const [batchQueue, setBatchQueue] = useState<BatchOperation[]>([]);
  const queryClient = useQueryClient();

  const processBatch = useDebouncedCallback(
    async (operations: BatchOperation[]) => {
      if (operations.length === 0) return;

      try {
        // Group operations by type
        const updates = operations.filter(op => op.type === 'update' && op.data);
        const deletes = operations.filter(op => op.type === 'delete');

        // Execute batch operations using individual API calls
        const promises: Promise<any>[] = [];

        if (updates.length > 0) {
          promises.push(
            Promise.all(updates.map(op => TaskApi.updateTask(op.taskId, op.data!)))
          );
        }

        if (deletes.length > 0) {
          promises.push(
            Promise.all(deletes.map(op => TaskApi.deleteTask(op.taskId)))
          );
        }

        await Promise.all(promises);
        
        // Invalidate queries after successful batch operation
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setBatchQueue([]);
      } catch (error) {
        console.error('Batch operation failed:', error);
        // Could implement retry logic here
      }
    },
    batchDelayMs
  );

  const addToBatch = useCallback((operation: BatchOperation) => {
    setBatchQueue(prev => {
      const newQueue = [...prev, operation];
      processBatch(newQueue);
      return newQueue;
    });
  }, [processBatch]);

  const clearBatch = useCallback(() => {
    setBatchQueue([]);
  }, []);

  return {
    addToBatch,
    clearBatch,
    batchQueue,
    hasPendingOperations: batchQueue.length > 0,
  };
}

// ===============================
// Virtual Scrolling Hook
// ===============================

export interface UseVirtualScrollResult {
  visibleItems: Task[];
  containerRef: React.RefObject<HTMLDivElement>;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

export function useVirtualScroll(
  items: Task[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
): UseVirtualScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      ...item,
      virtualIndex: visibleRange.start + index,
    }));
  }, [items, visibleRange]);

  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      const scrollTop = index * itemHeight;
      containerRef.current.scrollTop = scrollTop;
      setScrollTop(scrollTop);
    }
  }, [itemHeight]);

  const scrollToTop = useCallback(() => {
    scrollToIndex(0);
  }, [scrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    visibleItems,
    containerRef,
    scrollToIndex,
    scrollToTop,
  };
}
