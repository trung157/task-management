/**
 * API Error Handling Hook
 * Integrates with the error handling system for API calls
 */

import { useCallback } from 'react';
import { useErrorHandler } from '../contexts/ErrorContext';

interface ApiOptions {
  showErrorToast?: boolean;
  customErrorMessage?: string;
  context?: any;
  retryable?: boolean;
}

export function useApiError() {
  const { handleApiError } = useErrorHandler();

  const execute = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options: ApiOptions = {}
  ): Promise<T | null> => {
    const {
      showErrorToast = true,
      customErrorMessage,
      context,
    } = options;

    try {
      return await apiCall();
    } catch (error) {
      if (showErrorToast) {
        if (customErrorMessage) {
          handleApiError(
            { message: customErrorMessage },
            { ...context, custom: true }
          );
        } else {
          handleApiError(error, context);
        }
      }
      return null;
    }
  }, [handleApiError]);

  return { execute };
}

// Specialized hooks for common API operations
export function useTaskApi() {
  const { execute } = useApiError();

  const createTask = useCallback((taskData: any) => {
    return execute(
      () => fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      }).then(res => res.json()),
      {
        context: { action: 'create_task', taskData },
        customErrorMessage: 'Failed to create task. Please try again.',
      }
    );
  }, [execute]);

  const updateTask = useCallback((taskId: string, taskData: any) => {
    return execute(
      () => fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      }).then(res => res.json()),
      {
        context: { action: 'update_task', taskId, taskData },
        customErrorMessage: 'Failed to update task. Please try again.',
      }
    );
  }, [execute]);

  const deleteTask = useCallback((taskId: string) => {
    return execute(
      () => fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      }).then(res => res.json()),
      {
        context: { action: 'delete_task', taskId },
        customErrorMessage: 'Failed to delete task. Please try again.',
      }
    );
  }, [execute]);

  const getTasks = useCallback((filters?: any) => {
    return execute(
      () => {
        const queryParams = filters ? `?${new URLSearchParams(filters).toString()}` : '';
        return fetch(`/api/tasks${queryParams}`).then(res => res.json());
      },
      {
        context: { action: 'get_tasks', filters },
        customErrorMessage: 'Failed to load tasks. Please refresh the page.',
      }
    );
  }, [execute]);

  return {
    createTask,
    updateTask,
    deleteTask,
    getTasks,
  };
}

export function useAuthApi() {
  const { execute } = useApiError();

  const login = useCallback((credentials: { email: string; password: string }) => {
    return execute(
      () => fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      }).then(res => res.json()),
      {
        context: { action: 'login', email: credentials.email },
        customErrorMessage: 'Login failed. Please check your credentials.',
      }
    );
  }, [execute]);

  const register = useCallback((userData: any) => {
    return execute(
      () => fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      }).then(res => res.json()),
      {
        context: { action: 'register', email: userData.email },
        customErrorMessage: 'Registration failed. Please try again.',
      }
    );
  }, [execute]);

  const logout = useCallback(() => {
    return execute(
      () => fetch('/api/auth/logout', {
        method: 'POST',
      }).then(res => res.json()),
      {
        context: { action: 'logout' },
        customErrorMessage: 'Logout failed. Please try again.',
      }
    );
  }, [execute]);

  const refreshToken = useCallback(() => {
    return execute(
      () => fetch('/api/auth/refresh', {
        method: 'POST',
      }).then(res => res.json()),
      {
        context: { action: 'refresh_token' },
        showErrorToast: false, // Silent refresh
      }
    );
  }, [execute]);

  return {
    login,
    register,
    logout,
    refreshToken,
  };
}
