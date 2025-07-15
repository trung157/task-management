/**
 * Enhanced Error Handling System
 * Comprehensive error handling with user-friendly messages and recovery mechanisms
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// =====================================================
// ERROR TYPES AND INTERFACES
// =====================================================

export interface ErrorContext {
  requestId: string;
  userId?: string;
  userEmail?: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
  stack?: string;
  query?: any;
  body?: any;
  params?: any;
}

export interface UserFriendlyErrorMessage {
  title: string;
  message: string;
  action?: string;
  supportInfo?: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorRecoveryOptions {
  retryAttempts?: number;
  retryDelay?: number;
  fallbackData?: any;
  gracefulDegradation?: boolean;
  circuitBreakerEnabled?: boolean;
}

// =====================================================
// ENHANCED APPERROR CLASS
// =====================================================

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;
  public userMessage: UserFriendlyErrorMessage;
  public context?: any;
  public recoveryOptions?: ErrorRecoveryOptions;
  public timestamp: Date;
  public requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    userMessage?: Partial<UserFriendlyErrorMessage>,
    context?: any,
    recoveryOptions?: ErrorRecoveryOptions
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.context = context;
    this.recoveryOptions = recoveryOptions;
    this.timestamp = new Date();

    // Generate user-friendly message
    this.userMessage = this.generateUserFriendlyMessage(message, statusCode, code, userMessage);

    Error.captureStackTrace(this, this.constructor);
  }

  private generateUserFriendlyMessage(
    technicalMessage: string,
    statusCode: number,
    code: string,
    override?: Partial<UserFriendlyErrorMessage>
  ): UserFriendlyErrorMessage {
    const defaultMessages = ErrorMessageCatalog.getMessageByCode(code) || 
                           ErrorMessageCatalog.getMessageByStatusCode(statusCode);

    return {
      title: override?.title || defaultMessages.title,
      message: override?.message || defaultMessages.message,
      action: override?.action || defaultMessages.action,
      supportInfo: override?.supportInfo || defaultMessages.supportInfo,
      retryable: override?.retryable !== undefined ? override.retryable : defaultMessages.retryable,
      severity: override?.severity || defaultMessages.severity,
    };
  }

  public setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  public setContext(context: any): void {
    this.context = { ...this.context, ...context };
  }

  public isRetryable(): boolean {
    return this.userMessage.retryable && this.statusCode >= 500;
  }

  public toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp,
      requestId: this.requestId,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

// =====================================================
// ERROR MESSAGE CATALOG
// =====================================================

export class ErrorMessageCatalog {
  private static readonly messages: Record<string, UserFriendlyErrorMessage> = {
    // Authentication Errors
    UNAUTHORIZED: {
      title: 'Authentication Required',
      message: 'Please sign in to access this feature.',
      action: 'Sign in to your account or create a new one.',
      retryable: false,
      severity: 'medium',
    },
    TOKEN_EXPIRED: {
      title: 'Session Expired',
      message: 'Your session has expired for security reasons.',
      action: 'Please sign in again to continue.',
      retryable: false,
      severity: 'low',
    },
    INVALID_TOKEN: {
      title: 'Invalid Session',
      message: 'Your session is invalid or corrupted.',
      action: 'Please sign out and sign in again.',
      retryable: false,
      severity: 'medium',
    },
    INSUFFICIENT_PERMISSIONS: {
      title: 'Access Denied',
      message: 'You don\'t have permission to perform this action.',
      action: 'Contact your administrator if you believe this is an error.',
      retryable: false,
      severity: 'medium',
    },

    // Task Management Errors
    TASK_NOT_FOUND: {
      title: 'Task Not Found',
      message: 'The task you\'re looking for doesn\'t exist or has been deleted.',
      action: 'Check your task list or search for the task.',
      retryable: false,
      severity: 'low',
    },
    TASK_UPDATE_FAILED: {
      title: 'Update Failed',
      message: 'We couldn\'t save your changes to the task.',
      action: 'Please try again. If the problem persists, check your internet connection.',
      retryable: true,
      severity: 'medium',
    },
    TASK_DELETE_FAILED: {
      title: 'Delete Failed',
      message: 'We couldn\'t delete the task at this time.',
      action: 'Please try again in a moment.',
      retryable: true,
      severity: 'medium',
    },
    TASK_CREATION_FAILED: {
      title: 'Creation Failed',
      message: 'We couldn\'t create your task right now.',
      action: 'Please try again. Make sure all required fields are filled.',
      retryable: true,
      severity: 'medium',
    },

    // User Management Errors
    USER_NOT_FOUND: {
      title: 'User Not Found',
      message: 'The user account you\'re looking for doesn\'t exist.',
      action: 'Check the user information or contact support.',
      retryable: false,
      severity: 'low',
    },
    EMAIL_ALREADY_EXISTS: {
      title: 'Email Already Registered',
      message: 'An account with this email address already exists.',
      action: 'Try signing in instead, or use a different email address.',
      retryable: false,
      severity: 'low',
    },
    WEAK_PASSWORD: {
      title: 'Password Too Weak',
      message: 'Your password doesn\'t meet our security requirements.',
      action: 'Use at least 8 characters with uppercase, lowercase, numbers, and symbols.',
      retryable: false,
      severity: 'low',
    },
    INVALID_PASSWORD: {
      title: 'Incorrect Password',
      message: 'The password you entered is incorrect.',
      action: 'Please try again or reset your password if you\'ve forgotten it.',
      retryable: false,
      severity: 'low',
    },

    // Validation Errors
    VALIDATION_ERROR: {
      title: 'Invalid Information',
      message: 'Some of the information you provided is invalid.',
      action: 'Please check the highlighted fields and try again.',
      retryable: false,
      severity: 'low',
    },
    MISSING_REQUIRED_FIELDS: {
      title: 'Missing Information',
      message: 'Please fill in all required fields.',
      action: 'Check for empty required fields and complete them.',
      retryable: false,
      severity: 'low',
    },

    // Database Errors
    DATABASE_ERROR: {
      title: 'Service Temporarily Unavailable',
      message: 'We\'re experiencing technical difficulties with our database.',
      action: 'Please try again in a few minutes.',
      supportInfo: 'If this problem continues, please contact support.',
      retryable: true,
      severity: 'high',
    },
    DUPLICATE_ENTRY: {
      title: 'Duplicate Information',
      message: 'This information already exists in the system.',
      action: 'Please use different information or update the existing entry.',
      retryable: false,
      severity: 'low',
    },
    FOREIGN_KEY_VIOLATION: {
      title: 'Related Information Missing',
      message: 'The item you\'re referencing doesn\'t exist.',
      action: 'Please select a valid option from the list.',
      retryable: false,
      severity: 'low',
    },

    // Network and External Service Errors
    NETWORK_ERROR: {
      title: 'Connection Problem',
      message: 'We\'re having trouble connecting to our services.',
      action: 'Please check your internet connection and try again.',
      retryable: true,
      severity: 'medium',
    },
    EXTERNAL_SERVICE_ERROR: {
      title: 'External Service Unavailable',
      message: 'A service we depend on is temporarily unavailable.',
      action: 'Please try again later.',
      supportInfo: 'We\'re working to restore full functionality.',
      retryable: true,
      severity: 'high',
    },
    TIMEOUT_ERROR: {
      title: 'Request Timeout',
      message: 'The operation took too long to complete.',
      action: 'Please try again with a smaller request or contact support.',
      retryable: true,
      severity: 'medium',
    },

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: {
      title: 'Too Many Requests',
      message: 'You\'ve made too many requests in a short time.',
      action: 'Please wait a moment before trying again.',
      retryable: true,
      severity: 'low',
    },

    // File and Upload Errors
    FILE_TOO_LARGE: {
      title: 'File Too Large',
      message: 'The file you\'re trying to upload is too big.',
      action: 'Please select a smaller file (max 10MB).',
      retryable: false,
      severity: 'low',
    },
    INVALID_FILE_TYPE: {
      title: 'Invalid File Type',
      message: 'This file type is not supported.',
      action: 'Please select a supported file format (JPG, PNG, PDF).',
      retryable: false,
      severity: 'low',
    },

    // Generic Errors
    INTERNAL_ERROR: {
      title: 'Something Went Wrong',
      message: 'We encountered an unexpected error.',
      action: 'Please try again. If the problem persists, contact support.',
      supportInfo: 'Include what you were doing when this error occurred.',
      retryable: true,
      severity: 'high',
    },
    NOT_FOUND: {
      title: 'Page Not Found',
      message: 'The page or resource you\'re looking for doesn\'t exist.',
      action: 'Check the URL or navigate back to the main page.',
      retryable: false,
      severity: 'low',
    },
    METHOD_NOT_ALLOWED: {
      title: 'Operation Not Allowed',
      message: 'This operation is not supported.',
      action: 'Please use the correct method for this action.',
      retryable: false,
      severity: 'low',
    },
  };

  private static readonly statusCodeMessages: Record<number, UserFriendlyErrorMessage> = {
    400: {
      title: 'Invalid Request',
      message: 'The request contains invalid information.',
      action: 'Please check your input and try again.',
      retryable: false,
      severity: 'low',
    },
    401: {
      title: 'Authentication Required',
      message: 'You need to sign in to access this resource.',
      action: 'Please sign in to continue.',
      retryable: false,
      severity: 'medium',
    },
    403: {
      title: 'Access Forbidden',
      message: 'You don\'t have permission to access this resource.',
      action: 'Contact your administrator for access.',
      retryable: false,
      severity: 'medium',
    },
    404: {
      title: 'Not Found',
      message: 'The requested resource could not be found.',
      action: 'Check the URL or go back to the previous page.',
      retryable: false,
      severity: 'low',
    },
    409: {
      title: 'Conflict',
      message: 'The request conflicts with existing data.',
      action: 'Please update your information and try again.',
      retryable: false,
      severity: 'low',
    },
    429: {
      title: 'Too Many Requests',
      message: 'You\'ve exceeded the request limit.',
      action: 'Please wait before making more requests.',
      retryable: true,
      severity: 'low',
    },
    500: {
      title: 'Server Error',
      message: 'We\'re experiencing technical difficulties.',
      action: 'Please try again later.',
      supportInfo: 'If this continues, please contact support.',
      retryable: true,
      severity: 'high',
    },
    502: {
      title: 'Service Unavailable',
      message: 'Our service is temporarily unavailable.',
      action: 'Please try again in a few minutes.',
      retryable: true,
      severity: 'high',
    },
    503: {
      title: 'Service Maintenance',
      message: 'Our service is currently under maintenance.',
      action: 'Please try again later.',
      supportInfo: 'Check our status page for updates.',
      retryable: true,
      severity: 'medium',
    },
  };

  static getMessageByCode(code: string): UserFriendlyErrorMessage {
    return this.messages[code] || this.messages.INTERNAL_ERROR;
  }

  static getMessageByStatusCode(statusCode: number): UserFriendlyErrorMessage {
    return this.statusCodeMessages[statusCode] || this.statusCodeMessages[500];
  }

  static getAllMessages(): Record<string, UserFriendlyErrorMessage> {
    return { ...this.messages };
  }

  static addCustomMessage(code: string, message: UserFriendlyErrorMessage): void {
    this.messages[code] = message;
  }
}

// =====================================================
// ERROR FACTORY FUNCTIONS
// =====================================================

export class ErrorFactory {
  static createAuthenticationError(message?: string, context?: any): AppError {
    return new AppError(
      message || 'Authentication required',
      401,
      'UNAUTHORIZED',
      undefined,
      context
    );
  }

  static createAuthorizationError(message?: string, context?: any): AppError {
    return new AppError(
      message || 'Insufficient permissions',
      403,
      'INSUFFICIENT_PERMISSIONS',
      undefined,
      context
    );
  }

  static createValidationError(message: string, details?: any, context?: any): AppError {
    return new AppError(
      message,
      400,
      'VALIDATION_ERROR',
      {
        message: details ? `Invalid input: ${details}` : 'Please check your input and try again.'
      },
      context
    );
  }

  static createNotFoundError(resource: string, context?: any): AppError {
    return new AppError(
      `${resource} not found`,
      404,
      `${resource.toUpperCase()}_NOT_FOUND`,
      {
        title: `${resource} Not Found`,
        message: `The ${resource.toLowerCase()} you're looking for doesn't exist.`,
      },
      context
    );
  }

  static createDatabaseError(operation: string, originalError?: any): AppError {
    const isTransient = originalError?.code === 'ECONNRESET' || 
                       originalError?.code === 'ENOTFOUND' ||
                       originalError?.code === 'ETIMEDOUT';

    return new AppError(
      `Database ${operation} failed`,
      500,
      'DATABASE_ERROR',
      {
        retryable: isTransient,
        severity: isTransient ? 'medium' : 'high',
      },
      { originalError: originalError?.message },
      { retryAttempts: isTransient ? 3 : 0, retryDelay: 1000 }
    );
  }

  static createExternalServiceError(service: string, originalError?: any): AppError {
    return new AppError(
      `External service ${service} failed`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      {
        title: `${service} Service Unavailable`,
        message: `We're having trouble connecting to ${service}.`,
        supportInfo: 'We are working to restore full functionality.',
      },
      { service, originalError: originalError?.message },
      { retryAttempts: 3, retryDelay: 2000, circuitBreakerEnabled: true }
    );
  }

  static createTimeoutError(operation: string, timeout: number): AppError {
    return new AppError(
      `Operation ${operation} timed out after ${timeout}ms`,
      408,
      'TIMEOUT_ERROR',
      {
        message: `The ${operation} operation took too long to complete.`,
        action: 'Please try again or contact support if this continues.',
      },
      { operation, timeout },
      { retryAttempts: 2, retryDelay: 3000 }
    );
  }

  static createRateLimitError(limit: number, windowMs: number): AppError {
    const resetTime = new Date(Date.now() + windowMs);
    return new AppError(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      429,
      'RATE_LIMIT_EXCEEDED',
      {
        action: `Please wait until ${resetTime.toLocaleTimeString()} before trying again.`,
      },
      { limit, windowMs, resetTime }
    );
  }
}

// =====================================================
// ENHANCED ERROR HANDLER MIDDLEWARE
// =====================================================

/**
 * Enhanced error handler middleware that provides user-friendly error messages
 * and integrates with error recovery mechanisms
 */
