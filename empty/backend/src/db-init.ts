import pool from './db';
import config from './config/config';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { PoolClient } from 'pg';

/**
 * Initialize the database with the schema
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('Starting database initialization...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'db_schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf-8');
    
    // Execute the schema
    await client.query(schemaSQL);
    
    console.log('Database schema initialized successfully!');
    
    // Create default admin user if not exists
    await createDefaultAdmin(client);
    
    // Create default categories
    await createDefaultCategories(client);
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create default admin user
 */
async function createDefaultAdmin(client: PoolClient): Promise<void> {
  try {
    const checkAdminQuery = `
      SELECT id FROM users WHERE email = $1 LIMIT 1
    `;
    const existingAdmin = await client.query(checkAdminQuery, ['admin@taskflow.com']);
    
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', config.security.bcryptRounds);
      
      const createAdminQuery = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, status, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      await client.query(createAdminQuery, [
        'admin@taskflow.com',
        hashedPassword,
        'System',
        'Administrator',
        'super_admin',
        'active',
        true
      ]);
      
      console.log('Default admin user created: admin@taskflow.com / admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

/**
 * Create default task categories
 */
async function createDefaultCategories(client: PoolClient): Promise<void> {
  try {
    // Get admin user ID
    const adminQuery = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@taskflow.com']
    );
    
    if (adminQuery.rows.length === 0) return;
    
    const adminId = adminQuery.rows[0].id;
    
    const defaultCategories = [
      { name: 'Work', description: 'Work-related tasks', color: '#3B82F6', icon: 'briefcase' },
      { name: 'Personal', description: 'Personal tasks and activities', color: '#10B981', icon: 'user' },
      { name: 'Shopping', description: 'Shopping lists and errands', color: '#F59E0B', icon: 'shopping-bag' },
      { name: 'Health', description: 'Health and fitness related tasks', color: '#EF4444', icon: 'heart' },
      { name: 'Learning', description: 'Educational and skill development', color: '#8B5CF6', icon: 'book-open' },
      { name: 'Home', description: 'Household chores and maintenance', color: '#06B6D4', icon: 'home' }
    ];
    
    for (const category of defaultCategories) {
      const existingCategory = await client.query(
        'SELECT id FROM categories WHERE name = $1 AND user_id = $2',
        [category.name, adminId]
      );
      
      if (existingCategory.rows.length === 0) {
        await client.query(`
          INSERT INTO categories (name, description, color, icon, user_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [category.name, category.description, category.color, category.icon, adminId]);
      }
    }
    
    console.log('Default categories created successfully');
  } catch (error) {
    console.error('Error creating default categories:', error);
  }
}

/**
 * Drop all tables and recreate schema (DANGER: This will delete all data)
 */
export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('RESETTING DATABASE - ALL DATA WILL BE LOST!');
    
    // Drop all tables in reverse dependency order
    const dropQueries = [
      'DROP TABLE IF EXISTS audit_logs CASCADE',
      'DROP TABLE IF EXISTS notifications CASCADE',
      'DROP TABLE IF EXISTS user_sessions CASCADE',
      'DROP TABLE IF EXISTS task_dependencies CASCADE',
      'DROP TABLE IF EXISTS task_attachments CASCADE',
      'DROP TABLE IF EXISTS task_tags CASCADE',
      'DROP TABLE IF EXISTS tags CASCADE',
      'DROP TABLE IF EXISTS tasks CASCADE',
      'DROP TABLE IF EXISTS categories CASCADE',
      'DROP TABLE IF EXISTS users CASCADE',
      
      // Drop custom types
      'DROP TYPE IF EXISTS notification_type CASCADE',
      'DROP TYPE IF EXISTS audit_action CASCADE',
      'DROP TYPE IF EXISTS user_status CASCADE',
      'DROP TYPE IF EXISTS user_role CASCADE',
      'DROP TYPE IF EXISTS task_status CASCADE',
      'DROP TYPE IF EXISTS task_priority CASCADE'
    ];
    
    for (const query of dropQueries) {
      await client.query(query);
    }
    
    console.log('All tables dropped successfully');
    
    // Reinitialize
    await initializeDatabase();
    
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      initializeDatabase()
        .then(() => {
          console.log('Database initialization completed!');
          process.exit(0);
        })
        .catch((error) => {
          console.error('Database initialization failed:', error);
          process.exit(1);
        });
      break;
      
    case 'reset':
      resetDatabase()
        .then(() => {
          console.log('Database reset completed!');
          process.exit(0);
        })
        .catch((error) => {
          console.error('Database reset failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: npm run db:init | npm run db:reset');
      break;
  }
}
