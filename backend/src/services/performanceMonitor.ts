/**
 * Performance Monitoring Service
 * Tracks and analyzes application performance metrics
 */

import { logger } from '../utils/logger';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  success: boolean;
  error?: string;
}

export interface ApiMetrics {
  route: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
}

export interface CacheMetrics {
  operation: 'get' | 'set' | 'del' | 'invalidate';
  key: string;
  hit: boolean;
  duration: number;
  timestamp: Date;
}

export interface PerformanceStats {
  queries: {
    total: number;
    slow: number;
    failed: number;
    averageDuration: number;
    slowestQueries: QueryMetrics[];
  };
  api: {
    total: number;
    averageResponseTime: number;
    errorRate: number;
    slowestEndpoints: ApiMetrics[];
  };
  cache: {
    hitRate: number;
    totalOperations: number;
    averageDuration: number;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private queryMetrics: QueryMetrics[] = [];
  private apiMetrics: ApiMetrics[] = [];
  private cacheMetrics: CacheMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private slowApiThreshold = 2000; // 2 seconds
  private maxMetricsHistory = 10000;

  private constructor() {
    // Start periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Database Query Monitoring
  trackQuery(metrics: Omit<QueryMetrics, 'timestamp'>): void {
    const queryMetrics: QueryMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.queryMetrics.push(queryMetrics);

    // Log slow queries
    if (metrics.duration > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        query: metrics.query.substring(0, 500),
        duration: metrics.duration,
        parameters: metrics.parameters?.slice(0, 10),
        success: metrics.success,
      });
    }

    // Log failed queries
    if (!metrics.success) {
      logger.error('Query failed', {
        query: metrics.query.substring(0, 500),
        duration: metrics.duration,
        error: metrics.error,
        parameters: metrics.parameters?.slice(0, 10),
      });
    }

    this.limitArraySize(this.queryMetrics);
  }

  // API Endpoint Monitoring
  trackApiRequest(metrics: Omit<ApiMetrics, 'timestamp'>): void {
    const apiMetrics: ApiMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.apiMetrics.push(apiMetrics);

    // Log slow API responses
    if (metrics.duration > this.slowApiThreshold) {
      logger.warn('Slow API response', {
        route: metrics.route,
        method: metrics.method,
        duration: metrics.duration,
        statusCode: metrics.statusCode,
        userId: metrics.userId,
      });
    }

    // Log API errors
    if (metrics.statusCode >= 400) {
      logger.error('API error response', {
        route: metrics.route,
        method: metrics.method,
        duration: metrics.duration,
        statusCode: metrics.statusCode,
        userId: metrics.userId,
      });
    }

    this.limitArraySize(this.apiMetrics);
  }

  // Cache Operations Monitoring
  trackCacheOperation(metrics: Omit<CacheMetrics, 'timestamp'>): void {
    const cacheMetrics: CacheMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.cacheMetrics.push(cacheMetrics);
    this.limitArraySize(this.cacheMetrics);
  }

