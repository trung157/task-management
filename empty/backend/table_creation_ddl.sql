-- =====================================================
-- TaskFlow Database - Complete DDL Statements
-- SQL Data Definition Language for Table Creation
-- Version: 1.1
-- Created: July 11, 2025
-- Database: PostgreSQL 12+
-- =====================================================

-- =====================================================
-- PREREQUISITES AND EXTENSIONS
-- =====================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram matching for full-text search

-- =====================================================
-- CUSTOM DATA TYPES (ENUMS)
-- =====================================================

-- Task priority levels enumeration
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task status enumeration
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enumeration for Role-Based Access Control (RBAC)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User account status enumeration
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Audit action enumeration for logging
DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'view', 'login', 'logout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification type enumeration
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('due_date_reminder', 'task_assigned', 'task_completed', 'system_update');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CORE BUSINESS TABLES
-- =====================================================

-- USERS TABLE (Root entity - no dependencies)
-- Central user management and authentication
CREATE TABLE IF NOT EXISTS users (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    
    -- Profile and preferences
    avatar_url TEXT,
    bio TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(20) DEFAULT '24h',
    language_code VARCHAR(5) DEFAULT 'en',
    
    -- Account management
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'pending_verification',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Security fields
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    
    -- JSON preferences and settings
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "due_date_reminders": true,
        "task_assignments": true
    }',
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Table constraints
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT check_timezone CHECK (timezone IS NOT NULL),
    CONSTRAINT check_names_not_empty CHECK (
        LENGTH(TRIM(first_name)) > 0 AND LENGTH(TRIM(last_name)) > 0
    )
);

-- CATEGORIES TABLE (Depends on: users)
-- Task organization and categorization system
CREATE TABLE IF NOT EXISTS categories (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Category details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Statistics (maintained by triggers)
    task_count INTEGER DEFAULT 0,
    completed_task_count INTEGER DEFAULT 0,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT unique_category_name_per_user UNIQUE (user_id, name),
    CONSTRAINT check_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- TAGS TABLE (Depends on: users)
-- Normalized tag management system
CREATE TABLE IF NOT EXISTS tags (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    
    -- Audit timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_tags_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT unique_tag_name_per_user UNIQUE (user_id, name),
    CONSTRAINT check_tag_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT check_tag_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$')
);

-- TASKS TABLE (Depends on: users, categories)
-- Main task management entity
CREATE TABLE IF NOT EXISTS tasks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    category_id UUID,
    
    -- Core task information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'none',
    status task_status DEFAULT 'pending',
    
    -- Scheduling fields
    due_date TIMESTAMP WITH TIME ZONE,
    reminder_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    
    -- Time tracking
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    
    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    
    -- Organization and metadata
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    -- Search optimization
    search_vector TSVECTOR,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) 
        REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_completed_by FOREIGN KEY (completed_by) 
        REFERENCES users(id),
    
    -- Table constraints
    CONSTRAINT check_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT check_positive_minutes CHECK (
        (estimated_minutes IS NULL OR estimated_minutes > 0) AND
        (actual_minutes IS NULL OR actual_minutes > 0)
    ),
    CONSTRAINT check_due_date_future CHECK (
        due_date IS NULL OR due_date > created_at
    ),
    CONSTRAINT check_completed_status CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed' AND completed_at IS NULL)
    )
);

-- TASK_TAGS TABLE (Depends on: tasks, tags)
-- Many-to-many relationship between tasks and tags
CREATE TABLE IF NOT EXISTS task_tags (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    
    -- Audit timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_tags_tag FOREIGN KEY (tag_id) 
        REFERENCES tags(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT unique_task_tag UNIQUE (task_id, tag_id)
);

-- =====================================================
-- AUTHENTICATION AND SECURITY TABLES
-- =====================================================

-- USER_SESSIONS TABLE (Depends on: users)
-- JWT token and session management
CREATE TABLE IF NOT EXISTS user_sessions (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Session details
    token_hash TEXT NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Session lifecycle
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT check_expires_future CHECK (expires_at > created_at)
);

-- PASSWORD_RESET_TOKENS TABLE (Depends on: users)
-- Password reset token management
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Token details
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT check_not_used_and_expired CHECK (
        used_at IS NULL OR used_at <= expires_at
    )
);

-- EMAIL_VERIFICATION_TOKENS TABLE (Depends on: users)
-- Email verification token management
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Verification details
    email VARCHAR(255) NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- COLLABORATION AND COMMUNICATION TABLES
-- =====================================================

-- TASK_ASSIGNMENTS TABLE (Depends on: tasks, users)
-- Task assignment for team collaboration
CREATE TABLE IF NOT EXISTS task_assignments (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    assigned_to UUID NOT NULL,
    assigned_by UUID NOT NULL,
    
    -- Assignment details
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Foreign key constraints
    CONSTRAINT fk_task_assignments_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignments_assigned_to FOREIGN KEY (assigned_to) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignments_assigned_by FOREIGN KEY (assigned_by) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT unique_task_assignment UNIQUE (task_id, assigned_to)
);

