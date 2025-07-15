/**
 * Error Recovery and Handling Middleware
 * Implements recovery mechanisms, retry logic, and user-friendly error responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorContext, ErrorFactory } from './enhancedErrorHandler';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../services/performanceMonitor';

// =====================================================
// ERROR RECOVERY MECHANISMS
// =====================================================

export class ErrorRecoveryService {
  private static retryAttempts: Map<string, number> = new Map();
  private static circuitBreakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Automatic retry mechanism for retryable errors
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: boolean;
      retryCondition?: (error: any) => boolean;
      operationId?: string;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = true,
      retryCondition = (error) => error instanceof AppError && error.isRetryable(),
      operationId = 'default',
    } = options;

    let lastError: any;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry count on success
        this.retryAttempts.delete(operationId);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!retryCondition(error) || attempt === maxAttempts) {
          // Track failed attempts
          this.retryAttempts.set(operationId, attempt);
          throw error;
        }

        // Log retry attempt
        logger.warn('Retrying operation', {
          operationId,
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : 'Unknown error',
          nextRetryIn: currentDelay,
        });

        // Wait before retry
        await this.sleep(currentDelay);
        
        // Exponential backoff
        if (backoff) {
          currentDelay *= 2;
        }
      }
    }

    throw lastError;
  }

  /**
   * Circuit breaker pattern for external services
   */
  static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceId: string,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitorWindow?: number;
    } = {}
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(serviceId, options);
    return circuitBreaker.execute(operation);
  }

  /**
   * Graceful degradation with fallback data
   */
  static async withFallback<T>(
    operation: () => Promise<T>,
    fallback: T | (() => Promise<T>),
    options: {
      timeout?: number;
      fallbackCondition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const { timeout = 10000, fallbackCondition } = options;

    try {
      // Execute with timeout
      const result = await Promise.race([
        operation(),
        this.timeoutPromise<T>(timeout),
      ]);
      return result;
    } catch (error) {
      // Check if we should use fallback
      if (!fallbackCondition || fallbackCondition(error)) {
        logger.warn('Using fallback data due to error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return typeof fallback === 'function' ? await (fallback as () => Promise<T>)() : fallback;
      }
      throw error;
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static timeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(ErrorFactory.createTimeoutError('Operation', ms)), ms);
    });
  }

  private static getOrCreateCircuitBreaker(
    serviceId: string,
    options: any
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, new CircuitBreaker(serviceId, options));
    }
    return this.circuitBreakers.get(serviceId)!;
  }
}

// =====================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =====================================================

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private serviceId: string,
    private options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitorWindow?: number;
      successThreshold?: number;
    } = {}
  ) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitorWindow: 60000, // 1 minute
      successThreshold: 2,
      ...options,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout!) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker entering HALF_OPEN state', { serviceId: this.serviceId });
      } else {
        throw ErrorFactory.createExternalServiceError(
          this.serviceId,
          new Error('Circuit breaker is OPEN')
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold!) {
        this.state = 'CLOSED';
        logger.info('Circuit breaker closed', { serviceId: this.serviceId });
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', {
        serviceId: this.serviceId,
        failureCount: this.failureCount,
      });
    }
  }

  getState(): string {
    return this.state;
  }

  getStats(): any {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// =====================================================
// ENHANCED ERROR HANDLER MIDDLEWARE
// =====================================================

export const enhancedErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // Create error context
  const context: ErrorContext = {
    requestId,
    userId: req.user?.id,
    userEmail: req.user?.email,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    timestamp: new Date(),
    stack: err.stack,
    query: sanitizeObject(req.query),
    body: sanitizeObject(req.body),
    params: req.params,
  };

  // Convert to AppError if necessary
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
    appError.setRequestId(requestId);
  } else {
    appError = convertToAppError(err, context);
  }

  // Log error with context
  logError(appError, context);

  // Track error metrics
  performanceMonitor.trackApiRequest({
    route: req.route?.path || req.path,
    method: req.method,
    duration: Date.now() - (req as any).startTime,
    statusCode: appError.statusCode,
    userId: req.user?.id,
  });

  // Determine if we should include sensitive information
  const includeDetails = shouldIncludeErrorDetails(req, appError);

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      type: 'error',
      code: appError.code,
      message: appError.userMessage.message,
      title: appError.userMessage.title,
      action: appError.userMessage.action,
      requestId,
      timestamp: appError.timestamp.toISOString(),
      ...(appError.userMessage.supportInfo && {
        supportInfo: appError.userMessage.supportInfo,
      }),
      ...(includeDetails && {
        technicalMessage: appError.message,
        stack: appError.stack,
        context: appError.context,
      }),
    },
    ...(appError.recoveryOptions && {
      recovery: {
        retryable: appError.isRetryable(),
        retryAfter: appError.recoveryOptions.retryDelay,
        maxRetries: appError.recoveryOptions.retryAttempts,
      },
    }),
  };

  res.status(appError.statusCode).json(errorResponse);
};

// =====================================================
// VALIDATION ERROR HANDLER
// =====================================================

export const validationErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((error: any) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    const appError = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      {
        message: 'Please check the highlighted fields and correct any errors.',
        action: 'Review your input and try again.',
      },
      { validationErrors }
    );

    return enhancedErrorHandler(appError, req, res, next);
  }

  next();
};

// =====================================================
// DATABASE ERROR HANDLER
// =====================================================

