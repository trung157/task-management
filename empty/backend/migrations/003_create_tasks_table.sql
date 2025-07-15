-- =====================================================
-- Migration: 003_create_tasks_table
-- Created: 2025-07-13
-- Description: Create tasks table with advanced features
-- =====================================================

-- Enable full-text search extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create task priority enum
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create task status enum
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tasks table
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
    
    -- Metadata and search
    metadata JSONB DEFAULT '{}',
    search_vector TSVECTOR,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT check_positive_minutes CHECK (
        (estimated_minutes IS NULL OR estimated_minutes >= 0) AND
        (actual_minutes IS NULL OR actual_minutes >= 0)
    ),
    CONSTRAINT check_due_date_logical CHECK (
        due_date IS NULL OR 
        reminder_date IS NULL OR 
        reminder_date <= due_date
    ),
    CONSTRAINT check_completed_status CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed' AND completed_at IS NULL)
    ),
    CONSTRAINT check_tags_array CHECK (
        tags IS NOT NULL AND 
        array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 50
    )
);

-- Create indexes for tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_priority ON tasks(user_id, status, priority) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_category_status ON tasks(user_id, category_id, status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON tasks(user_id, due_date) 
    WHERE deleted_at IS NULL AND status != 'completed' AND due_date < NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING gin(search_vector);

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING gin(tags);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(user_id, created_at DESC) 
    WHERE deleted_at IS NULL AND status != 'archived';

CREATE INDEX IF NOT EXISTS idx_tasks_pending_due ON tasks(user_id, due_date ASC) 
    WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress') AND due_date IS NOT NULL;

-- Create trigger for tasks table updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for updating search vector
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector
DROP TRIGGER IF EXISTS trigger_update_task_search_vector ON tasks;
CREATE TRIGGER trigger_update_task_search_vector
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_search_vector();

-- Add comments
COMMENT ON TABLE tasks IS 'Tasks table with advanced features for task management';
COMMENT ON COLUMN tasks.user_id IS 'Reference to user who owns this task';
COMMENT ON COLUMN tasks.category_id IS 'Optional reference to category';
COMMENT ON COLUMN tasks.title IS 'Task title (required)';
COMMENT ON COLUMN tasks.priority IS 'Task priority level';
COMMENT ON COLUMN tasks.status IS 'Current task status';
COMMENT ON COLUMN tasks.due_date IS 'When the task is due';
COMMENT ON COLUMN tasks.reminder_date IS 'When to remind about the task';
COMMENT ON COLUMN tasks.estimated_minutes IS 'Estimated time to complete (minutes)';
COMMENT ON COLUMN tasks.actual_minutes IS 'Actual time spent (minutes)';
COMMENT ON COLUMN tasks.completed_at IS 'When the task was completed';
COMMENT ON COLUMN tasks.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN tasks.metadata IS 'Flexible JSON metadata storage';
COMMENT ON COLUMN tasks.search_vector IS 'Full-text search vector (auto-generated)';
COMMENT ON COLUMN tasks.deleted_at IS 'Soft delete timestamp';
