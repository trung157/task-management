/**
 * Error Display Components
 * User-friendly error messages with recovery actions
 */

import React from 'react';
import { useErrorHandler, AppError } from '../../contexts/ErrorContext';
import './ErrorComponents.css';

// =====================================================
// ERROR TOAST COMPONENT
// =====================================================

interface ErrorToastProps {
  error: AppError;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorToast({ error, onDismiss, onRetry }: ErrorToastProps) {
  const { dismissError, retryError } = useErrorHandler();

  const handleDismiss = () => {
    dismissError(error.id);
    onDismiss?.();
  };

  const handleRetry = () => {
    retryError(error.id);
    onRetry?.();
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
      default:
        return '⚠️';
    }
  };

  const getSeverityClass = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'error-toast--critical';
      case 'high':
        return 'error-toast--high';
      case 'medium':
        return 'error-toast--medium';
      case 'low':
        return 'error-toast--low';
      default:
        return 'error-toast--medium';
    }
  };

  return (
    <div className={`error-toast ${getSeverityClass(error.error.severity)}`}>
      <div className="error-toast__header">
        <span className="error-toast__icon">
          {getSeverityIcon(error.error.severity)}
        </span>
        <h4 className="error-toast__title">
          {error.error.title || 'Error'}
        </h4>
        <button
          className="error-toast__close"
          onClick={handleDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      </div>
      
      <div className="error-toast__content">
        <p className="error-toast__message">
          {error.error.message}
        </p>
        
        {error.error.action && (
          <p className="error-toast__action">
            {error.error.action}
          </p>
        )}
        
        {error.error.requestId && (
          <p className="error-toast__request-id">
            Request ID: {error.error.requestId}
          </p>
        )}
      </div>
      
      <div className="error-toast__actions">
        {error.error.retryable && error.recovery?.canRetry && (
          <button
            className="error-toast__retry-btn"
            onClick={handleRetry}
            disabled={error.retryCount >= (error.recovery.maxRetries || 3)}
          >
            Retry {error.retryCount > 0 && `(${error.retryCount})`}
          </button>
        )}
        
        <button
          className="error-toast__dismiss-btn"
          onClick={handleDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// =====================================================
// ERROR BOUNDARY COMPONENT
// =====================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    
    this.props.onError?.(error, errorInfo);
    
    // Log error to monitoring service
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// =====================================================
// DEFAULT ERROR FALLBACK
// =====================================================

interface DefaultErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function DefaultErrorFallback({ error, retry }: DefaultErrorFallbackProps) {
  return (
    <div className="error-fallback">
      <div className="error-fallback__container">
        <div className="error-fallback__icon">💥</div>
        <h2 className="error-fallback__title">Something went wrong</h2>
        <p className="error-fallback__message">
          We're sorry, but something unexpected happened. Please try refreshing the page.
        </p>
        <div className="error-fallback__actions">
          <button
            className="error-fallback__retry-btn"
            onClick={retry}
          >
            Try Again
          </button>
          <button
            className="error-fallback__reload-btn"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="error-fallback__details">
            <summary>Error Details (Development)</summary>
            <pre className="error-fallback__stack">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// =====================================================
// ERROR LIST COMPONENT
// =====================================================

export function ErrorList() {
  const { state, clearAllErrors } = useErrorHandler();
  const activeErrors = state.errors.filter((error: AppError) => !error.dismissed);

  if (activeErrors.length === 0) {
    return null;
  }

  return (
    <div className="error-list">
      <div className="error-list__header">
        <h3 className="error-list__title">
          Notifications ({activeErrors.length})
        </h3>
        {activeErrors.length > 1 && (
          <button
            className="error-list__clear-all"
            onClick={clearAllErrors}
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="error-list__items">
        {activeErrors.map((error: AppError) => (
          <ErrorToast key={error.id} error={error} />
        ))}
      </div>
    </div>
  );
}

// =====================================================
// OFFLINE INDICATOR
// =====================================================

export function OfflineIndicator() {
  const { state } = useErrorHandler();

  if (state.isOnline) {
    return null;
  }

  return (
    <div className="offline-indicator">
      <div className="offline-indicator__content">
        <span className="offline-indicator__icon">📡</span>
        <span className="offline-indicator__text">
          You're offline. Some features may not be available.
        </span>
      </div>
    </div>
  );
}

// =====================================================
// GLOBAL ERROR DISPLAY
// =====================================================

export function GlobalErrorDisplay() {
  const { state } = useErrorHandler();

  if (!state.globalError) {
    return null;
  }

  return (
    <div className="global-error">
      <ErrorToast error={state.globalError} />
    </div>
  );
}

// =====================================================
// ERROR MANAGER COMPONENT
// =====================================================

export function ErrorManager() {
  return (
    <>
      <GlobalErrorDisplay />
      <OfflineIndicator />
      <ErrorList />
    </>
  );
}
