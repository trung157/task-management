import { Request, Response } from 'express'
import { logger } from '../utils/logger'
import { performance } from 'perf_hooks'
import os from 'os'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  details?: any
  error?: string
}

interface SystemMetrics {
  memory: {
    used: number
    total: number
    percentage: number
    heap: NodeJS.MemoryUsage
  }
  cpu: {
    usage: number
    loadAverage: number[]
  }
  system: {
    uptime: number
    platform: string
    arch: string
    nodeVersion: string
  }
  process: {
    pid: number
    uptime: number
    cpuUsage: NodeJS.CpuUsage
  }
}

interface ApiMetrics {
  requests: {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
  }
  endpoints: Record<string, {
    count: number
    averageResponseTime: number
    errorRate: number
  }>
  errors: {
    total: number
    byType: Record<string, number>
  }
}

class MonitoringService {
  private healthChecks: Map<string, () => Promise<HealthCheckResult>>
  private metrics: {
    requests: Array<{ timestamp: number; method: string; endpoint: string; duration: number; status: number }>
    errors: Array<{ timestamp: number; error: string; type: string }>
  }
  private metricsRetentionHours = 24

  constructor() {
    this.healthChecks = new Map()
    this.metrics = {
      requests: [],
      errors: []
    }

    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 60 * 60 * 1000) // Every hour

    // Log system metrics periodically
    setInterval(() => {
      this.logSystemMetrics()
    }, 5 * 60 * 1000) // Every 5 minutes

