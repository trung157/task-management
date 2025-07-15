#!/usr/bin/env node

/**
 * Migration Test Script
 * 
 * This script tests the database migration system and validates
 * that all tables, indexes, and constraints were created correctly.
 */

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

class MigrationTester {
    constructor() {
        this.pool = new Pool(dbConfig);
        this.testResults = [];
    }

    async runTest(name, testFn) {
        try {
            console.log(`🧪 Testing: ${name}`);
            await testFn();
            this.testResults.push({ name, status: 'PASS', error: null });
            console.log(`   ✅ PASS`);
        } catch (error) {
            this.testResults.push({ name, status: 'FAIL', error: error.message });
            console.log(`   ❌ FAIL: ${error.message}`);
        }
    }

    async testTableExists(tableName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            );
        `, [tableName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Table '${tableName}' does not exist`);
        }
    }

    async testColumnExists(tableName, columnName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1 
                AND column_name = $2
            );
        `, [tableName, columnName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Column '${columnName}' does not exist in table '${tableName}'`);
        }
    }

    async testIndexExists(indexName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND indexname = $1
            );
        `, [indexName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Index '${indexName}' does not exist`);
        }
    }

    async testEnumExists(enumName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM pg_type 
                WHERE typname = $1 
                AND typtype = 'e'
            );
        `, [enumName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Enum '${enumName}' does not exist`);
        }
    }

    async testTriggerExists(triggerName, tableName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.triggers 
                WHERE trigger_name = $1 
                AND event_object_table = $2
            );
        `, [triggerName, tableName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Trigger '${triggerName}' does not exist on table '${tableName}'`);
        }
    }

    async testForeignKey(tableName, constraintName) {
        const result = await this.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.table_constraints 
                WHERE table_name = $1 
                AND constraint_name = $2 
                AND constraint_type = 'FOREIGN KEY'
            );
        `, [tableName, constraintName]);
        
        if (!result.rows[0].exists) {
            throw new Error(`Foreign key '${constraintName}' does not exist on table '${tableName}'`);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Migration Validation Tests');
        console.log(`📍 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        console.log('');

        try {
            // Test connection
            await this.pool.query('SELECT NOW()');
            console.log('✅ Database connection successful');
            console.log('');

            // Test core tables exist
            await this.runTest('Users table exists', () => this.testTableExists('users'));
            await this.runTest('Categories table exists', () => this.testTableExists('categories'));
            await this.runTest('Tasks table exists', () => this.testTableExists('tasks'));
            await this.runTest('Refresh tokens table exists', () => this.testTableExists('refresh_tokens'));
            await this.runTest('Migrations table exists', () => this.testTableExists('migrations'));

            // Test enhanced table columns
            await this.runTest('Users table has auth_provider', () => this.testColumnExists('users', 'auth_provider'));
            await this.runTest('Users table has user_status', () => this.testColumnExists('users', 'user_status'));
            await this.runTest('Users table has last_login', () => this.testColumnExists('users', 'last_login'));
            
            await this.runTest('Tasks table has task_type', () => this.testColumnExists('tasks', 'task_type'));
            await this.runTest('Tasks table has recurrence_pattern', () => this.testColumnExists('tasks', 'recurrence_pattern'));
            await this.runTest('Tasks table has urgency_score', () => this.testColumnExists('tasks', 'urgency_score'));
            await this.runTest('Tasks table has depends_on', () => this.testColumnExists('tasks', 'depends_on'));
            await this.runTest('Tasks table has collaboration features', () => this.testColumnExists('tasks', 'collaborators'));

            // Test enums
            await this.runTest('user_role enum exists', () => this.testEnumExists('user_role'));
            await this.runTest('user_status enum exists', () => this.testEnumExists('user_status'));
            await this.runTest('auth_provider enum exists', () => this.testEnumExists('auth_provider'));
            await this.runTest('task_priority enum exists', () => this.testEnumExists('task_priority'));
            await this.runTest('task_status enum exists', () => this.testEnumExists('task_status'));
            await this.runTest('task_type enum exists', () => this.testEnumExists('task_type'));
            await this.runTest('recurrence_pattern enum exists', () => this.testEnumExists('recurrence_pattern'));

            // Test important indexes
            await this.runTest('Users email index exists', () => this.testIndexExists('idx_users_email_normalized'));
            await this.runTest('Tasks user_id index exists', () => this.testIndexExists('idx_tasks_user_id'));
            await this.runTest('Tasks search vector index exists', () => this.testIndexExists('idx_tasks_search_vector'));
            await this.runTest('Tasks tags GIN index exists', () => this.testIndexExists('idx_tasks_tags'));
            await this.runTest('Tasks overdue index exists', () => this.testIndexExists('idx_tasks_overdue'));

            // Test triggers
            await this.runTest('Users updated_at trigger exists', () => this.testTriggerExists('trigger_users_updated_at', 'users'));
            await this.runTest('Tasks updated_at trigger exists', () => this.testTriggerExists('trigger_tasks_updated_at', 'tasks'));
            await this.runTest('Tasks search vector trigger exists', () => this.testTriggerExists('trigger_update_task_search_vector', 'tasks'));
            await this.runTest('Tasks urgency calculation trigger exists', () => this.testTriggerExists('trigger_calculate_task_urgency', 'tasks'));

            // Test foreign keys
            await this.runTest('Tasks user_id foreign key exists', () => this.testForeignKey('tasks', 'fk_tasks_user_id'));
            await this.runTest('Tasks category_id foreign key exists', () => this.testForeignKey('tasks', 'fk_tasks_category_id'));

            // Test data integrity
            await this.runTest('Can insert sample user', async () => {
                const userId = await this.pool.query(`
                    INSERT INTO users (email, email_normalized, first_name, last_name, password_hash, auth_provider)
                    VALUES ('test@example.com', 'test@example.com', 'Test', 'User', '$2b$10$test', 'local')
                    ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
                    RETURNING id
                `);
                if (!userId.rows[0].id) {
                    throw new Error('Failed to insert or retrieve user');
                }
            });

            await this.runTest('Can insert sample task', async () => {
                const userResult = await this.pool.query(`SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1`);
                if (userResult.rows.length === 0) {
                    throw new Error('Test user not found');
                }
                
                const taskId = await this.pool.query(`
                    INSERT INTO tasks (user_id, title, description, task_type, priority, status)
                    VALUES ($1, 'Test Task', 'Test Description', 'personal', 'medium', 'pending')
                    RETURNING id
                `, [userResult.rows[0].id]);
                
                if (!taskId.rows[0].id) {
                    throw new Error('Failed to insert task');
                }
            });

            // Test search functionality
            await this.runTest('Full-text search works', async () => {
                const result = await this.pool.query(`
                    SELECT id, title FROM tasks 
                    WHERE search_vector @@ plainto_tsquery('english', 'test')
                    LIMIT 1
                `);
                if (result.rows.length === 0) {
                    throw new Error('Search vector not working properly');
                }
            });

            // Test views
            await this.runTest('Active tasks view exists', async () => {
                const result = await this.pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.views 
                        WHERE table_schema = 'public' 
                        AND table_name = 'active_tasks'
                    );
                `);
                if (!result.rows[0].exists) {
                    throw new Error('active_tasks view does not exist');
                }
            });

            await this.runTest('Task analytics view exists', async () => {
                const result = await this.pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.views 
                        WHERE table_schema = 'public' 
                        AND table_name = 'task_analytics'
                    );
                `);
                if (!result.rows[0].exists) {
                    throw new Error('task_analytics view does not exist');
                }
            });

            // Generate summary
            this.generateSummary();

        } catch (error) {
            console.error('💥 Fatal error during testing:');
            console.error(error);
            process.exit(1);
        }
    }

    generateSummary() {
        console.log('');
        console.log('📊 Test Summary:');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const total = this.testResults.length;
        
        console.log(`   ✅ Passed: ${passed}/${total}`);
        console.log(`   ❌ Failed: ${failed}/${total}`);
        
        if (failed > 0) {
            console.log('');
            console.log('❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
            process.exit(1);
        } else {
            console.log('');
            console.log('🎉 All tests passed! Migration system is working correctly.');
        }
    }

    async close() {
        await this.pool.end();
    }
}

// Main execution
async function main() {
    const tester = new MigrationTester();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Testing interrupted by user');
        await tester.close();
        process.exit(0);
    });

    try {
        await tester.runAllTests();
    } finally {
        await tester.close();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MigrationTester;
