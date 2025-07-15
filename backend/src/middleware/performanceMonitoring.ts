import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { monitoringService } from '../services/monitoringService'
import { performance } from 'perf_hooks'

interface PerformanceMetrics {
  requestId: string
  method: string
  url: string
  statusCode: number
  duration: number
  memoryUsage: {
    before: NodeJS.MemoryUsage
    after: NodeJS.MemoryUsage
    delta: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
    }
  }
  cpuUsage: {
    before: NodeJS.CpuUsage
    after: NodeJS.CpuUsage
    delta: {
      user: number
      system: number
    }
  }
  timestamp: string
  userId?: string
}

class PerformanceMonitoringMiddleware {
  private static performanceThresholds = {
    slow: 1000, // 1 second
    verySlow: 5000, // 5 seconds
    memoryLeak: 50 * 1024 * 1024, // 50MB memory increase
    highCpu: 100 * 1000 // 100ms CPU time
  }

  /**
   * Performance monitoring middleware
   */
  static monitor(req: Request, res: Response, next: NextFunction): void {
    const startTime = performance.now()
    const startCpuUsage = process.cpuUsage()
    const startMemoryUsage = process.memoryUsage()

    // Override res.end to capture final metrics
    const originalEnd = res.end
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      const endTime = performance.now()
      const endCpuUsage = process.cpuUsage(startCpuUsage)
      const endMemoryUsage = process.memoryUsage()

      const duration = endTime - startTime
      const memoryDelta = {
        heapUsed: endMemoryUsage.heapUsed - startMemoryUsage.heapUsed,
        heapTotal: endMemoryUsage.heapTotal - startMemoryUsage.heapTotal,
        external: endMemoryUsage.external - startMemoryUsage.external,
        rss: endMemoryUsage.rss - startMemoryUsage.rss
      }

      const cpuDelta = {
        user: endCpuUsage.user,
        system: endCpuUsage.system
      }

      const metrics: PerformanceMetrics = {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100,
        memoryUsage: {
          before: startMemoryUsage,
          after: endMemoryUsage,
          delta: memoryDelta
        },
        cpuUsage: {
          before: startCpuUsage,
          after: endCpuUsage,
          delta: cpuDelta
        },
        timestamp: new Date().toISOString(),
        userId: req.user?.id
      }

      // Record metrics in monitoring service
      monitoringService.recordRequest(req.method, req.originalUrl, duration, res.statusCode)

      // Log performance metrics
      PerformanceMonitoringMiddleware.logPerformanceMetrics(metrics)

      // Check for performance issues
      PerformanceMonitoringMiddleware.checkPerformanceThresholds(metrics)

      return originalEnd.call(this, chunk, encoding)
    }

