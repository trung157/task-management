#!/usr/bin/env ts-node

import { connectDatabase, closeDatabase } from '../db';
import { logger } from '../utils/logger';
import pool from '../db';

/**
 * Database validation script - validates that all tables and constraints exist correctly
 * Run with: npm run db:validate
 */

interface TableInfo {
  tableName: string;
  columns: string[];
  indexes: string[];
  constraints: string[];
  triggers: string[];
}

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Get table information from PostgreSQL system catalogs
 */
async function getTableInfo(tableName: string): Promise<TableInfo | null> {
  try {
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);

    if (!tableExists.rows[0].exists) {
      return null;
    }

    // Get columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    const columns = columnsResult.rows.map(row => 
      `${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.column_default ? ` DEFAULT ${row.column_default}` : ''}`
    );

    // Get indexes
    const indexesResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = $1 AND schemaname = 'public'
      ORDER BY indexname
    `, [tableName]);

    const indexes = indexesResult.rows.map(row => row.indexname);

    // Get constraints
    const constraintsResult = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = (
        SELECT oid FROM pg_class 
        WHERE relname = $1 AND relnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = 'public'
        )
      )
      ORDER BY conname
    `, [tableName]);

    const constraints = constraintsResult.rows.map(row => 
      `${row.conname} (${row.contype}): ${row.definition}`
    );

    // Get triggers
    const triggersResult = await pool.query(`
      SELECT tgname, pg_get_triggerdef(oid) as definition
      FROM pg_trigger 
      WHERE tgrelid = (
        SELECT oid FROM pg_class 
        WHERE relname = $1 AND relnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = 'public'
        )
      ) AND NOT tgisinternal
      ORDER BY tgname
    `, [tableName]);

    const triggers = triggersResult.rows.map(row => row.tgname);

    return {
      tableName,
      columns,
      indexes,
      constraints,
      triggers
    };
  } catch (error) {
    logger.error(`Error getting table info for ${tableName}:`, error);
    return null;
  }
}

/**
 * Validate users table
 */
async function validateUsersTable(): Promise<ValidationResult> {
  const tableInfo = await getTableInfo('users');
  
  if (!tableInfo) {
    return { passed: false, message: 'Users table does not exist' };
  }

  const requiredColumns = [
    'id', 'email', 'password_hash', 'first_name', 'last_name', 'display_name',
    'role', 'status', 'email_verified', 'created_at', 'updated_at'
  ];

  const missingColumns = requiredColumns.filter(col => 
    !tableInfo.columns.some(dbCol => dbCol.startsWith(col + ':'))
  );

  if (missingColumns.length > 0) {
    return { 
      passed: false, 
      message: `Users table missing required columns: ${missingColumns.join(', ')}`,
      details: tableInfo
    };
  }

  const requiredIndexes = ['idx_users_email', 'users_pkey'];
  const missingIndexes = requiredIndexes.filter(idx => 
    !tableInfo.indexes.includes(idx)
  );

  if (missingIndexes.length > 0) {
    return { 
      passed: false, 
      message: `Users table missing required indexes: ${missingIndexes.join(', ')}`,
      details: tableInfo
    };
  }

  return { passed: true, message: 'Users table validation passed', details: tableInfo };
}

/**
 * Validate tasks table
 */
async function validateTasksTable(): Promise<ValidationResult> {
  const tableInfo = await getTableInfo('tasks');
  
  if (!tableInfo) {
    return { passed: false, message: 'Tasks table does not exist' };
  }

  const requiredColumns = [
    'id', 'user_id', 'title', 'description', 'priority', 'status',
    'due_date', 'created_at', 'updated_at', 'search_vector'
  ];

  const missingColumns = requiredColumns.filter(col => 
    !tableInfo.columns.some(dbCol => dbCol.startsWith(col + ':'))
  );

  if (missingColumns.length > 0) {
    return { 
      passed: false, 
      message: `Tasks table missing required columns: ${missingColumns.join(', ')}`,
      details: tableInfo
    };
  }

  const requiredIndexes = ['idx_tasks_user_id', 'tasks_pkey'];
  const missingIndexes = requiredIndexes.filter(idx => 
    !tableInfo.indexes.includes(idx)
  );

  if (missingIndexes.length > 0) {
    return { 
      passed: false, 
      message: `Tasks table missing required indexes: ${missingIndexes.join(', ')}`,
      details: tableInfo
    };
  }

  return { passed: true, message: 'Tasks table validation passed', details: tableInfo };
}

