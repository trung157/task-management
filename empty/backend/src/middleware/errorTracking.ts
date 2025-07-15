import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { monitoringService } from '../services/monitoringService'

interface ErrorContext {
  requestId: string
  userId?: string
  userEmail?: string
  method: string
  url: string
  ip: string
  userAgent?: string
  timestamp: string
  stack?: string
  query?: any
  body?: any
  params?: any
}

interface ApiError extends Error {
  status?: number
  statusCode?: number
  code?: string
  type?: string
  details?: any
}

class ErrorTrackingMiddleware {
  /**
   * Global error handler middleware
   */
  static globalErrorHandler(error: ApiError, req: Request, res: Response, next: NextFunction): void {
    const errorContext: ErrorContext = {
      requestId: req.requestId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      stack: error.stack,
      query: req.query,
      body: ErrorTrackingMiddleware.sanitizeBody(req.body),
      params: req.params
    }

    const statusCode = error.status || error.statusCode || 500
    const errorType = ErrorTrackingMiddleware.categorizeError(error, statusCode)

    // Log error with context
    logger.error(`${errorType}: ${error.message}`, {
      ...errorContext,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        type: errorType,
        details: error.details
      }
    })

    // Record error in monitoring service
    monitoringService.recordError(error.message, errorType)

    // Send error response
    const errorResponse = ErrorTrackingMiddleware.formatErrorResponse(error, statusCode, req.requestId)
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
      errorResponse.message = 'Internal server error'
      delete errorResponse.stack
      delete errorResponse.details
    }

    res.status(statusCode).json(errorResponse)
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncErrorHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next)
    }
  }

  /**
   * 404 handler
   */
  static notFoundHandler(req: Request, res: Response, next: NextFunction): void {
    const error: ApiError = new Error(`Route ${req.method} ${req.originalUrl} not found`)
    error.status = 404
    error.type = 'NOT_FOUND'
    next(error)
  }

  /**
   * Validation error handler
   */
  static validationErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    if (error.name === 'ValidationError' || error.type === 'validation') {
      const validationError: ApiError = new Error('Validation failed')
      validationError.status = 400
      validationError.type = 'VALIDATION_ERROR'
      validationError.details = error.details || error.errors
      
      next(validationError)
      return
    }
    next(error)
  }

  /**
   * Database error handler
   */
  static databaseErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    // PostgreSQL errors
    if (error.code) {
      let dbError: ApiError
      
      switch (error.code) {
        case '23505': // Unique violation
          dbError = new Error('Duplicate entry')
          dbError.status = 409
          dbError.type = 'DUPLICATE_ENTRY'
          break
        case '23503': // Foreign key violation
          dbError = new Error('Referenced record not found')
          dbError.status = 400
          dbError.type = 'FOREIGN_KEY_VIOLATION'
          break
        case '23502': // Not null violation
          dbError = new Error('Required field missing')
          dbError.status = 400
          dbError.type = 'REQUIRED_FIELD_MISSING'
          break
        case '42703': // Undefined column
          dbError = new Error('Invalid field')
          dbError.status = 400
          dbError.type = 'INVALID_FIELD'
          break
        default:
          dbError = new Error('Database error')
          dbError.status = 500
          dbError.type = 'DATABASE_ERROR'
      }
      
      dbError.details = {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      }
      
      next(dbError)
      return
    }
    
    next(error)
  }

  /**
   * JWT error handler
   */
  static jwtErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    if (error.name === 'JsonWebTokenError') {
      const jwtError: ApiError = new Error('Invalid token')
      jwtError.status = 401
      jwtError.type = 'INVALID_TOKEN'
      next(jwtError)
      return
    }
    
    if (error.name === 'TokenExpiredError') {
      const jwtError: ApiError = new Error('Token expired')
      jwtError.status = 401
      jwtError.type = 'TOKEN_EXPIRED'
      next(jwtError)
      return
    }
    
    next(error)
  }

  /**
   * Rate limit error handler
   */
  static rateLimitErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
    if (error.status === 429 || error.type === 'RATE_LIMIT_EXCEEDED') {
      const rateLimitError: ApiError = new Error('Rate limit exceeded')
      rateLimitError.status = 429
      rateLimitError.type = 'RATE_LIMIT_EXCEEDED'
      rateLimitError.details = {
        limit: error.limit,
        current: error.current,
        resetTime: error.resetTime
      }
      next(rateLimitError)
      return
    }
    
    next(error)
  }

  /**
   * Categorize error type
   */
  private static categorizeError(error: ApiError, statusCode: number): string {
    if (error.type) return error.type

    if (statusCode >= 500) return 'SERVER_ERROR'
    if (statusCode >= 400) return 'CLIENT_ERROR'
    
    // Categorize by error name or message
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR'
    if (error.name === 'CastError') return 'CAST_ERROR'
    if (error.message.includes('duplicate')) return 'DUPLICATE_ENTRY'
    if (error.message.includes('not found')) return 'NOT_FOUND'
    if (error.message.includes('unauthorized')) return 'UNAUTHORIZED'
    if (error.message.includes('forbidden')) return 'FORBIDDEN'
    
    return 'UNKNOWN_ERROR'
  }

  /**
   * Format error response
   */
  private static formatErrorResponse(error: ApiError, statusCode: number, requestId: string) {
    const response: any = {
      success: false,
      error: {
        type: error.type || ErrorTrackingMiddleware.categorizeError(error, statusCode),
        message: error.message,
        requestId,
        timestamp: new Date().toISOString()
      }
    }

    // Add error details in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      if (error.stack) response.error.stack = error.stack
      if (error.details) response.error.details = error.details
      if (error.code) response.error.code = error.code
    }

    return response
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private static sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential']
    const sanitized = { ...body }

    const sanitizeRecursive = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeRecursive)
      }
      
      if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]'
          } else {
            result[key] = sanitizeRecursive(value)
          }
        }
        return result
      }
      
      return obj
    }

    return sanitizeRecursive(sanitized)
  }

  /**
   * Create custom error classes
   */
  static createError(message: string, status: number, type?: string, details?: any): ApiError {
    const error: ApiError = new Error(message)
    error.status = status
    error.type = type
    error.details = details
    return error
  }

  /**
   * Unhandled rejection handler
   */
  static setupUnhandledRejectionHandler(): void {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? {
          name: reason.name,
          message: reason.message,
          stack: reason.stack
        } : reason,
        promise: promise.toString()
      })

      // Optionally exit the process
      if (process.env.NODE_ENV === 'production') {
        process.exit(1)
      }
    })
  }

  /**
   * Uncaught exception handler
   */
  static setupUncaughtExceptionHandler(): void {
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })

      // Exit the process
      process.exit(1)
    })
  }
}

export default ErrorTrackingMiddleware