export const databaseErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // PostgreSQL specific errors
  if (err.code) {
    let appError: AppError;

    switch (err.code) {
      case '23505': // Unique violation
        appError = new AppError(
          'Duplicate entry violation',
          409,
          'DUPLICATE_ENTRY',
          {
            title: 'Information Already Exists',
            message: 'This information is already in our system.',
            action: 'Please use different information or update the existing entry.',
          },
          { pgCode: err.code, detail: err.detail }
        );
        break;

      case '23503': // Foreign key violation
        appError = new AppError(
          'Foreign key violation',
          400,
          'FOREIGN_KEY_VIOLATION',
          {
            title: 'Invalid Reference',
            message: 'The item you\'re referencing doesn\'t exist.',
            action: 'Please select a valid option from the list.',
          },
          { pgCode: err.code, detail: err.detail }
        );
        break;

      case '23502': // Not null violation
        appError = new AppError(
          'Required field missing',
          400,
          'MISSING_REQUIRED_FIELDS',
          undefined,
          { pgCode: err.code, column: err.column }
        );
        break;

      case '42P01': // Undefined table
        appError = new AppError(
          'Database configuration error',
          500,
          'DATABASE_ERROR',
          {
            severity: 'critical',
            retryable: false,
          },
          { pgCode: err.code }
        );
        break;

      default:
        appError = ErrorFactory.createDatabaseError('operation', err);
    }

    return enhancedErrorHandler(appError, req, res, next);
  }

  // Other database errors
  if (err.name === 'QueryFailedError' || err.name === 'ConnectionError') {
    const appError = ErrorFactory.createDatabaseError('query', err);
    return enhancedErrorHandler(appError, req, res, next);
  }

  next(err);
};

// =====================================================
// JWT ERROR HANDLER
// =====================================================

export const jwtErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.name === 'JsonWebTokenError') {
    const appError = new AppError(
      'Invalid token',
      401,
      'INVALID_TOKEN',
      undefined,
      { jwtError: err.message }
    );
    return enhancedErrorHandler(appError, req, res, next);
  }

  if (err.name === 'TokenExpiredError') {
    const appError = new AppError(
      'Token expired',
      401,
      'TOKEN_EXPIRED',
      {
        action: 'Please sign in again to continue.',
      },
      { expiredAt: err.expiredAt }
    );
    return enhancedErrorHandler(appError, req, res, next);
  }

  if (err.name === 'NotBeforeError') {
    const appError = new AppError(
      'Token not active',
      401,
      'TOKEN_NOT_ACTIVE',
      undefined,
      { notBefore: err.notBefore }
    );
    return enhancedErrorHandler(appError, req, res, next);
  }

  next(err);
};

// =====================================================
// RATE LIMITING ERROR HANDLER
// =====================================================

export const rateLimitErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.status === 429 || err.type === 'RATE_LIMIT_EXCEEDED') {
    const resetTime = new Date(Date.now() + (err.resetTime || 60000));
    const appError = ErrorFactory.createRateLimitError(
      err.limit || 100,
      err.resetTime || 60000
    );
    appError.setContext({
      resetTime: resetTime.toISOString(),
      remainingRequests: err.remaining || 0,
    });
    return enhancedErrorHandler(appError, req, res, next);
  }

  next(err);
};

// =====================================================
// 404 NOT FOUND HANDLER
// =====================================================

export const notFoundHandler = (req: Request, res: Response): void => {
  const appError = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    'NOT_FOUND',
    {
      title: 'Page Not Found',
      message: 'The page you\'re looking for doesn\'t exist.',
      action: 'Check the URL or navigate back to the main page.',
    },
    {
      method: req.method,
      url: req.originalUrl,
      availableRoutes: getAvailableRoutes(req),
    }
  );

  enhancedErrorHandler(appError, req, res, () => {});
};

// =====================================================
// ASYNC ERROR WRAPPER
// =====================================================

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function convertToAppError(err: Error, context: ErrorContext): AppError {
  // Check for specific error types
  if (err.name === 'ValidationError') {
    return ErrorFactory.createValidationError(err.message, undefined, context);
  }

  if (err.name === 'CastError') {
    return ErrorFactory.createValidationError('Invalid data format', err.message, context);
  }

  if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
    return ErrorFactory.createExternalServiceError('database', err);
  }

  if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
    return ErrorFactory.createTimeoutError('request', 30000);
  }

  // Default to internal error
  return new AppError(
    err.message || 'Internal server error',
    500,
    'INTERNAL_ERROR',
    undefined,
    { originalError: err.message, stack: err.stack }
  );
}

function logError(error: AppError, context: ErrorContext): void {
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  
  logger[logLevel]('Request error occurred', {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      userMessage: error.userMessage,
      stack: error.stack,
    },
    context,
    recovery: error.recoveryOptions,
  });
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function shouldIncludeErrorDetails(req: Request, error: AppError): boolean {
  // Include details in development
  if (process.env.NODE_ENV === 'development') return true;

  // Include details for admin users
  if (req.user?.role === 'admin' || req.user?.role === 'super_admin') return true;

  // Include details for internal errors (but sanitized)
  if (error.statusCode >= 500) return false;

  return false;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getAvailableRoutes(req: Request): string[] {
  // This would return available routes for the current path
  // Implementation depends on your routing setup
  return ['GET /', 'GET /api/tasks', 'POST /api/auth/login'];
}

// =====================================================
// ERROR MONITORING MIDDLEWARE
// =====================================================

export const errorMonitoringMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add start time for performance tracking
  (req as any).startTime = Date.now();

  // Add request ID
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;

  // Monitor response for errors
  const originalSend = res.send;
  res.send = function(data: any) {
    const statusCode = res.statusCode;
    const duration = Date.now() - (req as any).startTime;

    // Track response metrics
    performanceMonitor.trackApiRequest({
      route: req.route?.path || req.path,
      method: req.method,
      duration,
      statusCode,
      userId: req.user?.id,
    });

    return originalSend.call(this, data);
  };

  next();
};
