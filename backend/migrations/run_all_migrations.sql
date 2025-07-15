-- =====================================================
-- Migration Runner Script
-- Description: Execute all database migrations in order
-- =====================================================

-- This script runs all migrations in the correct order
-- Run this from psql connected to your database

\echo 'Starting database migration process...'

-- Migration 001: Create users table
\echo 'Running Migration 001: Create users table...'
\i 001_create_users_table.sql

-- Migration 002: Create categories table  
\echo 'Running Migration 002: Create categories table...'
\i 002_create_categories_table.sql

-- Migration 003: Create tasks table (basic)
\echo 'Running Migration 003: Create tasks table (basic)...'
\i 003_create_tasks_table.sql

-- Migration 004: Create refresh tokens table
\echo 'Running Migration 004: Create refresh tokens table...'
\i 004_create_refresh_tokens_table.sql

-- Migration 005: Create category update triggers
\echo 'Running Migration 005: Create category update triggers...'
\i 005_create_category_update_triggers.sql

-- Migration 006: Enhanced users table (comprehensive)
\echo 'Running Migration 006: Enhanced users table (comprehensive)...'
\i 006_comprehensive_users_table_enhanced.sql

-- Migration 007: Enhanced tasks table (comprehensive)
\echo 'Running Migration 007: Enhanced tasks table (comprehensive)...'
\i 007_comprehensive_tasks_table_enhanced.sql

\echo 'All migrations completed successfully!'
\echo 'Database is ready for use.'

-- Show table status
\echo 'Database tables summary:'
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
