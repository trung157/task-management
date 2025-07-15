#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * This script runs all database migrations in the correct order
 * and provides logging and error handling.
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database configuration (from environment or defaults)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'task_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Migration files in order
const migrations = [
    '001_create_users_table.sql',
    '002_create_categories_table.sql', 
    '003_create_tasks_table.sql',
    '004_create_refresh_tokens_table.sql',
    '005_create_category_update_triggers.sql',
    '006_comprehensive_users_table_enhanced.sql',
    '007_comprehensive_tasks_table_enhanced.sql'
];

class MigrationRunner {
    constructor() {
        this.pool = new Pool(dbConfig);
        this.migrationsDir = __dirname;
    }

    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT TRUE,
                error_message TEXT,
                execution_time_ms INTEGER
            );
        `;
        
        await this.pool.query(query);
        console.log('✅ Migrations tracking table ready');
    }

    async hasBeenExecuted(filename) {
        const result = await this.pool.query(
            'SELECT success FROM migrations WHERE filename = $1',
            [filename]
        );
        
        if (result.rows.length === 0) {
            return false;
        }
        
        return result.rows[0].success;
    }

    async recordMigration(filename, success, errorMessage = null, executionTime = 0) {
        await this.pool.query(
            `INSERT INTO migrations (filename, success, error_message, execution_time_ms)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (filename) 
             DO UPDATE SET 
                success = $2,
                error_message = $3,
                execution_time_ms = $4,
                executed_at = CURRENT_TIMESTAMP`,
            [filename, success, errorMessage, executionTime]
        );
    }

    async executeMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        
        try {
            // Check if already executed successfully
            if (await this.hasBeenExecuted(filename)) {
                console.log(`⏭️  Skipping ${filename} (already executed)`);
                return true;
            }

            console.log(`🔄 Executing migration: ${filename}`);
            const startTime = Date.now();
            
            // Read migration file
            const migrationSQL = await fs.readFile(filePath, 'utf8');
            
            // Execute migration in a transaction
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(migrationSQL);
                await client.query('COMMIT');
                
                const executionTime = Date.now() - startTime;
                await this.recordMigration(filename, true, null, executionTime);
                
                console.log(`✅ ${filename} completed successfully (${executionTime}ms)`);
                return true;
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            const executionTime = Date.now() - Date.now();
            await this.recordMigration(filename, false, error.message, executionTime);
            
            console.error(`❌ ${filename} failed:`);
            console.error(`   Error: ${error.message}`);
            return false;
        }
    }

    async runAllMigrations() {
        console.log('🚀 Starting database migration process...');
        console.log(`📍 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        console.log('');

        try {
            // Test connection
            await this.pool.query('SELECT NOW()');
            console.log('✅ Database connection successful');

            // Create migrations tracking table
            await this.createMigrationsTable();

            let successCount = 0;
            let skippedCount = 0;
            let failedCount = 0;

            // Execute each migration
            for (const migration of migrations) {
                const migrationPath = path.join(this.migrationsDir, migration);
                
                try {
                    await fs.access(migrationPath);
                } catch (error) {
                    console.log(`⚠️  Migration file not found: ${migration}`);
                    continue;
                }

                const alreadyExecuted = await this.hasBeenExecuted(migration);
                if (alreadyExecuted) {
                    skippedCount++;
                } else {
                    const success = await this.executeMigration(migration);
                    if (success) {
                        successCount++;
                    } else {
                        failedCount++;
                        // Stop on first failure in production
                        if (process.env.NODE_ENV === 'production') {
                            break;
                        }
                    }
                }
            }

            console.log('');
            console.log('📊 Migration Summary:');
            console.log(`   ✅ Successful: ${successCount}`);
            console.log(`   ⏭️  Skipped: ${skippedCount}`);
            console.log(`   ❌ Failed: ${failedCount}`);

            if (failedCount === 0) {
                console.log('');
                console.log('🎉 All migrations completed successfully!');
                await this.showDatabaseStatus();
            } else {
                console.log('');
                console.log('⚠️  Some migrations failed. Check logs above.');
                process.exit(1);
            }

        } catch (error) {
            console.error('💥 Fatal error during migration:');
            console.error(error);
            process.exit(1);
        }
    }

    async showDatabaseStatus() {
        try {
            console.log('📋 Database Status:');
            
            // Show tables
            const tablesResult = await this.pool.query(`
                SELECT 
                    tablename,
                    tableowner,
                    hasindexes,
                    hastriggers
                FROM pg_tables 
                WHERE schemaname = 'public' 
                  AND tablename NOT LIKE 'pg_%'
                ORDER BY tablename
            `);

            console.log('   Tables created:');
            tablesResult.rows.forEach(table => {
                const indicators = [
                    table.hasindexes ? '📇' : '  ',
                    table.hastriggers ? '⚙️' : '  '
                ].join('');
                console.log(`     ${indicators} ${table.tablename}`);
            });

            // Show migration history
            const migrationsResult = await this.pool.query(`
                SELECT filename, executed_at, success, execution_time_ms
                FROM migrations 
                ORDER BY executed_at DESC 
                LIMIT 10
            `);

            if (migrationsResult.rows.length > 0) {
                console.log('   Recent migrations:');
                migrationsResult.rows.forEach(migration => {
                    const status = migration.success ? '✅' : '❌';
                    const time = new Date(migration.executed_at).toLocaleString();
                    console.log(`     ${status} ${migration.filename} (${time})`);
                });
            }

        } catch (error) {
            console.log('⚠️  Could not retrieve database status:', error.message);
        }
    }

    async close() {
        await this.pool.end();
    }
}

// Main execution
async function main() {
    const runner = new MigrationRunner();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Migration interrupted by user');
        await runner.close();
        process.exit(0);
    });

    try {
        await runner.runAllMigrations();
    } finally {
        await runner.close();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MigrationRunner;
