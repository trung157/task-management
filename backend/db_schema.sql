-- =====================================================
-- TaskFlow Database Schema - PostgreSQL
-- Version: 1.1
-- Created: July 11, 2025
-- Updated: July 11, 2025
-- Description: Complete database schema for TaskFlow task management system
-- =====================================================

-- Clean up any existing problematic objects
DROP TRIGGER IF EXISTS update_user_search_vector_trigger ON users CASCADE;
DROP FUNCTION IF EXISTS update_user_search_vector() CASCADE;
DROP INDEX IF EXISTS idx_users_search_vector CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- =====================================================
-- ENUMS AND CUSTOM TYPES
-- =====================================================

-- Task priority levels
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task status types
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User roles for RBAC
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User account status
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Audit action types
DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'view', 'login', 'logout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification types
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('due_date_reminder', 'task_assigned', 'task_completed', 'system_update');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table - Central user management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- bcrypt hash
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    
    -- Profile information
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
    
    -- Security
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    
    -- Preferences
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "due_date_reminders": true,
        "task_assignments": true
    }',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT check_timezone CHECK (timezone IS NOT NULL),
    CONSTRAINT check_names_not_empty CHECK (
        LENGTH(TRIM(first_name)) > 0 AND LENGTH(TRIM(last_name)) > 0
    )
);

-- Categories table - Task organization
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color code
    icon VARCHAR(50) DEFAULT 'folder', -- Icon identifier
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Statistics (maintained by triggers)
    task_count INTEGER DEFAULT 0,
    completed_task_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_category_name_per_user UNIQUE (user_id, name),
    CONSTRAINT check_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Tasks table - Main task management
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Core task information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'none',
    status task_status DEFAULT 'pending',
    
    -- Scheduling
    due_date TIMESTAMP WITH TIME ZONE,
    reminder_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    
    -- Time tracking
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    
    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),
    
    -- Organization
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- Flexible storage for additional data
    
    -- Search optimization (updated via trigger)
    search_vector TSVECTOR,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
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

-- =====================================================
-- AUTHENTICATION & SECURITY TABLES
-- =====================================================

-- User sessions for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- Hash of refresh token
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_expires_future CHECK (expires_at > created_at)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_not_used_and_expired CHECK (
        used_at IS NULL OR used_at <= expires_at
    )
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL, -- New email being verified
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT AND LOGGING TABLES
-- =====================================================

-- Comprehensive audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action audit_action NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for efficient querying
    CONSTRAINT check_valid_action CHECK (action IN ('create', 'update', 'delete', 'view', 'login', 'logout'))
);

-- Task history for detailed change tracking
CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- COLLABORATION TABLES
-- =====================================================

-- Task assignments (for future team features)
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    CONSTRAINT unique_task_assignment UNIQUE (task_id, assigned_to)
);

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- For internal notes vs public comments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT check_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- =====================================================
-- TAG SYSTEM
-- =====================================================

-- Tags table for normalized tag management
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tag_name_per_user UNIQUE (user_id, name),
    CONSTRAINT check_tag_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT check_tag_color_format CHECK (color ~* '^#[0-9A-Fa-f]{6}$')
);

-- Task-Tag many-to-many relationship
CREATE TABLE IF NOT EXISTS task_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_task_tag UNIQUE (task_id, tag_id)
);

-- =====================================================
-- NOTIFICATION SYSTEM
-- =====================================================

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional notification data
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ANALYTICS AND REPORTING
-- =====================================================

-- User activity statistics
CREATE TABLE IF NOT EXISTS user_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_date_stats UNIQUE (user_id, date)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NOT NULL;
-- Ensure only one default category per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_default_per_user ON categories(user_id) WHERE is_default = TRUE;

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date) WHERE deleted_at IS NULL;
-- Note: Overdue tasks index removed due to CURRENT_TIMESTAMP not being immutable

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Task history indexes
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at);

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Statistics indexes
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_date ON user_statistics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_statistics_date ON user_statistics(date);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update search vector for tasks
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
DECLARE
    tag_names TEXT := '';
