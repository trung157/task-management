/**
 * Base Database Repository
 * 
 * Provides a base class for database repositories with connection pooling,
 * error handling, and common database operations.
 */

import { PoolClient } from 'pg';
import { getDatabase, query, transaction } from '../config/database';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: any[];
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Base repository class with common database operations
 */
export class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Execute a query with parameters
   */
  protected async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return query(text, params);
  }

  /**
   * Execute a transaction
   */
  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return transaction(callback);
  }

  /**
   * Get database pool for advanced operations
   */
  protected getPool() {
    return getDatabase();
  }

  /**
   * Find by ID
   */
  async findById<T>(id: string): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all records with optional filtering and pagination
   */
  async findAll<T>(
    filters: Record<string, any> = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        whereConditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      ${whereClause} 
      ORDER BY ${sortBy} ${sortOrder} 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataResult = await this.query<T>(dataQuery, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrevious: offset > 0,
    };
  }

  /**
   * Create a new record
   */
  async create<T>(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;

    const result = await this.query<T>(query, values);
    return result.rows[0];
  }

  /**
   * Update a record by ID
   */
  async updateById<T>(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    if (keys.length === 0) {
      throw new Error('No data provided for update');
    }

    const setClause = keys
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query<T>(query, [id, ...values]);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID (hard delete)
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Soft delete a record by ID (if table has deleted_at column)
   */
  async softDeleteById(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Restore a soft-deleted record
   */
  async restoreById(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE ${this.tableName} SET deleted_at = NULL WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Count records with optional filters
   */
  async count(filters: Record<string, any> = {}): Promise<number> {
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        whereConditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const result = await this.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`,
      params
    );

    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Bulk insert records
   */
  async bulkInsert<T>(records: Partial<T>[]): Promise<T[]> {
    if (records.length === 0) {
      return [];
    }

    const firstRecord = records[0];
    const columns = Object.keys(firstRecord);
    const columnNames = columns.join(', ');

    const valueRows = records.map((record, recordIndex) => {
      const rowValues = columns.map((column, columnIndex) => {
        const paramIndex = recordIndex * columns.length + columnIndex + 1;
        return `$${paramIndex}`;
      });
      return `(${rowValues.join(', ')})`;
    });

    const allValues = records.flatMap(record => 
      columns.map(column => record[column as keyof typeof record])
    );

    const query = `
      INSERT INTO ${this.tableName} (${columnNames}) 
      VALUES ${valueRows.join(', ')} 
      RETURNING *
    `;

    const result = await this.query<T>(query, allValues);
    return result.rows;
  }

  /**
   * Execute raw SQL query
   */
  async rawQuery<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    return this.query<T>(sql, params);
  }

  /**
   * Search records with text search
   */
  async search<T>(
    searchTerm: string,
    searchColumns: string[],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    // Build search conditions using ILIKE for case-insensitive search
    const searchConditions = searchColumns.map((column, index) => 
      `${column} ILIKE $${index + 1}`
    );
    
    const searchValue = `%${searchTerm}%`;
    const searchParams = searchColumns.map(() => searchValue);

    const whereClause = `WHERE (${searchConditions.join(' OR ')})`;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = await this.query(countQuery, searchParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      ${whereClause} 
      ORDER BY ${sortBy} ${sortOrder} 
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;
    
    const dataResult = await this.query<T>(dataQuery, [...searchParams, limit, offset]);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrevious: offset > 0,
    };
  }
}

/**
 * Connection health utilities
 */
export class DatabaseHealth {
  /**
   * Check if database is responsive
   */
  static async isHealthy(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connection pool status
   */
  static getConnectionStats() {
    const pool = getDatabase();
    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      ended: pool.ended,
    };
  }

  /**
   * Test database performance
   */
  static async performanceTest(): Promise<{
    queryTime: number;
    connectionTime: number;
    healthy: boolean;
  }> {
    const start = Date.now();
    
    try {
      const connectionStart = Date.now();
      const pool = getDatabase();
      const client = await pool.connect();
      const connectionTime = Date.now() - connectionStart;

      const queryStart = Date.now();
      await client.query('SELECT NOW(), version()');
      const queryTime = Date.now() - queryStart;

      client.release();

      return {
        queryTime,
        connectionTime,
        healthy: true,
      };
    } catch {
      return {
        queryTime: Date.now() - start,
        connectionTime: Date.now() - start,
        healthy: false,
      };
    }
  }
}

export default BaseRepository;