/**
 * Validate categories table
 */
async function validateCategoriesTable(): Promise<ValidationResult> {
  const tableInfo = await getTableInfo('categories');
  
  if (!tableInfo) {
    return { passed: false, message: 'Categories table does not exist' };
  }

  const requiredColumns = [
    'id', 'user_id', 'name', 'color', 'created_at', 'updated_at'
  ];

  const missingColumns = requiredColumns.filter(col => 
    !tableInfo.columns.some(dbCol => dbCol.startsWith(col + ':'))
  );

  if (missingColumns.length > 0) {
    return { 
      passed: false, 
      message: `Categories table missing required columns: ${missingColumns.join(', ')}`,
      details: tableInfo
    };
  }

  return { passed: true, message: 'Categories table validation passed', details: tableInfo };
}

/**
 * Validate refresh tokens table
 */
async function validateRefreshTokensTable(): Promise<ValidationResult> {
  const tableInfo = await getTableInfo('refresh_tokens');
  
  if (!tableInfo) {
    return { passed: false, message: 'Refresh tokens table does not exist' };
  }

  const requiredColumns = [
    'id', 'user_id', 'token', 'expires_at', 'created_at'
  ];

  const missingColumns = requiredColumns.filter(col => 
    !tableInfo.columns.some(dbCol => dbCol.startsWith(col + ':'))
  );

  if (missingColumns.length > 0) {
    return { 
      passed: false, 
      message: `Refresh tokens table missing required columns: ${missingColumns.join(', ')}`,
      details: tableInfo
    };
  }

  return { passed: true, message: 'Refresh tokens table validation passed', details: tableInfo };
}

/**
 * Validate ENUM types
 */
async function validateEnumTypes(): Promise<ValidationResult> {
  const requiredEnums = ['user_role', 'user_status', 'task_priority', 'task_status'];
  
  const enumsResult = await pool.query(`
    SELECT typname 
    FROM pg_type 
    WHERE typtype = 'e' AND typname = ANY($1::text[])
  `, [requiredEnums]);

  const existingEnums = enumsResult.rows.map(row => row.typname);
  const missingEnums = requiredEnums.filter(enumType => !existingEnums.includes(enumType));

  if (missingEnums.length > 0) {
    return {
      passed: false,
      message: `Missing required ENUM types: ${missingEnums.join(', ')}`,
      details: { existing: existingEnums, missing: missingEnums }
    };
  }

  return { passed: true, message: 'ENUM types validation passed', details: existingEnums };
}

/**
 * Validate foreign key relationships
 */