BEGIN
    -- Safely get tag names from normalized tag tables
    BEGIN
        SELECT COALESCE(string_agg(tags.name, ' '), '') INTO tag_names
        FROM task_tags 
        JOIN tags ON task_tags.tag_id = tags.id 
        WHERE task_tags.task_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
        tag_names := '';
    END;
    
    -- Build search vector with error handling
    BEGIN
        NEW.search_vector = 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
            setweight(to_tsvector('english', tag_names), 'C');
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to basic search vector if there's an error
        NEW.search_vector = 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync tags array with normalized tag tables
CREATE OR REPLACE FUNCTION sync_task_tags_array()
RETURNS TRIGGER AS $$
DECLARE
    tag_names TEXT[];
    target_task_id UUID;
BEGIN
    -- Get the task ID based on operation type
    target_task_id := COALESCE(NEW.task_id, OLD.task_id);
    
    -- Safety check
    IF target_task_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get current tag names for this task with error handling
    BEGIN
        SELECT array_agg(tags.name) INTO tag_names
        FROM task_tags 
        JOIN tags ON task_tags.tag_id = tags.id 
        WHERE task_tags.task_id = target_task_id;
        
        -- Update the tags array in tasks table
        UPDATE tasks 
        SET tags = COALESCE(tag_names, '{}')
        WHERE id = target_task_id;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the operation
        RAISE WARNING 'Failed to sync tags for task %: %', target_task_id, SQLERRM;
    END;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables (with cleanup first)
DROP TRIGGER IF EXISTS update_users_updated_at ON users CASCADE;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories CASCADE;
CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks CASCADE;
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON task_comments CASCADE;
CREATE TRIGGER update_task_comments_updated_at 
    BEFORE UPDATE ON task_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply search vector trigger to tasks (with cleanup first)
DROP TRIGGER IF EXISTS update_task_search_vector_trigger ON tasks CASCADE;
CREATE TRIGGER update_task_search_vector_trigger
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_search_vector();

-- Apply tags array sync trigger to task_tags (with cleanup first)
DROP TRIGGER IF EXISTS sync_task_tags_array_trigger ON task_tags CASCADE;
CREATE TRIGGER sync_task_tags_array_trigger
    AFTER INSERT OR UPDATE OR DELETE ON task_tags
    FOR EACH ROW EXECUTE FUNCTION sync_task_tags_array();

-- Function to maintain category task counts
CREATE OR REPLACE FUNCTION update_category_task_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old category if changed
    IF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id THEN
        IF OLD.category_id IS NOT NULL THEN
            UPDATE categories SET 
                task_count = task_count - 1,
                completed_task_count = completed_task_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END
            WHERE id = OLD.category_id;
        END IF;
    END IF;
    
    -- Update new category
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.category_id IS NOT NULL THEN
            UPDATE categories SET 
                task_count = task_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END,
                completed_task_count = completed_task_count + 
                    CASE WHEN NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN 1
                         WHEN NEW.status != 'completed' AND TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN -1
                         ELSE 0 END
            WHERE id = NEW.category_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle delete
    IF TG_OP = 'DELETE' THEN
        IF OLD.category_id IS NOT NULL THEN
            UPDATE categories SET 
                task_count = task_count - 1,
                completed_task_count = completed_task_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END
            WHERE id = OLD.category_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply category count trigger (with cleanup first)
DROP TRIGGER IF EXISTS update_category_counts ON tasks CASCADE;
CREATE TRIGGER update_category_counts
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_category_task_count();

-- Function to automatically set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Set completed_at when status changes to completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
        NEW.completed_by = NEW.user_id; -- Assume user completed their own task
    ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at = NULL;
        NEW.completed_by = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply completion trigger (with cleanup first)
DROP TRIGGER IF EXISTS handle_task_completion_trigger ON tasks CASCADE;
CREATE TRIGGER handle_task_completion_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION handle_task_completion();