-- TASK_COMMENTS TABLE (Depends on: tasks, users)
-- Task comments and discussion system
CREATE TABLE IF NOT EXISTS task_comments (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Comment details
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_comments_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT check_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- NOTIFICATIONS TABLE (Depends on: users)
-- User notification system
CREATE TABLE IF NOT EXISTS notifications (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Notification details
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    
    -- Notification lifecycle
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- AUDIT AND LOGGING TABLES
-- =====================================================

-- AUDIT_LOGS TABLE (Depends on: users)
-- Comprehensive audit trail for all system actions
CREATE TABLE IF NOT EXISTS audit_logs (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    
    -- Audit details
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action audit_action NOT NULL,
    old_values JSONB,
    new_values JSONB,
    
    -- Context information
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Table constraints
    CONSTRAINT check_valid_action CHECK (action IN ('create', 'update', 'delete', 'view', 'login', 'logout'))
);

-- TASK_HISTORY TABLE (Depends on: tasks, users)
-- Detailed task change history
CREATE TABLE IF NOT EXISTS task_history (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Change details
    action VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_task_history_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_history_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- ANALYTICS AND REPORTING TABLES
-- =====================================================

-- USER_STATISTICS TABLE (Depends on: users)
-- User activity and productivity metrics
CREATE TABLE IF NOT EXISTS user_statistics (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    
    -- Task metrics
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_deleted INTEGER DEFAULT 0,
    
    -- Time metrics
    total_estimated_minutes INTEGER DEFAULT 0,
    total_actual_minutes INTEGER DEFAULT 0,
    
    -- Productivity metrics
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    average_completion_time_minutes INTEGER DEFAULT 0,
    
    -- Engagement metrics
    login_count INTEGER DEFAULT 0,
    session_duration_minutes INTEGER DEFAULT 0,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_user_statistics_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Table constraints
    CONSTRAINT unique_user_date_stats UNIQUE (user_id, date)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- USERS table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- CATEGORIES table indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_default_per_user ON categories(user_id) WHERE is_default = TRUE;

-- TAGS table indexes
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- TASKS table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- TASK_TAGS table indexes
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- USER_SESSIONS table indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);

-- PASSWORD_RESET_TOKENS table indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- EMAIL_VERIFICATION_TOKENS table indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- TASK_ASSIGNMENTS table indexes
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- TASK_COMMENTS table indexes
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_deleted_at ON task_comments(deleted_at) WHERE deleted_at IS NOT NULL;

-- NOTIFICATIONS table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- AUDIT_LOGS table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- TASK_HISTORY table indexes
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_user_id ON task_history(user_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at);

-- USER_STATISTICS table indexes
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_date ON user_statistics(date);

-- =====================================================
-- SUMMARY OF TABLE RELATIONSHIPS
-- =====================================================

/*
TABLE DEPENDENCY ORDER (for creation/deletion):
1. users (no dependencies)
2. categories (depends on: users)
3. tags (depends on: users)
4. tasks (depends on: users, categories)
5. task_tags (depends on: tasks, tags)
6. user_sessions (depends on: users)
7. password_reset_tokens (depends on: users)
8. email_verification_tokens (depends on: users)
9. task_assignments (depends on: tasks, users)
10. task_comments (depends on: tasks, users)
11. notifications (depends on: users)
12. audit_logs (depends on: users)
13. task_history (depends on: tasks, users)
14. user_statistics (depends on: users)

FOREIGN KEY RELATIONSHIPS:
- categories.user_id → users.id (CASCADE)
- tags.user_id → users.id (CASCADE)
- tasks.user_id → users.id (CASCADE)
- tasks.category_id → categories.id (SET NULL)
- tasks.completed_by → users.id
- task_tags.task_id → tasks.id (CASCADE)
- task_tags.tag_id → tags.id (CASCADE)
- user_sessions.user_id → users.id (CASCADE)
- password_reset_tokens.user_id → users.id (CASCADE)
- email_verification_tokens.user_id → users.id (CASCADE)
- task_assignments.task_id → tasks.id (CASCADE)
- task_assignments.assigned_to → users.id (CASCADE)
- task_assignments.assigned_by → users.id (CASCADE)
- task_comments.task_id → tasks.id (CASCADE)
- task_comments.user_id → users.id (CASCADE)
- notifications.user_id → users.id (CASCADE)
- audit_logs.user_id → users.id (SET NULL)
- task_history.task_id → tasks.id (CASCADE)
- task_history.user_id → users.id (CASCADE)
- user_statistics.user_id → users.id (CASCADE)

UNIQUE CONSTRAINTS:
- users.email
- categories (user_id, name)
- tags (user_id, name)
- task_tags (task_id, tag_id)
- task_assignments (task_id, assigned_to)
- user_statistics (user_id, date)
- categories: only one default per user

INDEXES FOR PERFORMANCE:
- Primary keys: All tables have UUID primary keys
- Foreign keys: All foreign key columns indexed
- Search fields: Email, names, status fields indexed
- Full-text search: GIN indexes on search_vector and tags array
- Partial indexes: For soft-deleted records
- Composite indexes: For common query patterns
*/