async function validateForeignKeys(): Promise<ValidationResult> {
  const expectedForeignKeys = [
    { table: 'tasks', column: 'user_id', references: 'users(id)' },
    { table: 'tasks', column: 'category_id', references: 'categories(id)' },
    { table: 'categories', column: 'user_id', references: 'users(id)' },
    { table: 'refresh_tokens', column: 'user_id', references: 'users(id)' }
  ];

  const foreignKeysResult = await pool.query(`
    SELECT 
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE 
      tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  const existingForeignKeys = foreignKeysResult.rows.map(row => ({
    table: row.table_name,
    column: row.column_name,
    references: `${row.foreign_table_name}(${row.foreign_column_name})`
  }));

  const missingForeignKeys = expectedForeignKeys.filter(expected => 
    !existingForeignKeys.some(existing => 
      existing.table === expected.table && 
      existing.column === expected.column &&
      existing.references === expected.references
    )
  );

  if (missingForeignKeys.length > 0) {
    return {
      passed: false,
      message: `Missing foreign key constraints`,
      details: { expected: expectedForeignKeys, existing: existingForeignKeys, missing: missingForeignKeys }
    };
  }

  return { passed: true, message: 'Foreign keys validation passed', details: existingForeignKeys };
}

/**
 * Validate database extensions
 */
async function validateExtensions(): Promise<ValidationResult> {
  const requiredExtensions = ['uuid-ossp', 'pgcrypto', 'pg_trgm'];
  
  const extensionsResult = await pool.query(`
    SELECT extname 
    FROM pg_extension 
    WHERE extname = ANY($1::text[])
  `, [requiredExtensions]);

  const existingExtensions = extensionsResult.rows.map(row => row.extname);
  const missingExtensions = requiredExtensions.filter(ext => !existingExtensions.includes(ext));

  if (missingExtensions.length > 0) {
    return {
      passed: false,
      message: `Missing required extensions: ${missingExtensions.join(', ')}`,
      details: { existing: existingExtensions, missing: missingExtensions }
    };
  }

  return { passed: true, message: 'Extensions validation passed', details: existingExtensions };
}

/**
 * Test basic CRUD operations
 */
async function testBasicOperations(): Promise<ValidationResult> {
  try {
    // Generate unique email for test
    const testEmail = `test.validation.${Date.now()}@example.com`;
    
    // Clean up any existing test data first
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test.validation.%@example.com']);
    
    // Test user creation
    const userResult = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, 'test_hash', 'Test', 'User')
      RETURNING id
    `, [testEmail]);
    const userId = userResult.rows[0].id;

    // Test category creation
    const categoryResult = await pool.query(`
      INSERT INTO categories (user_id, name, color)
      VALUES ($1, 'Test Category', '#FF0000')
      RETURNING id
    `, [userId]);
    const categoryId = categoryResult.rows[0].id;

    // Test task creation
    await pool.query(`
      INSERT INTO tasks (user_id, category_id, title, description, priority, status)
      VALUES ($1, $2, 'Test Task', 'Test Description', 'high', 'pending')
    `, [userId, categoryId]);

    // Test refresh token creation
    await pool.query(`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '7 days')
    `, [userId, `test_token_${userId}`]);

    // Clean up test data
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);

    return { passed: true, message: 'Basic CRUD operations test passed' };
  } catch (error) {
    logger.error('Basic operations test failed:', error);
    return { 
      passed: false, 
      message: 'Basic CRUD operations test failed',
      details: error
    };
  }
}

/**
 * Main validation function
 */
async function validateDatabase(): Promise<void> {
  try {
    await connectDatabase();
    logger.info('🔍 Starting database validation...\n');

    const validations = [
      { name: 'Extensions', test: validateExtensions },
      { name: 'ENUM Types', test: validateEnumTypes },
      { name: 'Users Table', test: validateUsersTable },
      { name: 'Categories Table', test: validateCategoriesTable },
      { name: 'Tasks Table', test: validateTasksTable },
      { name: 'Refresh Tokens Table', test: validateRefreshTokensTable },
      { name: 'Foreign Keys', test: validateForeignKeys },
      { name: 'Basic Operations', test: testBasicOperations }
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const validation of validations) {
      logger.info(`🔍 Validating ${validation.name}...`);
      
      try {
        const result = await validation.test();
        
        if (result.passed) {
          logger.info(`✅ ${result.message}`);
          passedCount++;
        } else {
          logger.error(`❌ ${result.message}`);
          if (result.details) {
            logger.error('Details:', JSON.stringify(result.details, null, 2));
          }
          failedCount++;
        }
      } catch (error) {
        logger.error(`❌ ${validation.name} validation failed with error:`, error);
        failedCount++;
      }
      
      logger.info(''); // Empty line for readability
    }

    // Summary
    logger.info('📊 Validation Summary:');
    logger.info('=====================');
    logger.info(`✅ Passed: ${passedCount}`);
    logger.info(`❌ Failed: ${failedCount}`);
    logger.info(`📊 Total: ${validations.length}`);

    if (failedCount === 0) {
      logger.info('\n🎉 All validations passed! Database schema is correct.');
    } else {
      logger.error(`\n💥 ${failedCount} validation(s) failed. Please check the errors above.`);
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Database validation failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateDatabase();
}

export { validateDatabase };
