-- =====================================================
-- Migration: 007_tasks_table_enhancements
-- Created: 2025-07-15
-- Description: Add enhancements to existing tasks table
-- =====================================================

-- Create additional enums for tasks
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('personal', 'work', 'project', 'recurring', 'reminder', 'habit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to existing tasks table
DO $$ 
BEGIN
    -- Add parent_task_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'parent_task_id') THEN
        ALTER TABLE tasks ADD COLUMN parent_task_id UUID;
    END IF;
    
    -- Add task_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
        ALTER TABLE tasks ADD COLUMN task_type task_type DEFAULT 'personal';
    END IF;
    
    -- Add start_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'start_date') THEN
        ALTER TABLE tasks ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add reminder_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'reminder_date') THEN
        ALTER TABLE tasks ADD COLUMN reminder_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add scheduled_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'scheduled_date') THEN
        ALTER TABLE tasks ADD COLUMN scheduled_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add estimated_hours column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_hours') THEN
        ALTER TABLE tasks ADD COLUMN estimated_hours DECIMAL(8,2);
    END IF;
    
    -- Add actual_hours column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'actual_hours') THEN
        ALTER TABLE tasks ADD COLUMN actual_hours DECIMAL(8,2);
    END IF;
    
    -- Add time_logged_today column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'time_logged_today') THEN
        ALTER TABLE tasks ADD COLUMN time_logged_today DECIMAL(4,2) DEFAULT 0;
    END IF;
    
    -- Add last_time_log column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'last_time_log') THEN
        ALTER TABLE tasks ADD COLUMN last_time_log TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add completion_percentage column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completion_percentage') THEN
        ALTER TABLE tasks ADD COLUMN completion_percentage INTEGER DEFAULT 0;
    END IF;
    
    -- Add is_recurring column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_recurring') THEN
        ALTER TABLE tasks ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add recurrence_pattern column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'recurrence_pattern') THEN
        ALTER TABLE tasks ADD COLUMN recurrence_pattern JSONB;
    END IF;
    
    -- Add attachments column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'attachments') THEN
        ALTER TABLE tasks ADD COLUMN attachments JSONB DEFAULT '[]';
    END IF;
    
    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'metadata') THEN
        ALTER TABLE tasks ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    
    -- Add last_activity_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'last_activity_at') THEN
        ALTER TABLE tasks ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add constraints after columns are added
DO $$
BEGIN
    -- Add parent task constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parent_not_self') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_parent_not_self CHECK (id != parent_task_id);
    END IF;
    
    -- Add completion percentage constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_completion_percentage_check') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_completion_percentage_check 
        CHECK (completion_percentage >= 0 AND completion_percentage <= 100);
    END IF;
    
    -- Add time constraints if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_time_logged_positive') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_time_logged_positive 
        CHECK (time_logged_today >= 0 AND time_logged_today <= 24);
    END IF;
END $$;

-- Add foreign key constraint for parent_task_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_parent_task_id') THEN
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent_task_id 
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_date ON tasks(reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completion_percentage ON tasks(completion_percentage) WHERE completion_percentage > 0;
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_last_activity ON tasks(last_activity_at DESC);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_pattern ON tasks USING gin(recurrence_pattern);
CREATE INDEX IF NOT EXISTS idx_tasks_attachments ON tasks USING gin(attachments);
CREATE INDEX IF NOT EXISTS idx_tasks_metadata ON tasks USING gin(metadata);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_type_status ON tasks(user_id, task_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled ON tasks(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_hierarchy ON tasks(parent_task_id, user_id) WHERE parent_task_id IS NOT NULL;

-- Update existing tasks to set default values where needed
UPDATE tasks SET 
    task_type = 'personal',
    completion_percentage = 0,
    time_logged_today = 0,
    is_recurring = FALSE,
    attachments = '[]',
    metadata = '{}',
    last_activity_at = COALESCE(updated_at, created_at)
WHERE task_type IS NULL OR completion_percentage IS NULL;

-- Create trigger to update last_activity_at
CREATE OR REPLACE FUNCTION update_task_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_task_last_activity ON tasks;
CREATE TRIGGER trigger_update_task_last_activity
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_last_activity();

-- Add comments for new columns
COMMENT ON COLUMN tasks.parent_task_id IS 'Parent task for subtask hierarchies';
COMMENT ON COLUMN tasks.task_type IS 'Type of task (personal, work, project, etc.)';
COMMENT ON COLUMN tasks.start_date IS 'When task should start';
COMMENT ON COLUMN tasks.reminder_date IS 'When to remind user about task';
COMMENT ON COLUMN tasks.scheduled_date IS 'When user plans to work on task';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimated hours to complete task';
COMMENT ON COLUMN tasks.actual_hours IS 'Actual hours spent on task';
COMMENT ON COLUMN tasks.time_logged_today IS 'Hours logged today (0-24)';
COMMENT ON COLUMN tasks.last_time_log IS 'Last time work was logged';
COMMENT ON COLUMN tasks.completion_percentage IS 'Task completion percentage (0-100)';
COMMENT ON COLUMN tasks.is_recurring IS 'Whether task repeats on schedule';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'JSON pattern for recurring tasks';
COMMENT ON COLUMN tasks.attachments IS 'JSON array of file attachments';
COMMENT ON COLUMN tasks.metadata IS 'Additional task metadata as JSON';
COMMENT ON COLUMN tasks.last_activity_at IS 'Last time task was modified';