-- Function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_record RECORD;
BEGIN
    -- Log significant changes
    IF TG_OP = 'UPDATE' THEN
        -- Check each field for changes
        IF OLD.title IS DISTINCT FROM NEW.title THEN
            INSERT INTO task_history (task_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.user_id, 'field_change', 'title', OLD.title, NEW.title);
        END IF;
        
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO task_history (task_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.user_id, 'status_change', 'status', OLD.status::text, NEW.status::text);
        END IF;
        
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            INSERT INTO task_history (task_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.user_id, 'priority_change', 'priority', OLD.priority::text, NEW.priority::text);
        END IF;
        
        IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
            INSERT INTO task_history (task_id, user_id, action, field_name, old_value, new_value)
            VALUES (NEW.id, NEW.user_id, 'due_date_change', 'due_date', 
                    OLD.due_date::text, NEW.due_date::text);
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO task_history (task_id, user_id, action)
        VALUES (NEW.id, NEW.user_id, 'created');
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply task change logging trigger (with cleanup first)
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks CASCADE;
CREATE TRIGGER log_task_changes_trigger
    AFTER INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active tasks view (non-deleted)
CREATE VIEW active_tasks AS
SELECT t.*, c.name as category_name, c.color as category_color
FROM tasks t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.deleted_at IS NULL;

-- Overdue tasks view
CREATE VIEW overdue_tasks AS
SELECT t.*, c.name as category_name
FROM tasks t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.deleted_at IS NULL 
  AND t.status != 'completed'
  AND t.due_date < CURRENT_TIMESTAMP;