  // Get Performance Statistics
  getStats(timeWindow?: number): PerformanceStats {
    const now = new Date();
    const windowStart = timeWindow 
      ? new Date(now.getTime() - timeWindow) 
      : new Date(0);

    // Filter metrics by time window
    const recentQueries = this.queryMetrics.filter(m => m.timestamp >= windowStart);
    const recentApi = this.apiMetrics.filter(m => m.timestamp >= windowStart);
    const recentCache = this.cacheMetrics.filter(m => m.timestamp >= windowStart);

    // Calculate query statistics
    const slowQueries = recentQueries.filter(q => q.duration > this.slowQueryThreshold);
    const failedQueries = recentQueries.filter(q => !q.success);
    const avgQueryDuration = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
      : 0;

    // Calculate API statistics
    const errorRequests = recentApi.filter(a => a.statusCode >= 400);
    const avgApiDuration = recentApi.length > 0
      ? recentApi.reduce((sum, a) => sum + a.duration, 0) / recentApi.length
      : 0;

    // Calculate cache statistics
    const cacheHits = recentCache.filter(c => c.operation === 'get' && c.hit);
    const cacheGets = recentCache.filter(c => c.operation === 'get');
    const hitRate = cacheGets.length > 0 ? (cacheHits.length / cacheGets.length) * 100 : 0;
    const avgCacheDuration = recentCache.length > 0
      ? recentCache.reduce((sum, c) => sum + c.duration, 0) / recentCache.length
      : 0;

    return {
      queries: {
        total: recentQueries.length,
        slow: slowQueries.length,
        failed: failedQueries.length,
        averageDuration: avgQueryDuration,
        slowestQueries: recentQueries
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10),
      },
      api: {
        total: recentApi.length,
        averageResponseTime: avgApiDuration,
        errorRate: recentApi.length > 0 ? (errorRequests.length / recentApi.length) * 100 : 0,
        slowestEndpoints: recentApi
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10),
      },
      cache: {
        hitRate,
        totalOperations: recentCache.length,
        averageDuration: avgCacheDuration,
      },
    };
  }

  // Get Query Performance by Type
  getQueryPerformanceByType(): Record<string, { count: number; avgDuration: number; errorRate: number }> {
    const queryTypes: Record<string, { durations: number[]; errors: number }> = {};

    this.queryMetrics.forEach(metric => {
      const type = this.getQueryType(metric.query);
      
      if (!queryTypes[type]) {
        queryTypes[type] = { durations: [], errors: 0 };
      }

      queryTypes[type].durations.push(metric.duration);
      if (!metric.success) {
        queryTypes[type].errors++;
      }
    });

    const result: Record<string, { count: number; avgDuration: number; errorRate: number }> = {};

    Object.entries(queryTypes).forEach(([type, data]) => {
      const count = data.durations.length;
      const avgDuration = count > 0 
        ? data.durations.reduce((sum, d) => sum + d, 0) / count 
        : 0;
      const errorRate = count > 0 ? (data.errors / count) * 100 : 0;

      result[type] = { count, avgDuration, errorRate };
    });

    return result;
  }

  // Get API Performance by Route
  getApiPerformanceByRoute(): Record<string, { count: number; avgDuration: number; errorRate: number }> {
    const routes: Record<string, { durations: number[]; errors: number }> = {};

    this.apiMetrics.forEach(metric => {
      const route = `${metric.method} ${metric.route}`;
      
      if (!routes[route]) {
        routes[route] = { durations: [], errors: 0 };
      }

      routes[route].durations.push(metric.duration);
      if (metric.statusCode >= 400) {
        routes[route].errors++;
      }
    });

    const result: Record<string, { count: number; avgDuration: number; errorRate: number }> = {};

    Object.entries(routes).forEach(([route, data]) => {
      const count = data.durations.length;
      const avgDuration = count > 0 
        ? data.durations.reduce((sum, d) => sum + d, 0) / count 
        : 0;
      const errorRate = count > 0 ? (data.errors / count) * 100 : 0;

      result[route] = { count, avgDuration, errorRate };
    });

    return result;
  }

  // Health Check
  getHealthMetrics(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: PerformanceStats;
  } {
    const stats = this.getStats(300000); // Last 5 minutes
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check query performance
    if (stats.queries.averageDuration > this.slowQueryThreshold) {
      issues.push(`Average query duration is ${stats.queries.averageDuration}ms (threshold: ${this.slowQueryThreshold}ms)`);
      status = 'warning';
    }

    if (stats.queries.failed > stats.queries.total * 0.05) { // 5% error rate
      issues.push(`High query error rate: ${((stats.queries.failed / stats.queries.total) * 100).toFixed(2)}%`);
      status = 'critical';
    }

    // Check API performance
    if (stats.api.averageResponseTime > this.slowApiThreshold) {
      issues.push(`Average API response time is ${stats.api.averageResponseTime}ms (threshold: ${this.slowApiThreshold}ms)`);
      status = 'warning';
    }

    if (stats.api.errorRate > 5) { // 5% error rate
      issues.push(`High API error rate: ${stats.api.errorRate.toFixed(2)}%`);
      status = 'critical';
    }

    // Check cache performance
    if (stats.cache.hitRate < 70) { // 70% hit rate threshold
      issues.push(`Low cache hit rate: ${stats.cache.hitRate.toFixed(2)}%`);
      status = status === 'critical' ? 'critical' : 'warning';
    }

    return { status, issues, metrics: stats };
  }

  // Clear old metrics to prevent memory leaks
  private cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 3600000); // Keep last hour

    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp >= cutoff);
    this.apiMetrics = this.apiMetrics.filter(m => m.timestamp >= cutoff);
    this.cacheMetrics = this.cacheMetrics.filter(m => m.timestamp >= cutoff);
  }

  private limitArraySize<T>(array: T[]): void {
    if (array.length > this.maxMetricsHistory) {
      array.splice(0, array.length - this.maxMetricsHistory);
    }
  }

  private getQueryType(query: string): string {
    const normalized = query.trim().toLowerCase();
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    if (normalized.startsWith('with')) return 'CTE';
    return 'OTHER';
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.queryMetrics = [];
    this.apiMetrics = [];
    this.cacheMetrics = [];
  }

  // Export metrics for external analysis
  exportMetrics(): {
    queries: QueryMetrics[];
    api: ApiMetrics[];
    cache: CacheMetrics[];
  } {
    return {
      queries: [...this.queryMetrics],
      api: [...this.apiMetrics],
      cache: [...this.cacheMetrics],
    };
  }
}

// Singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Middleware for automatic API monitoring
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    performanceMonitor.trackApiRequest({
      route: req.route?.path || req.path,
      method: req.method,
      duration,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    });
  });

  next();
};

// Decorator for automatic query monitoring
export function MonitorQuery(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await method.apply(this, args);
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      performanceMonitor.trackQuery({
        query: args[0] || 'Unknown query',
        duration,
        parameters: args.slice(1),
        success,
        error,
      });
    }
  };

  return descriptor;
}
