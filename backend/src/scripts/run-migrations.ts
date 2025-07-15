#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { connectDatabase, closeDatabase } from '../db';
import { logger } from '../utils/logger';
import pool from '../db';

/**
 * Database migration runner - runs all .sql files in the migrations folder
 * Run with: npm run db:migrate:files
 */

interface MigrationFile {
  filename: string;
  order: number;
  fullPath: string;
  content: string;
}

/**
 * Parse migration filename to extract order number
 */
function parseMigrationFilename(filename: string): number | null {
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Load and sort migration files from the migrations directory
 */
function loadMigrationFiles(): MigrationFile[] {
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .map(filename => {
      const order = parseMigrationFilename(filename);
      if (order === null) {
        logger.warn(`Skipping migration file with invalid name format: ${filename}`);
        return null;
      }

      const fullPath = path.join(migrationsDir, filename);
      const content = fs.readFileSync(fullPath, 'utf8');

      return {
        filename,
        order,
        fullPath,
        content
      };
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((a, b) => a.order - b.order);

  return files;
}

/**
 * Create migrations tracking table
 */
async function createMigrationsTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64),
      execution_time_ms INTEGER,
      
      CONSTRAINT check_filename_format CHECK (filename ~ '^\\d{3,}_.*\\.sql$')
    );
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at DESC);
    
    -- Add comment
    COMMENT ON TABLE schema_migrations IS 'Tracks executed database migration files';
  `;

  await pool.query(createTableSQL);
}

/**
 * Generate simple checksum for migration content
 */
function generateChecksum(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if migration has already been executed
 */
async function isMigrationExecuted(filename: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename]
  );
  return result.rows.length > 0;
}

/**
 * Record migration execution
 */
async function recordMigration(filename: string, checksum: string, executionTimeMs: number): Promise<void> {
  await pool.query(
    `INSERT INTO schema_migrations (filename, checksum, execution_time_ms) 
     VALUES ($1, $2, $3)`,
    [filename, checksum, executionTimeMs]
  );
}

/**
 * Execute a single migration
 */
async function executeMigration(migration: MigrationFile): Promise<void> {
  const { filename, content } = migration;
  const checksum = generateChecksum(content);
  
  logger.info(`Executing migration: ${filename}`);
  
  const startTime = Date.now();
  
  try {
    // Begin transaction
    await pool.query('BEGIN');
    
    // Execute migration content
    await pool.query(content);
    
    // Record successful execution
    await recordMigration(filename, checksum, Date.now() - startTime);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    logger.info(`✅ Migration ${filename} completed successfully in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    logger.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  }
}

/**
 * Validate migration consistency
 */
async function validateMigrations(migrations: MigrationFile[]): Promise<void> {
  logger.info('Validating migration consistency...');
  
  const executedMigrations = await pool.query(
    'SELECT filename, checksum FROM schema_migrations ORDER BY filename'
  );
  
  for (const executed of executedMigrations.rows) {
    const migration = migrations.find(m => m.filename === executed.filename);
    
    if (!migration) {
      logger.warn(`⚠️  Previously executed migration not found in files: ${executed.filename}`);
      continue;
    }
    
    const currentChecksum = generateChecksum(migration.content);
    if (currentChecksum !== executed.checksum) {
      logger.warn(`⚠️  Migration ${executed.filename} has been modified since execution`);
      logger.warn(`   Previous checksum: ${executed.checksum}`);
      logger.warn(`   Current checksum: ${currentChecksum}`);
    }
  }
}

/**
 * Get migration status
 */
async function getMigrationStatus(migrations: MigrationFile[]): Promise<void> {
  logger.info('\n📊 Migration Status:');
  logger.info('==================');
  
  for (const migration of migrations) {
    const isExecuted = await isMigrationExecuted(migration.filename);
    const status = isExecuted ? '✅ Executed' : '⏳ Pending';
    logger.info(`${status} - ${migration.filename}`);
  }
  
  const executedCount = await pool.query('SELECT COUNT(*) FROM schema_migrations');
  logger.info(`\nTotal migrations executed: ${executedCount.rows[0].count}`);
  logger.info(`Total migration files: ${migrations.length}`);
}

/**
 * Main migration runner function
 */
async function runMigrations(options: { status?: boolean; validate?: boolean } = {}): Promise<void> {
  let client;
  
  try {
    // Connect to database
    await connectDatabase();
    logger.info('🔌 Connected to database');
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Load migration files
    const migrations = loadMigrationFiles();
    
    if (migrations.length === 0) {
      logger.info('No migration files found');
      return;
    }
    
    logger.info(`Found ${migrations.length} migration files`);
    
    // Show status if requested
    if (options.status) {
      await getMigrationStatus(migrations);
      return;
    }
    
    // Validate migrations if requested
    if (options.validate) {
      await validateMigrations(migrations);
      return;
    }
    
    // Execute pending migrations
    let executedCount = 0;
    
    for (const migration of migrations) {
      const isExecuted = await isMigrationExecuted(migration.filename);
      
      if (isExecuted) {
        logger.info(`⏭️  Skipping already executed migration: ${migration.filename}`);
        continue;
      }
      
      await executeMigration(migration);
      executedCount++;
    }
    
    if (executedCount === 0) {
      logger.info('✅ All migrations are up to date');
    } else {
      logger.info(`✅ Successfully executed ${executedCount} migrations`);
    }
    
    // Show final status
    await getMigrationStatus(migrations);
    
  } catch (error) {
    logger.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    logger.info('🔌 Database connection closed');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    status: args.includes('--status'),
    validate: args.includes('--validate')
  };
  
  if (args.includes('--help')) {
    console.log(`
Usage: npm run db:migrate:files [options]

Options:
  --status     Show migration status without executing
  --validate   Validate migration consistency
  --help       Show this help message

Examples:
  npm run db:migrate:files           # Run pending migrations
  npm run db:migrate:files --status  # Show migration status
  npm run db:migrate:files --validate # Validate migrations
    `);
    process.exit(0);
  }
  
  runMigrations(options);
}

export { runMigrations, loadMigrationFiles, getMigrationStatus };
