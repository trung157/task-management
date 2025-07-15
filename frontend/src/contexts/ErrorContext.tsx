/**
 * Error Handling and Recovery Context
 * Provides centralized error management with user-friendly error messages and recovery actions
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// =====================================================
// ERROR TYPES AND INTERFACES
// =====================================================

export interface ErrorDetails {
  code: string;
  message: string;
  action?: string;
  title?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  retryable?: boolean;
  requestId?: string;
  timestamp?: string;
}

export interface ErrorRecoveryOptions {
  canRetry?: boolean;
  retryAfter?: number;
  circuitBreakerEnabled?: boolean;
  maxRetries?: number;
}

export interface AppError {
  id: string;
  error: ErrorDetails;
  recovery?: ErrorRecoveryOptions;
  context?: {
    url?: string;
    userId?: string;
    action?: string;
    component?: string;
  };
  retryCount: number;
  dismissed: boolean;
  createdAt: Date;
}

export interface ErrorState {
  errors: AppError[];
  globalError: AppError | null;
  isOnline: boolean;
  retryQueue: Array<{
    id: string;
    action: () => Promise<any>;
    maxRetries: number;
    currentRetries: number;
  }>;
}

// =====================================================
// ERROR ACTIONS
// =====================================================

type ErrorAction =
  | { type: 'ADD_ERROR'; payload: { error: ErrorDetails; recovery?: ErrorRecoveryOptions; context?: any } }
  | { type: 'REMOVE_ERROR'; payload: { id: string } }
  | { type: 'DISMISS_ERROR'; payload: { id: string } }
  | { type: 'RETRY_ERROR'; payload: { id: string } }
  | { type: 'SET_GLOBAL_ERROR'; payload: { error: AppError | null } }
  | { type: 'SET_ONLINE_STATUS'; payload: { isOnline: boolean } }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'ADD_TO_RETRY_QUEUE'; payload: { id: string; action: () => Promise<any>; maxRetries: number } }
  | { type: 'REMOVE_FROM_RETRY_QUEUE'; payload: { id: string } };

// =====================================================
// ERROR REDUCER
// =====================================================

const initialState: ErrorState = {
  errors: [],
  globalError: null,
  isOnline: navigator.onLine,
  retryQueue: [],
};

function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'ADD_ERROR': {
      const newError: AppError = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        error: action.payload.error,
        recovery: action.payload.recovery,
        context: action.payload.context,
        retryCount: 0,
        dismissed: false,
        createdAt: new Date(),
      };

      return {
        ...state,
        errors: [...state.errors, newError],
      };
    }

    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload.id),
      };

    case 'DISMISS_ERROR':
      return {
        ...state,
        errors: state.errors.map(error =>
          error.id === action.payload.id
            ? { ...error, dismissed: true }
            : error
        ),
      };

    case 'RETRY_ERROR':
      return {
        ...state,
        errors: state.errors.map(error =>
          error.id === action.payload.id
            ? { ...error, retryCount: error.retryCount + 1 }
            : error
        ),
      };

    case 'SET_GLOBAL_ERROR':
      return {
        ...state,
        globalError: action.payload.error,
      };

    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload.isOnline,
      };

    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: [],
        globalError: null,
      };

    case 'ADD_TO_RETRY_QUEUE':
      return {
        ...state,
        retryQueue: [...state.retryQueue, {
          id: action.payload.id,
          action: action.payload.action,
          maxRetries: action.payload.maxRetries,
          currentRetries: 0,
        }],
      };

    case 'REMOVE_FROM_RETRY_QUEUE':
      return {
        ...state,
        retryQueue: state.retryQueue.filter(item => item.id !== action.payload.id),
      };

    default:
      return state;
  }
}

// =====================================================
// ERROR CONTEXT
// =====================================================

interface ErrorContextType {
  state: ErrorState;
  addError: (error: ErrorDetails, recovery?: ErrorRecoveryOptions, context?: any) => string;
  removeError: (id: string) => void;
  dismissError: (id: string) => void;
  retryError: (id: string, retryAction?: () => Promise<any>) => void;
  setGlobalError: (error: AppError | null) => void;
  clearAllErrors: () => void;
  handleApiError: (error: any, context?: any) => string;
  executeWithErrorHandling: (
    action: () => Promise<any>,
    context?: any,
    customErrorMessage?: string
  ) => Promise<any | null>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

// =====================================================
// ERROR PROVIDER
// =====================================================

interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  // Monitor online status
  React.useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline: true } });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline: false } });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addError = useCallback((
    error: ErrorDetails,
    recovery?: ErrorRecoveryOptions,
    context?: any
  ): string => {
    dispatch({
      type: 'ADD_ERROR',
      payload: { error, recovery, context }
    });
    
    // Return the error ID for tracking
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const removeError = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: { id } });
  }, []);

  const dismissError = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_ERROR', payload: { id } });
  }, []);

  const retryError = useCallback((id: string, retryAction?: () => Promise<any>) => {
    dispatch({ type: 'RETRY_ERROR', payload: { id } });
    
    if (retryAction) {
      retryAction().catch(error => {
        // If retry fails, add a new error
        handleApiError(error, { retryAttempt: true });
      });
    }
  }, []);

  const setGlobalError = useCallback((error: AppError | null) => {
    dispatch({ type: 'SET_GLOBAL_ERROR', payload: { error } });
  }, []);

  const clearAllErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
  }, []);

  const handleApiError = useCallback((error: any, context?: any): string => {
    // Extract error details from API response
    let errorDetails: ErrorDetails;

    if (error.response?.data?.error) {
      // Enhanced error response from our backend
      const apiError = error.response.data.error;
      errorDetails = {
        code: apiError.code || 'UNKNOWN_ERROR',
        message: apiError.message || 'An unexpected error occurred',
        action: apiError.action,
        title: apiError.title,
        severity: apiError.severity || 'medium',
        retryable: apiError.retryable,
        requestId: apiError.requestId,
        timestamp: apiError.timestamp,
      };
    } else if (error.response) {
      // Standard HTTP error
      const status = error.response.status;
      errorDetails = mapHttpStatusToError(status, error.response.data?.message);
    } else if (error.request) {
      // Network error
      errorDetails = {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        action: 'Check your internet connection and try again.',
        title: 'Connection Error',
        severity: 'high',
        retryable: true,
      };
    } else {
      // Generic error
      errorDetails = {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred',
        action: 'Please try again or contact support if the problem persists.',
        title: 'Unexpected Error',
        severity: 'medium',
        retryable: true,
      };
    }

    // Extract recovery options from response
    const recovery = error.response?.data?.recovery;

    return addError(errorDetails, recovery, context);
  }, [addError]);

  const executeWithErrorHandling = useCallback(async (
    action: () => Promise<any>,
    context?: any,
    customErrorMessage?: string
  ): Promise<any | null> => {
    try {
      return await action();
    } catch (error) {
      if (customErrorMessage) {
        addError({
          code: 'CUSTOM_ERROR',
          message: customErrorMessage,
          severity: 'medium',
          retryable: true,
        }, undefined, context);
      } else {
        handleApiError(error, context);
      }
      return null;
    }
  }, [addError, handleApiError]);

  const value: ErrorContextType = {
    state,
    addError,
    removeError,
    dismissError,
    retryError,
    setGlobalError,
    clearAllErrors,
    handleApiError,
    executeWithErrorHandling,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

// =====================================================
// HOOK TO USE ERROR CONTEXT
// =====================================================

export function useErrorHandler() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useErrorHandler must be used within an ErrorProvider');
  }
  return context;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function mapHttpStatusToError(status: number, message?: string): ErrorDetails {
  switch (status) {
    case 400:
      return {
        code: 'BAD_REQUEST',
        message: message || 'Invalid request. Please check your input and try again.',
        title: 'Invalid Request',
        severity: 'medium',
        retryable: false,
      };
    case 401:
      return {
        code: 'UNAUTHORIZED',
        message: 'Please sign in to access this feature.',
        action: 'Sign in to your account.',
        title: 'Authentication Required',
        severity: 'medium',
        retryable: false,
      };
    case 403:
      return {
        code: 'FORBIDDEN',
        message: 'You don\'t have permission to perform this action.',
        action: 'Contact your administrator if you believe this is an error.',
        title: 'Access Denied',
        severity: 'medium',
        retryable: false,
      };
    case 404:
      return {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        action: 'Check the URL or try searching for what you need.',
        title: 'Not Found',
        severity: 'low',
        retryable: false,
      };
    case 429:
      return {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment before trying again.',
        action: 'Wait a few minutes and try again.',
        title: 'Rate Limited',
        severity: 'medium',
        retryable: true,
      };
    case 500:
      return {
        code: 'SERVER_ERROR',
        message: 'A server error occurred. We\'re working to fix this.',
        action: 'Please try again in a few minutes.',
        title: 'Server Error',
        severity: 'high',
        retryable: true,
      };
    default:
      return {
        code: 'HTTP_ERROR',
        message: message || `An error occurred (${status})`,
        title: 'Error',
        severity: 'medium',
        retryable: true,
      };
  }
}
