const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'task_management_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('🔧 Running migration: 008_fix_refresh_token_length...');
    
    const migrationPath = path.join(__dirname, '008_fix_refresh_token_length.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Test token length
    const result = await pool.query('SELECT MAX(LENGTH(token)) as max_length FROM refresh_tokens');
    console.log('📊 Current max token length:', result.rows[0]?.max_length || 0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
