#!/usr/bin/env ts-node

import { connectDatabase, closeDatabase } from '../db';
import { logger } from '../utils/logger';
import pool from '../db';

/**
 * Database migration script
 * Run with: npm run db:migrate
 */

interface Migration {
  id: string;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: '001',
    name: 'add_search_indexes',
    sql: `
      -- Add GIN index for full-text search if not exists
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_search_vector') THEN
          CREATE INDEX idx_tasks_search_vector ON tasks USING gin(search_vector);
        END IF;
      END
      $$;
    `,
  },
  {
    id: '002',
    name: 'add_performance_indexes',
    sql: `
      -- Add performance indexes if not exists
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_user_status_priority') THEN
          CREATE INDEX idx_tasks_user_status_priority ON tasks(user_id, status, priority) WHERE deleted_at IS NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_due_date') THEN
          CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND status != 'completed';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_created_at') THEN
          CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
        END IF;
      END
      $$;
    `,
  },
  {
    id: '003',
    name: 'add_audit_triggers',
    sql: `
      -- Update search vector trigger for tasks
      CREATE OR REPLACE FUNCTION update_task_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := 
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Drop trigger if exists and recreate
      DROP TRIGGER IF EXISTS trigger_update_task_search_vector ON tasks;
      CREATE TRIGGER trigger_update_task_search_vector
        BEFORE INSERT OR UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_task_search_vector();
    `,
  },
];

async function runMigrations() {
  try {
    await connectDatabase();
    logger.info('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT id FROM migrations ORDER BY id'
    );
    const executedIds = new Set(executedMigrations.map(row => row.id));

    // Run pending migrations
    for (const migration of migrations) {
      if (executedIds.has(migration.id)) {
        logger.info(`Migration ${migration.id} (${migration.name}) already executed, skipping...`);
        continue;
      }

      logger.info(`Running migration ${migration.id}: ${migration.name}`);
      
      try {
        await pool.query('BEGIN');
        await pool.query(migration.sql);
        await pool.query(
          'INSERT INTO migrations (id, name) VALUES ($1, $2)',
          [migration.id, migration.name]
        );
        await pool.query('COMMIT');
        
        logger.info(`Migration ${migration.id} completed successfully`);
      } catch (error) {
        await pool.query('ROLLBACK');
        logger.error(`Migration ${migration.id} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
