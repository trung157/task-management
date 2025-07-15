/**
 * Database Test Utilities
 * 
 * Utilities for managing test database connections, transactions, and cleanup.
 * Provides isolation between tests and ensures clean state for each test run.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../../utils/logger';

export interface DatabaseTestConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
}

export interface TransactionContext {
  client: PoolClient;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

export class DatabaseTestManager {
  private pool: Pool | null = null;
  private activeTransactions: Map<string, PoolClient> = new Map();

  constructor(private config: DatabaseTestConfig) {}

  /**
   * Initialize the test database pool
   */
  async initialize(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.maxConnections || 10,
      idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Test database connection established');
    } catch (error) {
      logger.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  /**
   * Get a database client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getClient();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Start a transaction for isolated testing
   */
  async beginTransaction(transactionId: string): Promise<TransactionContext> {
    const client = await this.getClient();
    await client.query('BEGIN');
    
    this.activeTransactions.set(transactionId, client);

    return {
      client,
      rollback: async () => {
        await client.query('ROLLBACK');
        client.release();
        this.activeTransactions.delete(transactionId);
      },
      commit: async () => {
        await client.query('COMMIT');
        client.release();
        this.activeTransactions.delete(transactionId);
      }
    };
  }

  /**
   * Execute queries within a transaction
   */
  async withTransaction<T>(
    transactionId: string,
    operations: (context: TransactionContext) => Promise<T>
  ): Promise<T> {
    const context = await this.beginTransaction(transactionId);
    try {
      const result = await operations(context);
      await context.commit();
      return result;
    } catch (error) {
      await context.rollback();
      throw error;
    }
  }

  /**
   * Clean up test data by table patterns
   */
  async cleanupTestData(patterns: string[] = ['test_%', '%_test']): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      for (const pattern of patterns) {
        // Clean up tables in dependency order
        const cleanupQueries = [
          `DELETE FROM tasks WHERE user_id LIKE '${pattern}' OR id LIKE '${pattern}'`,
          `DELETE FROM notifications WHERE user_id LIKE '${pattern}' OR id LIKE '${pattern}'`,
          `DELETE FROM categories WHERE user_id LIKE '${pattern}' OR id LIKE '${pattern}'`,
          `DELETE FROM refresh_tokens WHERE user_id LIKE '${pattern}' OR token LIKE '${pattern}'`,
          `DELETE FROM users WHERE id LIKE '${pattern}' OR email LIKE '${pattern}@%'`,
        ];

        for (const query of cleanupQueries) {
          await client.query(query);
        }
      }

      await client.query('COMMIT');
      logger.info('Test data cleanup completed');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Test data cleanup failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reset auto-increment sequences
   */
  async resetSequences(tables: string[] = ['users', 'tasks', 'categories', 'notifications']): Promise<void> {
    const client = await this.getClient();
    try {
      for (const table of tables) {
        // Reset sequence if it exists and is auto-increment
        await client.query(`
          DO $$ 
          BEGIN 
            IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = '${table}_id_seq') THEN
              PERFORM setval('${table}_id_seq', 1, false);
            END IF;
          END $$;
        `);
      }
      logger.info('Database sequences reset');        } catch (error: any) {
          logger.warn('Sequence reset failed (this may be normal):', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Truncate all tables (use with caution)
   */
  async truncateAllTables(): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Get all table names
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename != 'schema_migrations'
      `);

      const tables = tablesResult.rows.map(row => row.tablename);
      
      if (tables.length > 0) {
        // Disable foreign key checks temporarily
        await client.query('SET session_replication_role = replica');
        
        // Truncate all tables
        await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
        
        // Re-enable foreign key checks
        await client.query('SET session_replication_role = DEFAULT');
      }

      await client.query('COMMIT');
      logger.info('All tables truncated');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Table truncation failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const client = await this.getClient();
    try {
      const stats: Record<string, number> = {};
      
      const tables = ['users', 'tasks', 'categories', 'notifications', 'refresh_tokens'];
      
      for (const table of tables) {
        try {
          const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          stats[table] = parseInt(result.rows[0].count, 10);
        } catch (error) {
          stats[table] = 0; // Table might not exist
        }
      }

      return stats;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      const client = await this.getClient();
      try {
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        return {
          healthy: true,
          message: 'Database connection healthy',
          details: {
            currentTime: result.rows[0].current_time,
            version: result.rows[0].version,
            poolSize: this.pool?.totalCount || 0,
            activeConnections: this.activeTransactions.size
          }
        };
      } finally {
        client.release();
      }
    } catch (error: any) {
      return {
        healthy: false,
        message: 'Database connection failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    // Rollback any active transactions
    for (const [transactionId, client] of this.activeTransactions) {
      try {
        await client.query('ROLLBACK');
        client.release();
      } catch (error) {
        logger.warn(`Failed to rollback transaction ${transactionId}:`, error);
      }
    }
    this.activeTransactions.clear();

    // Close the pool
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Test database pool closed');
    }
  }

  /**
   * Wait for all active queries to complete
   */
  async waitForQueries(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.pool) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for queries to complete'));
      }, timeoutMs);

      const checkInterval = setInterval(() => {
        if (this.pool!.idleCount === this.pool!.totalCount) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }
}

// Singleton instance for tests
let testDbManager: DatabaseTestManager | null = null;

/**
 * Get the test database manager instance
 */
export function getTestDatabase(): DatabaseTestManager {
  if (!testDbManager) {
    const config: DatabaseTestConfig = {
      host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'task_management_test_db',
      user: process.env.TEST_DB_USER || process.env.DB_USER || 'postgres',
      password: process.env.TEST_DB_PASS || process.env.DB_PASS || 'postgres',
      maxConnections: 5,
      idleTimeoutMillis: 10000,
    };

    testDbManager = new DatabaseTestManager(config);
  }

  return testDbManager;
}

/**
 * Initialize test database for Jest
 */
export async function setupTestDatabase(): Promise<void> {
  const db = getTestDatabase();
  await db.initialize();
}

/**
 * Cleanup test database for Jest
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testDbManager) {
    await testDbManager.close();
    testDbManager = null;
  }
}

/**
 * Create a test database transaction for test isolation
 */
export async function createTestTransaction(testName: string): Promise<TransactionContext> {
  const db = getTestDatabase();
  return await db.beginTransaction(`test_${testName}_${Date.now()}`);
}

/**
 * Database query helper with automatic error handling
 */
export async function executeTestQuery<T extends QueryResultRow = any>(
  query: string, 
  params?: any[]
): Promise<QueryResult<T>> {
  const db = getTestDatabase();
  try {
    return await db.query<T>(query, params);
  } catch (error) {
    logger.error('Test query failed:', { query, params, error });
    throw error;
  }
}
