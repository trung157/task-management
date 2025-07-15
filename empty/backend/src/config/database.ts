/**
 * Database Configuration Module
 * 
 * Handles PostgreSQL connection configuration and database pool management.
 * Supports both individual database parameters and connection URL.
 * Includes comprehensive error handling, connection pooling, and monitoring.
 */

import { Pool, PoolConfig, Client, ClientConfig, PoolClient } from 'pg';
import config from './config';

// Create a simple logger for this module to avoid circular dependencies
const logger = {
  info: (message: string, meta?: any) => console.log(`[DB-INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[DB-WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[DB-ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => {
    if (config.server.env === 'development') {
      console.debug(`[DB-DEBUG] ${message}`, meta || '');
    }
  },
};

/**
 * Global database pool instance
 */
let globalPool: Pool | null = null;

/**
 * Database connection statistics
 */
interface DatabaseStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  activeConnections: number;
}

/**
 * Database health check result
 */
interface DatabaseHealth {
  connected: boolean;
  responseTime: number;
  poolStats: DatabaseStats;
  lastError?: string;
  version?: string;
}

/**
 * Creates a PostgreSQL connection configuration
 */
export const createDatabaseConfig = (): PoolConfig => {
  const baseConfig: PoolConfig = {
    // Connection pool settings
    min: config.database.pool.min,
    max: config.database.pool.max,
    idleTimeoutMillis: config.database.pool.idleTimeout,
    connectionTimeoutMillis: config.database.pool.connectionTimeout,
    
    // Connection settings
    statement_timeout: 30000, // 30 seconds
    query_timeout: 30000,     // 30 seconds
    application_name: 'taskflow-api',
    
    // Error handling
    allowExitOnIdle: true,
    
    // Logging (only in development)
    ...(config.server.env === 'development' && {
      log: (msg: string) => logger.debug('pg-pool log:', msg),
    }),
  };

  // If DATABASE_URL is provided, use it (common in hosted environments)
  if (config.database.url) {
    return {
      ...baseConfig,
      connectionString: config.database.url,
      ssl: config.database.ssl ? { 
        rejectUnauthorized: false,
        // Additional SSL options for production
        ...(config.server.env === 'production' && {
          ca: process.env.DB_SSL_CA,
          cert: process.env.DB_SSL_CERT,
          key: process.env.DB_SSL_KEY,
        })
      } : false,
    };
  }

  // Use individual connection parameters
  return {
    ...baseConfig,
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { 
      rejectUnauthorized: false,
      // Additional SSL options for production
      ...(config.server.env === 'production' && {
        ca: process.env.DB_SSL_CA,
        cert: process.env.DB_SSL_CERT,
        key: process.env.DB_SSL_KEY,
      })
    } : false,
  };
};

/**
 * Create database connection pool with comprehensive error handling and monitoring
 */
export const createDatabasePool = (): Pool => {
  const poolConfig = createDatabaseConfig();
  
  const pool = new Pool(poolConfig);

  // Connection event handlers
  pool.on('connect', (client: PoolClient) => {
    logger.debug('New database client connected', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
    
    // Set client application name (using direct SQL instead of parameter)
    client.query("SET application_name = 'taskflow-api'").catch(err => {
      logger.warn('Failed to set application name', err);
    });
  });

  pool.on('acquire', (client: PoolClient) => {
    logger.debug('Client acquired from pool', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });

  pool.on('remove', (client: PoolClient) => {
    logger.debug('Database client removed from pool', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });

  pool.on('error', (err: Error, client: PoolClient) => {
    logger.error('Database pool error', { 
      error: err.message, 
      stack: err.stack,
      code: (err as any).code,
      severity: (err as any).severity,
      detail: (err as any).detail,
    });
    
    // Handle specific error types
    if ((err as any).code === 'ECONNREFUSED') {
      logger.error('Database connection refused - check if PostgreSQL is running');
    } else if ((err as any).code === '28P01') {
      logger.error('Database authentication failed - check credentials');
    } else if ((err as any).code === '3D000') {
      logger.error('Database does not exist - check database name');
    }
  });

  // Pool monitoring for development
  if (config.server.env === 'development') {
    const monitorInterval = setInterval(() => {
      if (pool.totalCount > 0) {
        logger.debug('Pool stats', {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        });
      }
    }, 30000); // Log every 30 seconds

    // Store interval ID for cleanup
    (pool as any).__monitorInterval = monitorInterval;
  }

  return pool;
};

/**
 * Get or create global database pool (singleton pattern)
 */
export const getDatabase = (): Pool => {
  if (!globalPool) {
    globalPool = createDatabasePool();
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      await closeDatabase();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await closeDatabase();
      process.exit(0);
    });
  }
  
  return globalPool;
};

/**
 * Close database connection pool
 */
export const closeDatabase = async (): Promise<void> => {
  if (globalPool) {
    try {
      // Clear monitoring interval if exists
      const monitorInterval = (globalPool as any).__monitorInterval;
      if (monitorInterval) {
        clearInterval(monitorInterval);
      }
      
      logger.info('Closing database connection pool...');
      await globalPool.end();
      globalPool = null;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database pool', error);
    }
  }
};

/**
 * Execute a query with automatic connection management
 */
export const query = async (text: string, params?: any[]): Promise<any> => {
  const pool = getDatabase();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Query executed', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      error: (error as Error).message,
      code: (error as any).code,
    });
    throw error;
  }
};

/**
 * Execute a transaction with automatic rollback on error
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getDatabase();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Test database connection with comprehensive health check
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const start = Date.now();
    const result = await query('SELECT NOW() as current_time, version() as version');
    const duration = Date.now() - start;
    
    logger.info('Database connection test successful', {
      responseTime: `${duration}ms`,
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0], // Just PostgreSQL version
    });
    
    return true;
  } catch (error) {
    logger.error('Database connection test failed', {
      error: (error as Error).message,
      code: (error as any).code,
      detail: (error as any).detail,
    });
    return false;
  }
};

/**
 * Get comprehensive database health information
 */
export const getDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const start = Date.now();
  let health: DatabaseHealth = {
    connected: false,
    responseTime: 0,
    poolStats: {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: 0,
      activeConnections: 0,
    },
  };

  try {
    // Test basic connectivity
    const result = await query('SELECT NOW() as current_time, version() as version');
    const responseTime = Date.now() - start;
    
    const pool = globalPool || getDatabase();
    
    health = {
      connected: true,
      responseTime,
      version: result.rows[0].version.split(' ')[0],
      poolStats: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        maxConnections: config.database.pool.max,
        activeConnections: pool.totalCount - pool.idleCount,
      },
    };
    
    // Additional health checks
    await query('SELECT 1'); // Simple query test
    
  } catch (error) {
    health.lastError = (error as Error).message;
    health.responseTime = Date.now() - start;
  }

  return health;
};

/**
 * Get database connection pool statistics
 */
export const getPoolStats = (): DatabaseStats => {
  const pool = globalPool || getDatabase();
  
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: config.database.pool.max,
    activeConnections: pool.totalCount - pool.idleCount,
  };
};

/**
 * Get database connection info (safe for logging)
 */
export const getDatabaseInfo = (): Record<string, any> => {
  if (config.database.url) {
    // Parse URL to extract safe info
    try {
      const url = new URL(config.database.url);
      return {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.slice(1),
        user: url.username,
        ssl: config.database.ssl,
        poolMin: config.database.pool.min,
        poolMax: config.database.pool.max,
        source: 'DATABASE_URL',
      };
    } catch {
      return {
        source: 'DATABASE_URL',
        ssl: config.database.ssl,
        poolMin: config.database.pool.min,
        poolMax: config.database.pool.max,
      };
    }
  }

  return {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    ssl: config.database.ssl,
    poolMin: config.database.pool.min,
    poolMax: config.database.pool.max,
    source: 'individual_params',
  };
};

/**
 * Check if database pool is healthy
 */
export const isDatabaseHealthy = (): boolean => {
  if (!globalPool) return false;
  
  const stats = getPoolStats();
  
  // Check if pool is in a healthy state
  return (
    stats.totalConnections <= stats.maxConnections &&
    stats.waitingClients < stats.maxConnections / 2 &&
    globalPool.ended === false
  );
};

/**
 * Warm up database connection pool
 */
export const warmUpPool = async (): Promise<void> => {
  const pool = getDatabase();
  const minConnections = config.database.pool.min;
  
  logger.info(`Warming up database pool with ${minConnections} connections...`);
  
  const promises = [];
  for (let i = 0; i < minConnections; i++) {
    promises.push(
      pool.connect().then(client => {
        client.release();
      }).catch(error => {
        logger.warn(`Failed to create warm-up connection ${i + 1}`, error);
      })
    );
  }
  
  await Promise.allSettled(promises);
  logger.info('Database pool warm-up completed');
};

/**
 * Execute database migration or setup scripts
 */
export const executeScript = async (script: string): Promise<void> => {
  const statements = script.split(';').filter(stmt => stmt.trim().length > 0);
  
  for (const statement of statements) {
    try {
      await query(statement.trim());
    } catch (error) {
      logger.error('Script execution failed', {
        statement: statement.substring(0, 100),
        error: (error as Error).message,
      });
      throw error;
    }
  }
};

/**
 * Check database server version and compatibility
 */
export const checkDatabaseVersion = async (): Promise<{
  version: string;
  compatible: boolean;
  majorVersion: number;
}> => {
  try {
    const result = await query('SELECT version()');
    const versionString = result.rows[0].version;
    const versionMatch = versionString.match(/PostgreSQL (\d+)\.(\d+)/);
    
    if (!versionMatch) {
      throw new Error('Could not parse PostgreSQL version');
    }
    
    const majorVersion = parseInt(versionMatch[1], 10);
    const minorVersion = parseInt(versionMatch[2], 10);
    
    // Check compatibility (PostgreSQL 12+ recommended)
    const compatible = majorVersion >= 12;
    
    return {
      version: `${majorVersion}.${minorVersion}`,
      compatible,
      majorVersion,
    };
  } catch (error) {
    logger.error('Failed to check database version', error);
    throw error;
  }
};

/**
 * Create a database client for long-running operations
 */
export const createClient = async (): Promise<Client> => {
  const clientConfig: ClientConfig = createDatabaseConfig();
  const client = new Client(clientConfig);
  
  try {
    await client.connect();
    return client;
  } catch (error) {
    logger.error('Failed to create database client', error);
    throw error;
  }
};

/**
 * Log database pool status for monitoring
 */
export const logPoolStatus = (): void => {
  if (globalPool) {
    const stats = getPoolStats();
    logger.info('Database pool status', {
      ...stats,
      healthy: isDatabaseHealthy(),
      ended: globalPool.ended,
    });
  } else {
    logger.warn('Database pool not initialized');
  }
};

// Export the pool instance for advanced usage
export { globalPool as pool };

// Default export with all database functions
export default {
  getDatabase,
  closeDatabase,
  query,
  transaction,
  testDatabaseConnection,
  getDatabaseHealth,
  getPoolStats,
  getDatabaseInfo,
  isDatabaseHealthy,
  warmUpPool,
  executeScript,
  checkDatabaseVersion,
  createClient,
  logPoolStatus,
  createDatabaseConfig,
  createDatabasePool,
};