export const userFriendlyErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Create error context
  const context: ErrorContext = {
    requestId: req.headers['x-request-id'] as string || 'unknown',
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email,
    method: req.method,
    url: req.url,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'],
    timestamp: new Date(),
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
  };

  let appError: AppError;

  // Convert error to AppError if it's not already one
  if (error instanceof AppError) {
    appError = error;
  } else {
    // Determine error type and create appropriate AppError
    if (error.name === 'ValidationError') {
      appError = ErrorFactory.createValidationError('Input validation failed', error);
    } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
      appError = ErrorFactory.createAuthenticationError('Authentication required');
    } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
      appError = ErrorFactory.createAuthorizationError('Insufficient permissions');
    } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
      appError = ErrorFactory.createNotFoundError('Resource not found');
    } else if (error.name === 'ConflictError' || error.message.includes('conflict')) {
      appError = ErrorFactory.createValidationError('Resource conflict', error);
    } else if (error.message.includes('timeout')) {
      appError = ErrorFactory.createTimeoutError('Operation', 30000);
    } else {
      // Generic server error
      appError = ErrorFactory.createExternalServiceError('Server', error);
    }
  }

  // Add error context
  appError.context = context;

  // Log the error
  logger.error('Enhanced error handler caught error:', {
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      stack: appError.stack,
    },
    context,
    recoveryOptions: appError.recoveryOptions,
  });

  // Get user-friendly message
  const userMessage = ErrorMessageCatalog.getMessageByCode(appError.code) || 
                      ErrorMessageCatalog.getMessageByStatusCode(appError.statusCode);

  // Prepare response
  const errorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: userMessage.message,
      action: userMessage.action,
      title: userMessage.title,
      severity: userMessage.severity,
      retryable: userMessage.retryable,
      requestId: context.requestId,
      timestamp: context.timestamp,
    },
    ...(appError.recoveryOptions && {
      recovery: {
        canRetry: (appError.recoveryOptions.retryAttempts || 0) > 0,
        retryAfter: appError.recoveryOptions.retryDelay,
        circuitBreakerEnabled: appError.recoveryOptions.circuitBreakerEnabled,
      },
    }),
  };

  // In development, include additional debug information
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).debug = {
      originalError: error.message,
      stack: error.stack,
      context: context,
    };
  }

  // Send error response
  res.status(appError.statusCode).json(errorResponse);
};
