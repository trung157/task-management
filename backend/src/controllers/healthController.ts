import { Request, Response } from 'express'
import { monitoringService } from '../services/monitoringService'
import { logger } from '../utils/logger'
import PerformanceMonitoringMiddleware from '../middleware/performanceMonitoring'
import { performance } from 'perf_hooks'
import os from 'os'
import config from '../config/config'
import pool from '../db'
import { HealthCheck, ServiceHealth } from '../types/health'

class HealthController {
  /**
   * Basic health check endpoint
   */
  static async health(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await monitoringService.runHealthChecks()
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503

      res.status(statusCode).json({
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      })
    } catch (error) {
      logger.error('Health check failed', { error, requestId: req.requestId })
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Detailed health check with all service statuses
   */
  static async healthDetailed(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await monitoringService.runHealthChecks()
      const systemMetrics = monitoringService.getSystemMetrics()
      const performanceSummary = PerformanceMonitoringMiddleware.getPerformanceSummary()

      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503

      res.status(statusCode).json({
        status: healthStatus.status,
        checks: healthStatus.checks,
        system: {
          uptime: process.uptime(),
          memory: systemMetrics.memory,
          cpu: systemMetrics.cpu,
          platform: systemMetrics.system.platform,
          nodeVersion: systemMetrics.system.nodeVersion
        },
        performance: performanceSummary,
        timestamp: healthStatus.timestamp,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      })
    } catch (error) {
      logger.error('Detailed health check failed', { error, requestId: req.requestId })
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Liveness probe for Kubernetes
   */
  static async liveness(req: Request, res: Response): Promise<void> {
    // Simple check that the application is running
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }

  /**
   * Readiness probe for Kubernetes
   */
  static async readiness(req: Request, res: Response): Promise<void> {
    try {
      // Check if all critical services are ready
      const healthStatus = await monitoringService.runHealthChecks()
      
      // Consider the service ready if it's healthy or degraded (but not unhealthy)
      const isReady = healthStatus.status !== 'unhealthy'
      
      if (isReady) {
        res.status(200).json({
          status: 'ready',
          checks: healthStatus.checks.filter(check => check.service === 'database'),
          timestamp: new Date().toISOString()
        })
      } else {
        res.status(503).json({
          status: 'not_ready',
          checks: healthStatus.checks,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      logger.error('Readiness check failed', { error, requestId: req.requestId })
      res.status(503).json({
        status: 'not_ready',
        error: 'Readiness check execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Startup probe for Kubernetes
   */
  static async startup(req: Request, res: Response): Promise<void> {
    try {
      // Check if the application has finished starting up
      const uptime = process.uptime()
      const minimumUptimeSeconds = 10 // Minimum uptime before considering started
      
      if (uptime < minimumUptimeSeconds) {
        res.status(503).json({
          status: 'starting',
          uptime,
          message: `Application still starting up (${uptime}s < ${minimumUptimeSeconds}s)`,
          timestamp: new Date().toISOString()
        })
        return
      }

      // Run basic health checks to ensure the app is functional
      const healthStatus = await monitoringService.runHealthChecks()
      
      if (healthStatus.status !== 'unhealthy') {
        res.status(200).json({
          status: 'started',
          uptime,
          timestamp: new Date().toISOString()
        })
      } else {
        res.status(503).json({
          status: 'startup_failed',
          checks: healthStatus.checks,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      logger.error('Startup check failed', { error, requestId: req.requestId })
      res.status(503).json({
        status: 'startup_failed',
        error: 'Startup check execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * System metrics endpoint
   */
  static async metrics(req: Request, res: Response): Promise<void> {
    try {
      const systemMetrics = monitoringService.getSystemMetrics()
      const apiMetrics = monitoringService.getApiMetrics()
      const performanceSummary = PerformanceMonitoringMiddleware.getPerformanceSummary()

      res.json({
        system: systemMetrics,
        api: apiMetrics,
        performance: performanceSummary,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Metrics collection failed', { error, requestId: req.requestId })
      res.status(500).json({
        error: 'Metrics collection failed',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Prometheus-style metrics endpoint
   */
  static async prometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const systemMetrics = monitoringService.getSystemMetrics()
      const apiMetrics = monitoringService.getApiMetrics()
      
      // Generate Prometheus format metrics
      const prometheusMetrics = [
        // System metrics
        `# HELP nodejs_memory_heap_used_bytes Process heap memory used`,
        `# TYPE nodejs_memory_heap_used_bytes gauge`,
        `nodejs_memory_heap_used_bytes ${systemMetrics.memory.heap.heapUsed}`,
        
        `# HELP nodejs_memory_heap_total_bytes Process heap memory total`,
        `# TYPE nodejs_memory_heap_total_bytes gauge`,
        `nodejs_memory_heap_total_bytes ${systemMetrics.memory.heap.heapTotal}`,
        
        `# HELP nodejs_memory_external_bytes Process external memory`,
        `# TYPE nodejs_memory_external_bytes gauge`,
        `nodejs_memory_external_bytes ${systemMetrics.memory.heap.external}`,
        
        `# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds`,
        `# TYPE process_cpu_user_seconds_total counter`,
        `process_cpu_user_seconds_total ${systemMetrics.process.cpuUsage.user / 1000000}`,
        
        `# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds`,
        `# TYPE process_cpu_system_seconds_total counter`,
        `process_cpu_system_seconds_total ${systemMetrics.process.cpuUsage.system / 1000000}`,
        
        `# HELP process_uptime_seconds Process uptime in seconds`,
        `# TYPE process_uptime_seconds gauge`,
        `process_uptime_seconds ${systemMetrics.process.uptime}`,
        
        // API metrics
        `# HELP http_requests_total Total number of HTTP requests`,
        `# TYPE http_requests_total counter`,
        `http_requests_total ${apiMetrics.requests.total}`,
        
        `# HELP http_requests_successful_total Total number of successful HTTP requests`,
        `# TYPE http_requests_successful_total counter`,
        `http_requests_successful_total ${apiMetrics.requests.successful}`,
        
        `# HELP http_requests_failed_total Total number of failed HTTP requests`,
        `# TYPE http_requests_failed_total counter`,
        `http_requests_failed_total ${apiMetrics.requests.failed}`,
        
        `# HELP http_request_duration_seconds Average HTTP request duration`,
        `# TYPE http_request_duration_seconds gauge`,
        `http_request_duration_seconds ${apiMetrics.requests.averageResponseTime / 1000}`,
        
        `# HELP http_errors_total Total number of HTTP errors`,
        `# TYPE http_errors_total counter`,
        `http_errors_total ${apiMetrics.errors.total}`
      ]

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      res.send(prometheusMetrics.join('\n') + '\n')
    } catch (error) {
      logger.error('Prometheus metrics collection failed', { error, requestId: req.requestId })
      res.status(500).send('# Error collecting metrics\n')
    }
  }

  /**
   * Performance benchmark endpoint
   */
  static async benchmark(req: Request, res: Response): Promise<void> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage()
      const startCpu = process.cpuUsage()

      // Simulate some work
      const iterations = parseInt(req.query.iterations as string) || 10000
      let sum = 0
      for (let i = 0; i < iterations; i++) {
        sum += Math.random()
      }

      const endTime = performance.now()
      const endMemory = process.memoryUsage()
      const endCpu = process.cpuUsage(startCpu)

      const benchmark = {
        iterations,
        duration: Math.round((endTime - startTime) * 100) / 100,
        result: sum,
        memory: {
          before: startMemory,
          after: endMemory,
          delta: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            rss: endMemory.rss - startMemory.rss
          }
        },
        cpu: {
          user: endCpu.user,
          system: endCpu.system,
          total: endCpu.user + endCpu.system
        },
        timestamp: new Date().toISOString()
      }

      logger.performance('Benchmark completed', {
        ...benchmark,
        requestId: req.requestId
      })

      res.json(benchmark)
    } catch (error) {
      logger.error('Benchmark failed', { error, requestId: req.requestId })
      res.status(500).json({
        error: 'Benchmark execution failed',
        timestamp: new Date().toISOString()
      })
    }
  }
}

export default HealthController

// Legacy exports for compatibility
export const getHealth = HealthController.health
export const getHealthDetailed = HealthController.healthDetailed
export const getLiveness = HealthController.liveness
export const getReadiness = HealthController.readiness
export const getMetrics = HealthController.metrics

/**
 * Detailed health check with more comprehensive service checks
 */
export const getDetailedHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    
    const healthCheck: HealthCheck & { 
      details: any;
      performance: any;
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.env,
      version: process.env.npm_package_version || '1.0.0',
      services: [
        await checkDatabase(),
        await checkRedis(),
        checkMemory()
      ],
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        hostname: require('os').hostname()
      },
      performance: {
        responseTime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    // Add Redis check if configured
    // if (config.redis?.host) {
    //   healthCheck.services.redis = await checkRedis();
    // }

    // Calculate response time
    healthCheck.performance.responseTime = Date.now() - startTime;

    // Check if any service is unhealthy
    const servicesHealthy = healthCheck.services?.every((service: ServiceHealth) => service.status === 'healthy') ?? true;

    if (!servicesHealthy) {
      healthCheck.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed'
    });
  }
};

/**
 * Ready check - indicates if the application is ready to receive traffic
 */
export const getReady = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check critical services that must be available
    const databaseHealth = await checkDatabase();
    
    if (databaseHealth.status === 'unhealthy') {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Ready check failed:', error);
    res.status(503).json({
      status: 'not ready',
      reason: 'Ready check failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Live check - indicates if the application is alive
 */
export const getLive = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ServiceHealth> {
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    const responseTime = Date.now() - startTime;

    return {
      name: 'database',
      status: 'healthy',
      responseTime,
      details: {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].db_version.split(' ')[0],
        poolSize: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

/**
 * Check Redis connectivity (if configured)
 */
async function checkRedis(): Promise<ServiceHealth> {
  try {
    // Note: This would need Redis client implementation
    // For now, return a placeholder
    return {
      name: 'redis',
      status: 'healthy',
      responseTime: 0,
      details: {
        connected: true
      }
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Redis connection failed'
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): ServiceHealth {
  const memoryUsage = process.memoryUsage();
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  // Consider unhealthy if memory usage is above 90%
  const isHealthy = memoryUsagePercent < 90;

  return {
    name: 'memory',
    status: isHealthy ? 'healthy' : 'unhealthy',
    details: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      systemMemoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100
    }
  };
}