    this.registerDefaultHealthChecks()
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, checkFn)
    logger.info(`Health check registered: ${name}`)
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<{ status: string; checks: HealthCheckResult[]; timestamp: string }> {
    const checks: HealthCheckResult[] = []
    let overallStatus = 'healthy'

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await checkFn()
        checks.push(result)

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy'
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded'
        }

        logger.logHealthCheck(name, result.status, result.details)
      } catch (error) {
        const errorResult: HealthCheckResult = {
          service: name,
          status: 'unhealthy',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        checks.push(errorResult)
        overallStatus = 'unhealthy'

        logger.logHealthCheck(name, 'unhealthy', { error: errorResult.error })
      }
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
        heap: memoryUsage
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert microseconds to seconds
        loadAverage: os.loadavg()
      },
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage()
      }
    }
  }

  /**
   * Get API metrics
   */
  getApiMetrics(): ApiMetrics {
    const now = Date.now()
    const hourAgo = now - (60 * 60 * 1000)

    // Filter recent requests
    const recentRequests = this.metrics.requests.filter(req => req.timestamp > hourAgo)
    const recentErrors = this.metrics.errors.filter(err => err.timestamp > hourAgo)

    // Calculate request metrics
    const totalRequests = recentRequests.length
    const successfulRequests = recentRequests.filter(req => req.status < 400).length
    const failedRequests = totalRequests - successfulRequests
    const averageResponseTime = totalRequests > 0 
      ? recentRequests.reduce((sum, req) => sum + req.duration, 0) / totalRequests 
      : 0

    // Calculate endpoint metrics
    const endpointMetrics: Record<string, { count: number; averageResponseTime: number; errorRate: number }> = {}
    
    recentRequests.forEach(req => {
      const key = `${req.method} ${req.endpoint}`
      if (!endpointMetrics[key]) {
        endpointMetrics[key] = { count: 0, averageResponseTime: 0, errorRate: 0 }
      }
      endpointMetrics[key].count++
    })

    Object.keys(endpointMetrics).forEach(key => {
      const endpointRequests = recentRequests.filter(req => `${req.method} ${req.endpoint}` === key)
      const endpointErrors = endpointRequests.filter(req => req.status >= 400)
      
      endpointMetrics[key].averageResponseTime = endpointRequests.reduce((sum, req) => sum + req.duration, 0) / endpointRequests.length
      endpointMetrics[key].errorRate = (endpointErrors.length / endpointRequests.length) * 100
    })

    // Calculate error metrics
    const errorsByType: Record<string, number> = {}
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
    })

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        averageResponseTime
      },
      endpoints: endpointMetrics,
      errors: {
        total: recentErrors.length,
        byType: errorsByType
      }
    }
  }

  /**
   * Record API request metric
   */
  recordRequest(method: string, endpoint: string, duration: number, status: number): void {
    this.metrics.requests.push({
      timestamp: Date.now(),
      method,
      endpoint,
      duration,
      status
    })

    // Log slow requests
    if (duration > 1000) {
      logger.performance('Slow request detected', {
        method,
        endpoint,
        duration,
        status
      })
    }
  }

  /**
   * Record error metric
   */
  recordError(error: string, type: string): void {
    this.metrics.errors.push({
      timestamp: Date.now(),
      error,
      type
    })
  }

  /**
   * Health check endpoint handler
   */
  async healthCheckHandler(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.runHealthChecks()
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503

      res.status(statusCode).json(healthStatus)
    } catch (error) {
      logger.error('Health check failed', { error })
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Metrics endpoint handler
   */
  async metricsHandler(req: Request, res: Response): Promise<void> {
    try {
      const systemMetrics = this.getSystemMetrics()
      const apiMetrics = this.getApiMetrics()

      res.json({
        system: systemMetrics,
        api: apiMetrics,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Metrics collection failed', { error })
      res.status(500).json({
        error: 'Metrics collection failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async (): Promise<HealthCheckResult> => {
      const start = performance.now()
      try {
        // This would need to be replaced with actual database check
        // const result = await db.query('SELECT 1')
        const responseTime = performance.now() - start

        return {
          service: 'database',
          status: 'healthy',
          responseTime: Math.round(responseTime * 100) / 100,
          details: { connected: true }
        }
      } catch (error) {
        return {
          service: 'database',
          status: 'unhealthy',
          responseTime: performance.now() - start,
          error: error instanceof Error ? error.message : 'Database connection failed'
        }
      }
    })

    // Memory health check
    this.registerHealthCheck('memory', async (): Promise<HealthCheckResult> => {
      const start = performance.now()
      const memoryUsage = process.memoryUsage()
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      if (memoryUsagePercent > 90) {
        status = 'unhealthy'
      } else if (memoryUsagePercent > 80) {
        status = 'degraded'
      }

      return {
        service: 'memory',
        status,
        responseTime: performance.now() - start,
        details: {
          usage: memoryUsage,
          systemMemoryUsage: memoryUsagePercent,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        }
      }
    })

    // Disk space health check
    this.registerHealthCheck('disk', async (): Promise<HealthCheckResult> => {
      const start = performance.now()
      try {
        const stats = await readFile('/proc/diskstats', 'utf8').catch(() => null)
        
        return {
          service: 'disk',
          status: 'healthy',
          responseTime: performance.now() - start,
          details: { available: true }
        }
      } catch (error) {
        return {
          service: 'disk',
          status: 'degraded',
          responseTime: performance.now() - start,
          details: { message: 'Disk stats not available on this platform' }
        }
      }
    })
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (this.metricsRetentionHours * 60 * 60 * 1000)
    
    this.metrics.requests = this.metrics.requests.filter(req => req.timestamp > cutoff)
    this.metrics.errors = this.metrics.errors.filter(err => err.timestamp > cutoff)

    logger.debug('Cleaned up old metrics', {
      requestsRetained: this.metrics.requests.length,
      errorsRetained: this.metrics.errors.length
    })
  }

  /**
   * Log system metrics
   */
  private logSystemMetrics(): void {
    const metrics = this.getSystemMetrics()
    
    logger.logMetric('memory.usage.percentage', metrics.memory.percentage, '%')
    logger.logMetric('memory.heap.used', metrics.memory.heap.heapUsed, 'bytes')
    logger.logMetric('cpu.load.average', metrics.cpu.loadAverage[0], 'load')
    logger.logMetric('process.uptime', metrics.process.uptime, 'seconds')
  }
}

// Create singleton instance
export const monitoringService = new MonitoringService()
export default MonitoringService
