import pool from '../db';
import { logger } from '../utils/logger';

export interface DatabaseHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: {
    connection: boolean;
    query: boolean;
    poolStatus: {
      total: number;
      idle: number;
      waiting: number;
    };
    latency?: number;
    error?: string;
  };
}

/**
 * Comprehensive database health check
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  const startTime = Date.now();
  
  try {
    // Test basic connection
    const client = await pool.connect();
    
    try {
      // Test query execution
      await client.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      const poolStatus = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };
      
      client.release();
      
      // Determine health status
      let status: 'healthy' | 'degraded' = 'healthy';
      
      // Check for degraded performance
      if (latency > 1000 || poolStatus.waiting > 5) {
        status = 'degraded';
      }
      
      return {
        status,
        details: {
          connection: true,
          query: true,
          poolStatus,
          latency,
        },
      };
      
    } catch (queryError) {
      client.release();
      
      return {
        status: 'unhealthy',
        details: {
          connection: true,
          query: false,
          poolStatus: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
          error: queryError instanceof Error ? queryError.message : 'Query failed',
        },
      };
    }
    
  } catch (connectionError) {
    return {
      status: 'unhealthy',
      details: {
        connection: false,
        query: false,
        poolStatus: {
          total: 0,
          idle: 0,
          waiting: 0,
        },
        error: connectionError instanceof Error ? connectionError.message : 'Connection failed',
      },
    };
  }
}

/**
 * Log database health status
 */
export async function logDatabaseHealth(): Promise<void> {
  const health = await checkDatabaseHealth();
  
  if (health.status === 'healthy') {
    logger.info('💚 Database health: HEALTHY', {
      latency: health.details.latency,
      pool: health.details.poolStatus,
    });
  } else if (health.status === 'degraded') {
    logger.warn('💛 Database health: DEGRADED', {
      latency: health.details.latency,
      pool: health.details.poolStatus,
    });
  } else {
    logger.error('❤️ Database health: UNHEALTHY', {
      error: health.details.error,
      connection: health.details.connection,
      query: health.details.query,
    });
  }
}

/**
 * Database metrics for monitoring
 */
export interface DatabaseMetrics {
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
    utilization: number; // percentage
  };
  performance: {
    avgQueryTime?: number;
    slowQueries?: number;
  };
  errors: {
    connectionErrors: number;
    queryErrors: number;
  };
}

const metrics: DatabaseMetrics = {
  connectionPool: { total: 0, idle: 0, waiting: 0, utilization: 0 },
  performance: {},
  errors: { connectionErrors: 0, queryErrors: 0 },
};

/**
 * Get current database metrics
 */
export function getDatabaseMetrics(): DatabaseMetrics {
  const poolStatus = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    utilization: pool.totalCount > 0 ? ((pool.totalCount - pool.idleCount) / pool.totalCount) * 100 : 0,
  };
  
  return {
    ...metrics,
    connectionPool: poolStatus,
  };
}

/**
 * Reset metrics counters
 */
export function resetDatabaseMetrics(): void {
  metrics.errors.connectionErrors = 0;
  metrics.errors.queryErrors = 0;
}

// Track pool errors
pool.on('error', (err) => {
  metrics.errors.connectionErrors++;
  logger.error('Database pool error:', err);
});
