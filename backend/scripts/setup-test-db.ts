#!/usr/bin/env ts-node

/**
 * Test Database Setup Script
 * 
 * Creates and initializes the test database with required schema and tables.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  adminDatabase: string;
}

class TestDatabaseSetup {
  private config: DatabaseConfig;
  private adminPool: Pool | null = null;
  private testPool: Pool | null = null;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'task_management_test_db',
      adminDatabase: 'postgres' // Connect to postgres db for admin operations
    };
  }

  /**
   * Create admin connection pool
   */
  private createAdminPool(): Pool {
    return new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.adminDatabase,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  /**
   * Create test database connection pool
   */
  private createTestPool(): Pool {
    return new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  /**
   * Check if database exists
   */
  async databaseExists(): Promise<boolean> {
    this.adminPool = this.createAdminPool();
    
    try {
      const result = await this.adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.database]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking database existence:', error);
      return false;
    }
  }

  /**
   * Create the test database
   */
  async createDatabase(): Promise<void> {
    if (!this.adminPool) {
      this.adminPool = this.createAdminPool();
    }

    try {
      console.log(`Creating database: ${this.config.database}`);
      await this.adminPool.query(`CREATE DATABASE "${this.config.database}"`);
      console.log('✅ Test database created successfully');
    } catch (error: any) {
      if (error.code === '42P04') {
        console.log('⚠️  Database already exists');
      } else {
        console.error('❌ Error creating database:', error);
        throw error;
      }
    }
  }

  /**
   * Drop the test database
   */
  async dropDatabase(): Promise<void> {
    if (!this.adminPool) {
      this.adminPool = this.createAdminPool();
    }

    try {
      // Terminate all connections to the test database
      await this.adminPool.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
      `, [this.config.database]);

      console.log(`Dropping database: ${this.config.database}`);
      await this.adminPool.query(`DROP DATABASE IF EXISTS "${this.config.database}"`);
      console.log('✅ Test database dropped successfully');
    } catch (error) {
      console.error('❌ Error dropping database:', error);
      throw error;
    }
  }

  /**
   * Run SQL schema file
   */
  async runSchemaFile(filePath: string): Promise<void> {
    if (!this.testPool) {
      this.testPool = this.createTestPool();
    }

    try {
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      console.log(`Running schema file: ${filePath}`);
      
      // Split by semicolon and execute each statement
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          await this.testPool.query(statement);
        }
      }
      
      console.log('✅ Schema file executed successfully');
    } catch (error) {
      console.error('❌ Error running schema file:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    // Always use basic table creation for tests to avoid schema file issues
    console.log('⚠️  Creating basic tables for test database');
    await this.createBasicTables();
  }

  /**
   * Create basic tables if schema file doesn't exist
   */
  async createBasicTables(): Promise<void> {
    if (!this.testPool) {
      this.testPool = this.createTestPool();
    }

    const createTablesSQL = `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200),
        timezone VARCHAR(50) DEFAULT 'UTC',
        date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
        time_format VARCHAR(10) DEFAULT '24h',
        language_code VARCHAR(10) DEFAULT 'en',
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        email_verified BOOLEAN DEFAULT false,
        preferences JSONB DEFAULT '{}',
        notification_settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#007bff',
        icon VARCHAR(50) DEFAULT 'folder',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, name)
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low', 'none')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
        due_date TIMESTAMP WITH TIME ZONE,
        reminder_date TIMESTAMP WITH TIME ZONE,
        start_date TIMESTAMP WITH TIME ZONE,
        estimated_minutes INTEGER,
        actual_minutes INTEGER,
        completed_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID REFERENCES users(id),
        tags JSONB DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      -- Notifications table
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        read BOOLEAN DEFAULT false,
        data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Refresh tokens table
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    `;

    try {
      await this.testPool.query(createTablesSQL);
      console.log('✅ Basic tables created successfully');
    } catch (error) {
      console.error('❌ Error creating basic tables:', error);
      throw error;
    }
  }

  /**
   * Cleanup and close connections
   */
  async cleanup(): Promise<void> {
    if (this.adminPool) {
      await this.adminPool.end();
      this.adminPool = null;
    }
    if (this.testPool) {
      await this.testPool.end();
      this.testPool = null;
    }
  }

  /**
   * Full setup process
   */
  async setup(): Promise<void> {
    try {
      console.log('🚀 Setting up test database...');
      
      const exists = await this.databaseExists();
      
      if (!exists) {
        await this.createDatabase();
      } else {
        console.log('✅ Test database already exists');
      }

      await this.initializeSchema();
      
      console.log('✅ Test database setup completed successfully!');
    } catch (error) {
      console.error('❌ Test database setup failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Full reset process
   */
  async reset(): Promise<void> {
    try {
      console.log('🔄 Resetting test database...');
      
      await this.dropDatabase();
      await this.createDatabase();
      await this.initializeSchema();
      
      console.log('✅ Test database reset completed successfully!');
    } catch (error) {
      console.error('❌ Test database reset failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'setup';
  const dbSetup = new TestDatabaseSetup();

  try {
    switch (command) {
      case 'setup':
        await dbSetup.setup();
        break;
      case 'reset':
        await dbSetup.reset();
        break;
      case 'drop':
        await dbSetup.dropDatabase();
        await dbSetup.cleanup();
        break;
      default:
        console.log('Usage: ts-node setup-test-db.ts [setup|reset|drop]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TestDatabaseSetup };
