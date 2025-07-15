import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import { performance } from 'perf_hooks'

// Extend Express Request interface to include logging context
declare global {
  namespace Express {
    interface Request {
      requestId: string
      startTime: number
    }
  }
}

interface LogContext {
  requestId: string
  method: string
  url: string
  userAgent?: string
  ip: string
  userId?: string
  userEmail?: string
  duration?: number
  statusCode?: number
  error?: any
  responseSize?: number
}

class LoggingMiddleware {
  /**
   * Request ID and timing middleware
   */
  static requestContext(req: Request, res: Response, next: NextFunction): void {
    // Generate unique request ID
    req.requestId = uuidv4()
    req.startTime = performance.now()

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId)

    // Log incoming request
    const logContext: LogContext = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userId: req.user?.id,
      userEmail: req.user?.email
    }

    logger.info('Incoming request', logContext)

    // Override res.end to capture response details
    const originalEnd = res.end
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      const duration = performance.now() - req.startTime

      const responseLogContext: LogContext = {
        ...logContext,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        statusCode: res.statusCode,
        responseSize: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined
      }

      // Log response based on status code
      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', responseLogContext)
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', responseLogContext)
      } else {
        logger.info('Request completed successfully', responseLogContext)
      }

      // Call original end method
      return originalEnd.call(this, chunk, encoding)
    }

    next()
  }

  /**
   * Error logging middleware
   */
  static errorLogger(error: any, req: Request, res: Response, next: NextFunction): void {
    const logContext: LogContext = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userId: req.user?.id,
      userEmail: req.user?.email,
      statusCode: error.status || error.statusCode || 500,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    }

    // Log error with appropriate level
    if (error.status >= 500 || !error.status) {
      logger.error('Request error', logContext)
    } else {
      logger.warn('Request client error', logContext)
    }

    next(error)
  }

  /**
   * Performance monitoring middleware
   */
  static performanceMonitor(req: Request, res: Response, next: NextFunction): void {
    const startTime = process.hrtime.bigint()

    res.on('finish', () => {
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds

      const performanceData = {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }

      // Log slow requests
      if (duration > 1000) { // Slower than 1 second
        logger.warn('Slow request detected', performanceData)
      }

      // Log performance metrics for monitoring
      logger.info('Performance metric', { type: 'performance', ...performanceData })
    })

    next()
  }

  /**
   * Security audit logging middleware
   */
  static securityAudit(req: Request, res: Response, next: NextFunction): void {
    const securityContext = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      userEmail: req.user?.email,
      timestamp: new Date().toISOString()
    }

    // Log authentication attempts
    if (req.originalUrl.includes('/auth/')) {
      logger.info('Authentication attempt', securityContext)
    }

    // Log admin actions
    if (req.user?.role === 'admin') {
      logger.info('Admin action', securityContext)
    }

    // Log sensitive operations
    const sensitiveEndpoints = ['/users', '/admin', '/settings']
    if (sensitiveEndpoints.some(endpoint => req.originalUrl.includes(endpoint))) {
      logger.info('Sensitive operation', securityContext)
    }

    next()
  }

  /**
   * Rate limiting logging middleware
   */
  static rateLimitLogger(req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send

    res.send = function(this: Response, body?: any): Response {
      // Check if this is a rate limit response
      if (res.statusCode === 429) {
        logger.warn('Rate limit exceeded', {
          requestId: req.requestId,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          userId: req.user?.id,
          rateLimitInfo: {
            limit: res.get('X-RateLimit-Limit'),
            remaining: res.get('X-RateLimit-Remaining'),
            reset: res.get('X-RateLimit-Reset')
          }
        })
      }

      return originalSend.call(this, body)
    }

    next()
  }

  /**
   * Database operation logging
   */
  static databaseLogger = {
    logQuery: (query: string, params?: any[], duration?: number) => {
      logger.debug('Database query executed', {
        query: query.replace(/\s+/g, ' ').trim(),
        params,
        duration
      })
    },

    logError: (error: any, query?: string, params?: any[]) => {
      logger.error('Database error', {
        error: {
          name: error.name,
          message: error.message,
          code: error.code
        },
        query: query?.replace(/\s+/g, ' ').trim(),
        params
      })
    },

    logConnection: (event: 'connect' | 'disconnect' | 'error', details?: any) => {
      const logLevel = event === 'error' ? 'error' : 'info'
      logger[logLevel](`Database ${event}`, details)
    }
  }
}

export default LoggingMiddleware