-- User task statistics view
CREATE VIEW user_task_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.display_name,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.due_date < CURRENT_TIMESTAMP AND t.status != 'completed' THEN 1 END) as overdue_tasks,
    ROUND(
        CASE WHEN COUNT(t.id) > 0 
        THEN (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100 
        ELSE 0 END, 2
    ) as completion_rate
FROM users u
LEFT JOIN tasks t ON u.id = t.user_id AND t.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.display_name;

-- =====================================================
-- SECURITY POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on main tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data (drop if exists first)
DROP POLICY IF EXISTS users_own_data ON users;
CREATE POLICY users_own_data ON users
    FOR ALL USING (id = current_setting('app.current_user_id')::UUID);

-- Tasks policy - users can only access their own tasks (drop if exists first)
DROP POLICY IF EXISTS tasks_own_data ON tasks;
CREATE POLICY tasks_own_data ON tasks
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- Categories policy - users can only access their own categories (drop if exists first)
DROP POLICY IF EXISTS categories_own_data ON categories;
CREATE POLICY categories_own_data ON categories
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- Comments policy - users can only access comments on their tasks (drop if exists first)
DROP POLICY IF EXISTS comments_own_tasks ON task_comments;
CREATE POLICY comments_own_tasks ON task_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_comments.task_id 
            AND tasks.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Notifications policy - users can only see their own notifications (drop if exists first)
DROP POLICY IF EXISTS notifications_own_data ON notifications;
CREATE POLICY notifications_own_data ON notifications
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Create default admin user (password: 'admin123' - change in production!)
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    status, 
    email_verified,
    email_verified_at
) VALUES (
    'admin@taskflow.com',
    '$2b$12$LQv3c1yqBwEHF4LNsYJr7eMFqiAeVy4o6XPk7UgGKPzgWqQx9mGEy', -- bcrypt hash of 'admin123'
    'System',
    'Administrator',
    'super_admin',
    'active',
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Insert default tags for the admin user (if admin exists)
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@taskflow.com';
    
    -- Only proceed if admin user exists
    IF admin_user_id IS NOT NULL THEN
        -- Insert default tags
        INSERT INTO tags (name, user_id, color) VALUES
            ('urgent', admin_user_id, '#EF4444'),
            ('work', admin_user_id, '#3B82F6'),
            ('personal', admin_user_id, '#10B981'),
            ('shopping', admin_user_id, '#F59E0B'),
            ('health', admin_user_id, '#EC4899'),
            ('learning', admin_user_id, '#8B5CF6'),
            ('travel', admin_user_id, '#06B6D4'),
            ('finance', admin_user_id, '#84CC16')
        ON CONFLICT (user_id, name) DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to get user's task statistics
CREATE OR REPLACE FUNCTION get_user_task_stats(user_uuid UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    completed_tasks BIGINT,
    pending_tasks BIGINT,
    overdue_tasks BIGINT,
    completion_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT as completed_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT as pending_tasks,
        COUNT(CASE WHEN due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 END)::BIGINT as overdue_tasks,
        ROUND(
            CASE WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / COUNT(*)) * 100 
            ELSE 0 END, 2
        ) as completion_rate
    FROM tasks 
    WHERE user_id = user_uuid AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to search tasks
CREATE OR REPLACE FUNCTION search_tasks(
    user_uuid UUID,
    search_query TEXT,
    status_filter task_status[] DEFAULT NULL,
    priority_filter task_priority[] DEFAULT NULL,
    category_filter UUID[] DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    description TEXT,
    priority task_priority,
    status task_status,
    due_date TIMESTAMP WITH TIME ZONE,
    category_name VARCHAR,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.due_date,
        c.name as category_name,
        ts_rank(t.search_vector, plainto_tsquery('english', search_query)) as rank
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = user_uuid
        AND t.deleted_at IS NULL
        AND (search_query IS NULL OR t.search_vector @@ plainto_tsquery('english', search_query))
        AND (status_filter IS NULL OR t.status = ANY(status_filter))
        AND (priority_filter IS NULL OR t.priority = ANY(priority_filter))
        AND (category_filter IS NULL OR t.category_id = ANY(category_filter))
    ORDER BY 
        CASE WHEN search_query IS NOT NULL THEN ts_rank(t.search_vector, plainto_tsquery('english', search_query)) END DESC,
        t.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up expired sessions
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up old audit logs (keep 1 year)
    DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete soft-deleted records
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Permanently delete tasks deleted more than 30 days ago
    DELETE FROM tasks 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Permanently delete categories deleted more than 30 days ago
    DELETE FROM categories 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Permanently delete users deleted more than 90 days ago
    DELETE FROM users 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE OPTIMIZATION
-- =====================================================

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE tasks;
ANALYZE categories;
ANALYZE task_history;
ANALYZE audit_logs;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Central user management with authentication and profile data';
COMMENT ON TABLE tasks IS 'Main task storage with full-text search and audit trail';
COMMENT ON TABLE categories IS 'User-defined task categories with statistics';
COMMENT ON TABLE task_history IS 'Detailed change log for task modifications';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for security and compliance';
COMMENT ON TABLE user_sessions IS 'JWT refresh token management';
COMMENT ON TABLE notifications IS 'User notification system';

COMMENT ON COLUMN tasks.search_vector IS 'Full-text search vector for task title, description, and tags';
COMMENT ON COLUMN tasks.metadata IS 'Flexible JSONB field for future extensibility';
COMMENT ON COLUMN users.preferences IS 'User-specific application preferences';
COMMENT ON COLUMN users.notification_settings IS 'User notification preferences';

-- =====================================================
-- BACKUP AND MAINTENANCE RECOMMENDATIONS
-- =====================================================

/*
MAINTENANCE SCHEDULE:
1. Daily: Run cleanup_expired_tokens()
2. Weekly: Run cleanup_soft_deleted_records()
3. Monthly: VACUUM ANALYZE all tables
4. Quarterly: Review and optimize indexes
5. Annually: Review and update RLS policies

BACKUP STRATEGY:
1. Continuous WAL archiving
2. Daily full backups
3. Point-in-time recovery capability
4. Cross-region backup replication
5. Monthly backup restore testing

MONITORING:
1. Track query performance with pg_stat_statements
2. Monitor connection counts and long-running queries
3. Set up alerts for table bloat and index usage
4. Monitor RLS policy performance impact
*/
