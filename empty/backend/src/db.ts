import { Pool, PoolConfig } from 'pg';
import config from './config/config';
import { logger } from './utils/logger';

// Database configuration
const dbConfig: PoolConfig = {
  // Use DATABASE_URL if provided, otherwise use individual config
  ...(config.database.url 
    ? { connectionString: config.database.url }
    : {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
      }
  ),
  
  // Connection pool settings
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.pool.idleTimeout,
  connectionTimeoutMillis: config.database.pool.connectionTimeout,
  
  // SSL settings
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Connect to database
export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
  } catch (error) {
    logger.error('Error connecting to database:', error);
    throw error;
  }
};

// Test query function
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database test query successful:', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database test query failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database connection pool:', error);
  }
};

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

export default pool;
