-- Performance Optimization Indexes Migration
-- This migration adds critical indexes for improved query performance

BEGIN;

-- =====================================================
-- TASKS TABLE INDEXES
-- =====================================================

-- Core user-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_user_id_status 
ON tasks(user_id, status) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_user_id_due_date 
ON tasks(user_id, due_date) 
WHERE deleted_at IS NULL AND due_date IS NOT NULL;

-- Category-based filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_category_id 
ON tasks(category_id) 
WHERE deleted_at IS NULL;

-- Priority and status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_priority_status 
ON tasks(priority, status) 
WHERE deleted_at IS NULL;

-- Time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_created_at 
ON tasks(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_updated_at 
ON tasks(updated_at DESC);

-- Completion tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_completed_at 
ON tasks(completed_at DESC) 
WHERE completed_at IS NOT NULL;

-- GIN indexes for JSON fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tags_gin 
ON tasks USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_metadata_gin 
ON tasks USING GIN (metadata);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_user_status_priority 
ON tasks(user_id, status, priority) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_user_category_status 
ON tasks(user_id, category_id, status) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_user_created_desc 
ON tasks(user_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Partial indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_active 
ON tasks(user_id, updated_at DESC) 
WHERE status != 'archived' AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_overdue 
ON tasks(user_id, due_date) 
WHERE status NOT IN ('completed', 'archived') 
  AND due_date < NOW() 
  AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_pending 
ON tasks(user_id, created_at DESC) 
WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_in_progress 
ON tasks(user_id, updated_at DESC) 
WHERE status = 'in_progress' AND deleted_at IS NULL;

-- Search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_title_search 
ON tasks USING GIN (to_tsvector('english', title)) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_description_search 
ON tasks USING GIN (to_tsvector('english', COALESCE(description, ''))) 
WHERE deleted_at IS NULL AND description IS NOT NULL;

-- =====================================================
-- USERS TABLE INDEXES
-- =====================================================

-- Authentication and lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique 
ON users(email) 
WHERE deleted_at IS NULL;

-- User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login 
ON users(last_login_at DESC) 
WHERE last_login_at IS NOT NULL;

-- User status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users(created_at DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- =====================================================
-- CATEGORIES TABLE INDEXES
-- =====================================================

-- User categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_user_id 
ON categories(user_id) 
WHERE deleted_at IS NULL;

-- Hierarchical categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent_id 
ON categories(parent_id) 
WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

-- Category ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_user_sort_order 
ON categories(user_id, sort_order) 
WHERE deleted_at IS NULL;

-- Category search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_name_search 
ON categories USING GIN (to_tsvector('english', name)) 
WHERE deleted_at IS NULL;

-- =====================================================
-- NOTIFICATIONS TABLE INDEXES (if exists)
-- =====================================================

-- User notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id, created_at DESC) 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- Unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, created_at DESC) 
WHERE read_status = false 
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- Notification types
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type 
ON notifications(notification_type, created_at DESC) 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- =====================================================
-- AUDIT/LOG TABLES INDEXES (if exists)
-- =====================================================

-- Audit trail by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs(user_id, created_at DESC) 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');

-- Audit trail by entity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs(entity_type, entity_id, created_at DESC) 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Enable query statistics tracking
-- Note: This requires pg_stat_statements extension
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Set configuration for better performance monitoring
-- Note: These should be set in postgresql.conf for production
-- ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second
-- ALTER SYSTEM SET log_checkpoints = on;
-- ALTER SYSTEM SET log_connections = on;
-- ALTER SYSTEM SET log_disconnections = on;
-- ALTER SYSTEM SET log_lock_waits = on;

-- =====================================================
-- TABLE STATISTICS UPDATE
-- =====================================================

-- Ensure statistics are up to date for the query planner
ANALYZE tasks;
ANALYZE users;
ANALYZE categories;

-- Update table statistics if notifications table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        EXECUTE 'ANALYZE notifications';
    END IF;
END $$;

-- Update table statistics if audit_logs table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        EXECUTE 'ANALYZE audit_logs';
    END IF;
END $$;

-- =====================================================
-- INDEX USAGE MONITORING QUERIES
-- =====================================================

-- These queries can be used to monitor index usage and performance
-- (Include as comments for reference)

/*
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table scan statistics
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables 
WHERE schemaname = 'public';

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check slow queries (requires pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 20;
*/

COMMIT;

-- Note: CONCURRENTLY option requires running outside a transaction
-- If any index creation fails, run the individual CREATE INDEX commands separately