    next()
  }

  /**
   * Database query performance monitoring
   */
  static monitorDatabaseQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now()
      const startMemory = process.memoryUsage()

      try {
        const result = await queryFn()
        const duration = performance.now() - startTime
        const endMemory = process.memoryUsage()

        const metrics = {
          queryName,
          duration: Math.round(duration * 100) / 100,
          memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
          timestamp: new Date().toISOString()
        }

        logger.database(`Query executed: ${queryName}`, metrics)

        // Log slow queries
        if (duration > 500) { // Slower than 500ms
          logger.warn(`Slow database query: ${queryName}`, metrics)
        }

        // Log memory-intensive queries
        if (metrics.memoryDelta > 10 * 1024 * 1024) { // More than 10MB
          logger.warn(`Memory-intensive query: ${queryName}`, metrics)
        }

        resolve(result)
      } catch (error) {
        const duration = performance.now() - startTime
        logger.error(`Database query failed: ${queryName}`, {
          queryName,
          duration: Math.round(duration * 100) / 100,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error
        })
        reject(error)
      }
    })
  }

  /**
   * API endpoint performance profiler
   */
  static profileEndpoint(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
    const method = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const startTime = performance.now()
      const startMemory = process.memoryUsage()

      try {
        const result = await method.apply(this, args)
        const duration = performance.now() - startTime
        const endMemory = process.memoryUsage()

        logger.performance(`Endpoint profiling: ${propertyName}`, {
          endpoint: propertyName,
          duration: Math.round(duration * 100) / 100,
          memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
          timestamp: new Date().toISOString()
        })

        return result
      } catch (error) {
        const duration = performance.now() - startTime
        logger.error(`Endpoint error: ${propertyName}`, {
          endpoint: propertyName,
          duration: Math.round(duration * 100) / 100,
          error: error instanceof Error ? error.message : error
        })
        throw error
      }
    }
  }

  /**
   * Memory usage monitoring
   */
  static memoryMonitor(req: Request, res: Response, next: NextFunction): void {
    const memoryUsage = process.memoryUsage()
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    // Add memory usage to request context
    req.memoryUsage = memoryUsage

    // Log high memory usage
    if (memoryUsagePercent > 80) {
      logger.warn('High memory usage detected', {
        requestId: req.requestId,
        memoryUsage,
        percentage: memoryUsagePercent,
        url: req.originalUrl
      })
    }

    // Force garbage collection if memory usage is very high (Node.js with --expose-gc flag)
    if (memoryUsagePercent > 90 && global.gc) {
      logger.info('Forcing garbage collection due to high memory usage')
      global.gc()
    }

    next()
  }

  /**
   * Response size monitoring
   */
  static responseSizeMonitor(req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send
    const originalJson = res.json

    res.send = function(this: Response, body?: any): Response {
      const size = Buffer.byteLength(body || '', 'utf8')
      res.setHeader('X-Response-Size', size.toString())

      // Log large responses
      if (size > 1024 * 1024) { // Larger than 1MB
        logger.warn('Large response detected', {
          requestId: req.requestId,
          size,
          url: req.originalUrl,
          method: req.method
        })
      }

      return originalSend.call(this, body)
    }

    res.json = function(this: Response, obj?: any): Response {
      const body = JSON.stringify(obj)
      const size = Buffer.byteLength(body, 'utf8')
      res.setHeader('X-Response-Size', size.toString())

      // Log large JSON responses
      if (size > 1024 * 1024) { // Larger than 1MB
        logger.warn('Large JSON response detected', {
          requestId: req.requestId,
          size,
          url: req.originalUrl,
          method: req.method
        })
      }

      return originalJson.call(this, obj)
    }

    next()
  }

  /**
   * CPU usage monitoring
   */
  static cpuMonitor(): void {
    setInterval(() => {
      const cpuUsage = process.cpuUsage()
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds

      logger.logMetric('cpu.process.usage', cpuPercent, 'seconds')

      // Log high CPU usage
      if (cpuPercent > 5) { // More than 5 seconds of CPU time
        logger.warn('High CPU usage detected', {
          cpuUsage,
          cpuPercent,
          timestamp: new Date().toISOString()
        })
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Log performance metrics
   */
  private static logPerformanceMetrics(metrics: PerformanceMetrics): void {
    logger.performance('Request performance metrics', {
      requestId: metrics.requestId,
      method: metrics.method,
      url: metrics.url,
      duration: metrics.duration,
      statusCode: metrics.statusCode,
      memoryDelta: metrics.memoryUsage.delta.heapUsed,
      cpuTime: metrics.cpuUsage.delta.user + metrics.cpuUsage.delta.system,
      userId: metrics.userId
    })

    // Log as metrics for monitoring systems
    logger.logMetric('request.duration', metrics.duration, 'ms', {
      method: metrics.method,
      endpoint: metrics.url,
      status: metrics.statusCode.toString()
    })

    logger.logMetric('request.memory.delta', metrics.memoryUsage.delta.heapUsed, 'bytes')
    logger.logMetric('request.cpu.time', metrics.cpuUsage.delta.user + metrics.cpuUsage.delta.system, 'microseconds')
  }

  /**
   * Check performance thresholds and alert
   */
  private static checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const { duration, memoryUsage, cpuUsage } = metrics
    const totalCpuTime = cpuUsage.delta.user + cpuUsage.delta.system

    // Check slow requests
    if (duration > this.performanceThresholds.verySlow) {
      logger.error('Very slow request detected', {
        requestId: metrics.requestId,
        url: metrics.url,
        duration,
        threshold: this.performanceThresholds.verySlow
      })
    } else if (duration > this.performanceThresholds.slow) {
      logger.warn('Slow request detected', {
        requestId: metrics.requestId,
        url: metrics.url,
        duration,
        threshold: this.performanceThresholds.slow
      })
    }

    // Check memory leaks
    if (memoryUsage.delta.heapUsed > this.performanceThresholds.memoryLeak) {
      logger.warn('Potential memory leak detected', {
        requestId: metrics.requestId,
        url: metrics.url,
        memoryDelta: memoryUsage.delta.heapUsed,
        threshold: this.performanceThresholds.memoryLeak
      })
    }

    // Check high CPU usage
    if (totalCpuTime > this.performanceThresholds.highCpu) {
      logger.warn('High CPU usage detected', {
        requestId: metrics.requestId,
        url: metrics.url,
        cpuTime: totalCpuTime,
        threshold: this.performanceThresholds.highCpu
      })
    }
  }

  /**
   * Get performance summary
   */
  static getPerformanceSummary(): any {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: cpuUsage.user + cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      memoryUsage?: NodeJS.MemoryUsage
    }
  }
}

export default PerformanceMonitoringMiddleware
